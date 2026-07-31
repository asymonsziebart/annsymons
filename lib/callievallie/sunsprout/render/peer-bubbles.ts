// Peer bubbles renderer wiring — v0.6.0 twenty-sixth slice.
//
// Iterates a list of PeerRenderable and, for each, queries a BubbleSource
// (the MultiplayerDriver in production) for any active chat / emote bubble
// and dispatches to drawPeerChat / drawPeerEmote at the peer's screen-space
// torso anchor. Pure routing — no timing, no DOM. Stays trivially testable
// against a stub ctx + stub source.
//
// Drawing order per peer: emote first, chat on top. The chat bubble lives
// higher than the emote bubble (drawPeerChat draws at sy-56, drawPeerEmote
// at sy-42) so even with both on screen they don't overlap.

import type { Camera } from '../engine/camera';
import type { PeerRenderable } from '../game/peer-view';
import type { ActiveChat } from '../game/peer-chats';
import type { ActiveEmote } from '../game/peer-emotes';
import { peerScreenPos } from './peer-sprite';
import { drawPeerChat } from './peer-chat';
import { drawPeerEmote } from './peer-emote';

/** Minimal surface — MultiplayerDriver satisfies this. */
export interface BubbleSource {
  chatFor(peerId: string, now: number): ActiveChat | undefined;
  emoteFor(peerId: string, now: number): ActiveEmote | undefined;
}

export interface DrawPeerBubblesOpts {
  peers: readonly PeerRenderable[];
  source: BubbleSource;
  camera: Camera;
  now: number;
  /** Optional viewport cull slack. Defaults to 64 — covers bubble heights. */
  slack?: number;
}

/** Draw chat + emote bubbles for every peer that has one. */
export function drawPeerBubbles(
  ctx: CanvasRenderingContext2D,
  opts: DrawPeerBubblesOpts,
): void {
  const slack = opts.slack ?? 64;
  const w = opts.camera.viewW;
  const h = opts.camera.viewH;
  for (const peer of opts.peers) {
    const { sx, sy } = peerScreenPos(peer, opts.camera.x, opts.camera.y);
    if (sx < -slack || sx > w + slack || sy < -slack || sy > h + slack) continue;
    const emote = opts.source.emoteFor(peer.id, opts.now);
    if (emote) drawPeerEmote(ctx, emote.kind, sx, sy);
    const chat = opts.source.chatFor(peer.id, opts.now);
    if (chat) drawPeerChat(ctx, chat.text, sx, sy);
  }
}
