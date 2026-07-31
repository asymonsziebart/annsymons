// Ribbon hall sprite — draws the player's mounted tournament rosettes on
// the farmhouse wall. Thin canvas layer over game/ribbon-hall.ts: the
// engine resolves the wall anchor (in screen space) and the layout, and
// this paints each rosette as a small pixel medal with two ribbon tails.
// Pixel-snapped to match the rest of the building art.

import type { RibbonMount } from '../game/ribbon-hall';

/**
 * Draw a row of rosettes starting at (anchorX, anchorY) — the left edge,
 * vertical centre of the display strip. Each mount carries its own dx so
 * the engine doesn't need to know the spacing.
 */
export function drawRibbonHall(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  mounts: readonly RibbonMount[],
): void {
  if (mounts.length === 0) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const m of mounts) {
    drawRosette(ctx, Math.round(anchorX + m.dx), Math.round(anchorY), m.body, m.sheen);
  }
  ctx.restore();
}

/** A single rosette: two ribbon tails under a round medal with a sheen. */
function drawRosette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  body: string,
  sheen: string,
): void {
  // Ribbon tails (two short strips fanning down from the medal).
  ctx.fillStyle = body;
  ctx.fillRect(cx - 2, cy + 2, 2, 5);
  ctx.fillRect(cx + 1, cy + 2, 2, 5);
  // Tail tips a touch darker via the body colour again (kept simple).
  ctx.fillRect(cx - 2, cy + 6, 2, 1);
  ctx.fillRect(cx + 1, cy + 6, 2, 1);

  // Medal disc — a 5x5 rounded blob.
  ctx.fillStyle = body;
  const disc = [
    [1, 0], [2, 0], [3, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
    [1, 4], [2, 4], [3, 4],
  ];
  for (const [dx, dy] of disc) ctx.fillRect(cx - 2 + dx, cy - 3 + dy, 1, 1);

  // Sheen highlight — a small bright pixel pair top-left of the disc.
  ctx.fillStyle = sheen;
  ctx.fillRect(cx - 1, cy - 2, 1, 1);
  ctx.fillRect(cx, cy - 2, 1, 1);
  ctx.fillRect(cx - 1, cy - 1, 1, 1);
}
