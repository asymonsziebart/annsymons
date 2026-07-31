// Peer mute mark — v0.6.0 next slice.
//
// Pure draw helper that overlays a small "muted" badge on a peer's
// nameplate when the local player has muted them via the M key. The
// nameplate (see drawPeerNameplate in peer-sprite.ts) lives at sy-28
// with height 9; we paint a tiny crossed-circle just to the right of
// that bar so it reads as "this peer is silenced for you" without
// hiding the name itself.
//
// Kept as its own module — no timing, no state, no DOM — so the
// renderer-wiring tick can iterate peers and call this against a
// ChatMuteSet (or any { isMuted(id): boolean } source) without
// peer-sprite.ts taking a direct dep on mute state.

import { drawPixelRect } from './pixel';

/** Minimal surface — ChatMuteSet satisfies this. */
export interface MuteSource {
  isMuted(id: string): boolean;
}

/** Width in screen pixels of the badge, used for nameplate offset math. */
export const PEER_MUTE_MARK_WIDTH = 9;

/**
 * Compute the rough screen-space pixel width of a nameplate so callers
 * can position the badge flush to its right edge. Mirrors the math in
 * drawPeerNameplate (max(12, len*6 + 4) on a 12-char-truncated name).
 */
function nameplateWidth(name: string): number {
  const text = name.length > 12 ? `${name.slice(0, 11)}…` : name;
  return Math.max(12, text.length * 6 + 4);
}

/**
 * Draw a tiny mute badge anchored to the nameplate of a peer at the
 * torso-center (sx, sy) anchor used by drawPeerSprite. No-op when the
 * source reports the peer as not muted, so callers can call this
 * unconditionally inside their peer loop.
 *
 * Visual: a 9x9 dark-grey square with a thin diagonal slash, painted
 * flush to the right edge of the nameplate so it reads as a separate
 * pill rather than covering the name.
 */
export function drawPeerMuteMark(
  ctx: CanvasRenderingContext2D,
  peer: { id: string; name: string },
  source: MuteSource,
  sx: number,
  sy: number,
): boolean {
  if (!source.isMuted(peer.id)) return false;
  const nw = nameplateWidth(peer.name);
  const x = sx - Math.floor(nw / 2) + nw + 1; // flush-right of nameplate
  const y = sy - 28; // nameplate top
  // Background pill.
  drawPixelRect(ctx, x, y, PEER_MUTE_MARK_WIDTH, 9, '#2C2A38');
  // Inner fill so the slash reads.
  drawPixelRect(ctx, x + 1, y + 1, PEER_MUTE_MARK_WIDTH - 2, 7, '#5A4A6E');
  // Diagonal slash (top-right → bottom-left).
  for (let i = 0; i < 7; i++) {
    drawPixelRect(ctx, x + (PEER_MUTE_MARK_WIDTH - 2 - i), y + 1 + i, 1, 1, '#FF6B6B');
  }
  return true;
}
