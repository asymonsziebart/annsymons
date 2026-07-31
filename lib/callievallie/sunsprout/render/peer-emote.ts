// Peer emote bubble — v0.6.0 seventeenth slice.
//
// Pure draw helper for the little emote bubble that floats above a remote
// player's sprite. Mirrors the style of drawPeerNameplate (dark rounded
// background + crisp pixel text) but sits a bit higher and uses a glyph
// per EmoteKind instead of a name string.
//
// Kept isolated so the renderer-wiring tick can iterate PeerEmotes.list()
// and call this once per live bubble, against a unit-testable stub ctx.
// No timing logic here — the caller already knows the emote is live (it
// came from PeerEmotes.activeFor / list, which prune by now).

import type { EmoteKind } from '../game/peer-emotes';
import { drawPixelRect, drawPixelText } from './pixel';

/** Glyph drawn inside the bubble. Tiny so the pixel font reads cleanly. */
const GLYPH: Record<EmoteKind, string> = {
  wave: '~',
  heart: '<3',
  sprout: 'v',
  sparkle: '*',
  note: 'J',
};

/** Approx pixel width of a glyph at our 6px-per-char font. */
function glyphWidth(g: string): number {
  return Math.max(6, g.length * 6);
}

/**
 * Draw an emote bubble centred above a peer at screen-space (sx, sy).
 * The (sx, sy) is the same torso-center anchor used by drawPeerSprite, so
 * the bubble naturally floats above the nameplate (which sits at sy-28).
 */
export function drawPeerEmote(
  ctx: CanvasRenderingContext2D,
  kind: EmoteKind,
  sx: number,
  sy: number,
): void {
  const glyph = GLYPH[kind];
  if (!glyph) return;
  const gw = glyphWidth(glyph);
  const w = gw + 6;
  const h = 11;
  const x = sx - Math.floor(w / 2);
  const y = sy - 42; // above the nameplate (which lives at sy-28, height 9)
  // Bubble background + a single-pixel tail toward the head.
  drawPixelRect(ctx, x, y, w, h, '#FFF6E1');
  drawPixelRect(ctx, x, y, w, 1, '#2C2A38');
  drawPixelRect(ctx, x, y + h - 1, w, 1, '#2C2A38');
  drawPixelRect(ctx, x, y, 1, h, '#2C2A38');
  drawPixelRect(ctx, x + w - 1, y, 1, h, '#2C2A38');
  drawPixelRect(ctx, sx - 1, y + h, 2, 2, '#FFF6E1');
  drawPixelRect(ctx, sx - 1, y + h + 1, 2, 1, '#2C2A38');
  // Glyph in the centre.
  drawPixelText(ctx, glyph, x + 3, y + 2, '#2C2A38');
}

/** Test/debug helper — exposes the glyph table for unit tests. */
export function emoteGlyph(kind: EmoteKind): string {
  return GLYPH[kind];
}
