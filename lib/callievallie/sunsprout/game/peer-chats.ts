// Peer chats — v0.6.0 twenty-third slice.
//
// Short-lived chat bubbles keyed by peer id. Mirrors PeerEmotes shape so the
// renderer can query activeFor(id, now) each frame and draw a speech bubble
// above the sprite. Transport wiring (chat-wire → store → render) comes in a
// later tick — this lands the data layer + tests first.
//
// Why a separate store from PeerEmotes: chat lines are longer-lived (read
// time), carry a string body, and we may want to keep a short history per
// peer for a future chat HUD. Keeping the modules parallel but distinct
// avoids cramming two concerns into one class.

import { sanitizeChatText } from './chat-wire';

const CHAT_TTL_MS = 6000;
const MAX_TOTAL = 64;

export interface ActiveChat {
  peerId: string;
  text: string;
  bornAt: number;
  diesAt: number;
}

export class PeerChats {
  private byPeer = new Map<string, ActiveChat>();

  /** Push a chat line for a peer. Sanitises + replaces any existing bubble
   *  for that peer (only one bubble shown at a time). Returns the stored
   *  ActiveChat, or undefined if the input sanitised to empty. */
  push(peerId: string, body: string, now: number): ActiveChat | undefined {
    if (!peerId) return undefined;
    const text = sanitizeChatText(body);
    if (!text) return undefined;
    this.prune(now);
    if (this.byPeer.size >= MAX_TOTAL && !this.byPeer.has(peerId)) {
      let oldestId: string | undefined;
      let oldestBorn = Infinity;
      for (const [id, c] of this.byPeer) {
        if (c.bornAt < oldestBorn) {
          oldestBorn = c.bornAt;
          oldestId = id;
        }
      }
      if (oldestId) this.byPeer.delete(oldestId);
    }
    const chat: ActiveChat = {
      peerId,
      text,
      bornAt: now,
      diesAt: now + CHAT_TTL_MS,
    };
    this.byPeer.set(peerId, chat);
    return chat;
  }

  /** Return the active chat for a peer, or undefined (auto-prunes expired). */
  activeFor(peerId: string, now: number): ActiveChat | undefined {
    const c = this.byPeer.get(peerId);
    if (!c) return undefined;
    if (c.diesAt <= now) {
      this.byPeer.delete(peerId);
      return undefined;
    }
    return c;
  }

  /** All currently-live chat bubbles (post-prune). Insertion order. */
  list(now: number): ActiveChat[] {
    this.prune(now);
    return Array.from(this.byPeer.values());
  }

  /** Count of live chats after pruning. */
  size(now: number): number {
    this.prune(now);
    return this.byPeer.size;
  }

  /** Drop a peer's chat — e.g. on peer leave. */
  forget(peerId: string): void {
    this.byPeer.delete(peerId);
  }

  /** Drop everything. */
  clear(): void {
    this.byPeer.clear();
  }

  private prune(now: number): void {
    for (const [id, c] of this.byPeer) {
      if (c.diesAt <= now) this.byPeer.delete(id);
    }
  }
}
