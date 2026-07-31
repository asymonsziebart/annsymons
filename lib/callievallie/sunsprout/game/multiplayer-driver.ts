// Multiplayer driver — v0.6.0 (twenty-fifth slice: chat wiring).
//
// Thin glue object: owns a MultiplayerSession + PeerView + PeerEmotes +
// PeerChats and exposes the small per-frame surface that engine/game.ts needs:
//   - tick(local, now) → broadcasts the local snapshot and evicts stale peers
//   - peers(now)       → returns smoothed PeerRenderables to draw
//   - emoteFor(id, now)→ active emote bubble for a peer (or undefined)
//   - sendEmote(kind)  → broadcast an emote from the local player
//   - chatFor(id, now) → active chat bubble for a peer (or undefined)
//   - sendChat(body)   → broadcast a chat line from the local player
//
// Pulled into its own module so the Game class doesn't have to know about
// session/view/emote/chat wiring details and so we can unit-test the per-frame
// loop without instantiating the renderer or a real BroadcastChannel.

import type { MultiplayerSession, LocalState } from './multiplayer-session';
import type { PeerView, PeerRenderable } from './peer-view';
import { PeerPresenceLog, type PeerEvent } from './peer-events';
import { PeerEmotes, type ActiveEmote, type EmoteKind } from './peer-emotes';
import { broadcastEmote } from './emote-transport';
import { deserializeEmote, looksLikeEmoteWire } from './emote-wire';
import { PeerChats, type ActiveChat } from './peer-chats';
import { broadcastChat } from './chat-transport';
import { ChatLog, type ChatLogEntry } from './chat-log';
import { ChatMuteSet } from './chat-mute';
import { LastChatter } from './last-chatter';
import { MuteHistory } from './mute-history';
import { deserializeChat, looksLikeChatWire } from './chat-wire';

export interface MultiplayerDriverOpts {
  session: MultiplayerSession;
  view: PeerView;
  /** Optional presence log — injected in tests; one is created if omitted. */
  presence?: PeerPresenceLog;
  /** Optional emotes store — injected in tests; one is created if omitted. */
  emotes?: PeerEmotes;
  /** Optional chats store — injected in tests; one is created if omitted. */
  chats?: PeerChats;
  /** Optional chat log — injected in tests; one is created if omitted. */
  chatLog?: ChatLog;
  /** Optional mute set — injected in tests; one is created if omitted. */
  mutes?: ChatMuteSet;
  /** Optional last-chatter tracker — injected in tests; one is created if omitted. */
  lastChatter?: LastChatter;
  /** Optional mute history — injected in tests; one is created if omitted. */
  muteHistory?: MuteHistory;
}

export class MultiplayerDriver {
  readonly session: MultiplayerSession;
  readonly view: PeerView;
  readonly presence: PeerPresenceLog;
  readonly emotes: PeerEmotes;
  readonly chats: PeerChats;
  readonly chatLog: ChatLog;
  readonly mutes: ChatMuteSet;
  readonly lastChatter: LastChatter;
  readonly muteHistory: MuteHistory;
  /** Cumulative count of broadcasts since construction — handy for tests. */
  private _ticks = 0;
  /** Events produced by the most recent tick(). Drained by drainEvents(). */
  private _lastEvents: PeerEvent[] = [];
  private _unbindEmotes: () => void;
  private _unbindChats: () => void;
  private _unbindChatLog: () => void;

  constructor(opts: MultiplayerDriverOpts) {
    this.session = opts.session;
    this.view = opts.view;
    this.presence = opts.presence ?? new PeerPresenceLog();
    this.emotes = opts.emotes ?? new PeerEmotes();
    this.chats = opts.chats ?? new PeerChats();
    this.chatLog = opts.chatLog ?? new ChatLog();
    this.mutes = opts.mutes ?? new ChatMuteSet();
    this.lastChatter = opts.lastChatter ?? new LastChatter();
    this.muteHistory = opts.muteHistory ?? new MuteHistory();
    // Seed with whatever peers already exist so we don't fire spurious joins
    // for sessions we attach to mid-flight.
    this.presence.seed(this.session.registry);
    // Subscribe to inbound emote + chat events. Each binder uses a cheap
    // wire-shape sniff so snapshot traffic pays nothing extra.
    // Inline emote bind so muted peers also have their emote bubbles dropped.
    this._unbindEmotes = this.session.transport.onMessage((raw) => {
      if (!looksLikeEmoteWire(raw)) return;
      const msg = deserializeEmote(raw);
      if (!msg) return;
      if (this.mutes.isMuted(msg.id)) return;
      this.emotes.push(msg.id, msg.k, Date.now());
    });
    // Chat goes through a thin wrapper so muted peers drop both their
    // bubble and their history-line in one place.
    this._unbindChats = this.session.transport.onMessage((raw) => {
      if (!looksLikeChatWire(raw)) return;
      const msg = deserializeChat(raw);
      if (!msg) return;
      if (this.mutes.isMuted(msg.id)) return;
      const now = Date.now();
      this.chats.push(msg.id, msg.m, now);
      this.lastChatter.note(msg.id, now);
    });
    // Also tee inbound chat messages into the rolling history log so the
    // bottom-left HUD panel renders peer lines alongside the local player's.
    this._unbindChatLog = this.session.transport.onMessage((raw) => {
      if (!looksLikeChatWire(raw)) return;
      const msg = deserializeChat(raw);
      if (!msg) return;
      if (this.mutes.isMuted(msg.id)) return;
      this.chatLog.push(msg.id, msg.m, Date.now());
    });
  }

  /** True once the underlying session has been closed. */
  get closed(): boolean {
    return this.session.closed;
  }

  /** Tick count; one per non-closed tick() call. */
  get ticks(): number {
    return this._ticks;
  }

  /**
   * Drive the session forward one frame. Returns the list of peer ids that
   * were evicted this tick (stale, no snapshot within peerTimeoutMs). The
   * caller can ignore the return value in most cases — it's exposed so the
   * Game can surface a toast when a friend disconnects.
   */
  tick(local: LocalState, now: number): string[] {
    if (this.session.closed) return [];
    this._ticks++;
    const evicted = this.session.update(local, now);
    this._lastEvents = this.presence.diff(this.session.registry, now);
    // Forget emote + chat bubbles for peers that just left so a re-join
    // doesn't briefly inherit a stale bubble.
    for (const ev of this._lastEvents) {
      if (ev.kind === 'leave') {
        this.emotes.forget(ev.id);
        this.chats.forget(ev.id);
        // Drop the departing peer from every stored mute-history snapshot so
        // a future Shift+U (restore-mutes) can't try to re-mute someone who
        // is no longer in the session.
        this.muteHistory.prune(ev.id);
      }
    }
    return evicted;
  }

  /** Pull and clear the queue of join/leave events recorded since the last
   *  call. Empty on the happy path. Callers pump these into PeerToasts. */
  drainEvents(): PeerEvent[] {
    const out = this._lastEvents;
    this._lastEvents = [];
    return out;
  }

  /** Resolve smoothed render positions for every visible peer. */
  peers(now: number): PeerRenderable[] {
    return this.view.viewAt(this.session.registry, now);
  }

  /** Active emote bubble for a peer (local or remote), or undefined. */
  emoteFor(peerId: string, now: number): ActiveEmote | undefined {
    return this.emotes.activeFor(peerId, now);
  }

  /** Active chat bubble for a peer (local or remote), or undefined. */
  chatFor(peerId: string, now: number): ActiveChat | undefined {
    return this.chats.activeFor(peerId, now);
  }

  /**
   * Broadcast an emote from the local player and immediately echo it into
   * our own emote store so the local player sees their own bubble (the
   * loopback transport doesn't deliver to the sender by design).
   */
  sendEmote(kind: EmoteKind, now: number): void {
    if (this.session.closed) return;
    broadcastEmote(this.session.transport, this.session.identity.id, kind);
    this.emotes.push(this.session.identity.id, kind, now);
  }

  /**
   * Broadcast a chat line from the local player and echo it locally. Returns
   * true if the sanitized body was non-empty and a message was sent. No-op
   * after close().
   */
  sendChat(body: string, now: number): boolean {
    if (this.session.closed) return false;
    const sent = broadcastChat(this.session.transport, this.session.identity.id, body);
    if (!sent) return false;
    this.chats.push(this.session.identity.id, body, now);
    this.chatLog.push('local', body, Date.now());
    return true;
  }

  /** Most recent chat history entries, oldest → newest. */
  recentChatHistory(n: number = 5): ChatLogEntry[] {
    return this.chatLog.tail(n);
  }

  /**
   * Id of the most recent unmuted peer to chat, or null if no one has spoken
   * within the LastChatter TTL (or the last speaker is now muted). Powers the
   * planned "mute last speaker" keybind.
   */
  lastChatterId(now: number): string | null {
    const entry = this.lastChatter.get(now);
    if (!entry) return null;
    if (this.mutes.isMuted(entry.id)) return null;
    return entry.id;
  }

  close(): void {
    this._unbindEmotes();
    this._unbindChats();
    this._unbindChatLog();
    this.session.close();
    this.view.clear();
    this.emotes.clear();
    this.chats.clear();
    this.chatLog.clear();
  }
}
