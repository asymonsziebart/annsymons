// Peer chat bubble — v0.6.0 twenty-fourth slice.
//
// Pure draw helper for the speech bubble that floats above a remote player's
// sprite when they say something. Mirrors drawPeerEmote in style (dark
// rounded background + crisp pixel text + little tail toward the head) but
// renders a sanitised text body instead of a glyph and sits a touch higher
// so it stacks above the nameplate without clipping the emote bubble.
//
// Kept isolated so the renderer-wiring tick can iterate PeerChats.list()
// and call this once per live bubble, against a unit-testable stub ctx.
// No timing logic here — the caller already knows the chat is live (it
// came from PeerChats.activeFor / list, which prune by now).

import { drawPixelRect, drawPixelText } from './pixel';

const CHAR_PX = 6; // 6px-per-char pixel font
const MAX_BUBBLE_CHARS = 28; // hard wrap on bubble width; sanitizer caps body length already

/** Clamp text to a sensible bubble width without breaking ASCII assumptions. */
function clampForBubble(text: string): string {
  if (text.length <= MAX_BUBBLE_CHARS) return text;
  return text.slice(0, MAX_BUBBLE_CHARS - 1) + '…';
}

function textWidth(text: string): number {
  return Math.max(CHAR_PX, text.length * CHAR_PX);
}

/**
 * Draw a chat bubble centred above a peer at screen-space (sx, sy).
 * The (sx, sy) is the same torso-center anchor used by drawPeerSprite, so
 * the bubble floats above the nameplate (sy-28) and clear of any emote
 * bubble (which lives at sy-42, height 11 → bottom ~ sy-31).
 */
export function drawPeerChat(
  ctx: CanvasRenderingContext2D,
  text: string,
  sx: number,
  sy: number,
): void {
  const body = clampForBubble(text);
  if (!body) return;
  const tw = textWidth(body);
  const w = tw + 6;
  const h = 11;
  const x = sx - Math.floor(w / 2);
  const y = sy - 56; // above the emote bubble row (which ends ~sy-31)
  // Bubble background + 1px outline.
  drawPixelRect(ctx, x, y, w, h, '#FFF6E1');
  drawPixelRect(ctx, x, y, w, 1, '#2C2A38');
  drawPixelRect(ctx, x, y + h - 1, w, 1, '#2C2A38');
  drawPixelRect(ctx, x, y, 1, h, '#2C2A38');
  drawPixelRect(ctx, x + w - 1, y, 1, h, '#2C2A38');
  // Little tail toward the head.
  drawPixelRect(ctx, sx - 1, y + h, 2, 2, '#FFF6E1');
  drawPixelRect(ctx, sx - 1, y + h + 1, 2, 1, '#2C2A38');
  // Body text in the centre.
  drawPixelText(ctx, body, x + 3, y + 2, '#2C2A38');
}

/** Test/debug helper — exposes the bubble-truncation logic. */
export function chatBubbleText(text: string): string {
  return clampForBubble(text);
}
