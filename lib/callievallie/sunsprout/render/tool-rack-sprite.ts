// Tool-rack sprite — draws the player's tool kit on the farmhouse wall.
// Thin canvas layer over game/tool-rack.ts: the engine resolves the wall
// anchor (in screen space) and the layout, and this paints each tool as
// a small pixel silhouette tinted by its tier metal. Each tool has its
// own distinct shape (hoe / can / pickaxe / rod) so the kit reads at a
// glance. Pixel-snapped to match the rest of the building art.

import type { RackMount, RackToolKind } from '../game/tool-rack';

/**
 * Draw the tools starting at (anchorX, anchorY) — the left edge, vertical
 * centre of the rack strip. Each mount carries its own dx so the engine
 * doesn't need to know the spacing. A thin peg board runs behind them.
 */
export function drawToolRack(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  mounts: readonly RackMount[],
): void {
  if (mounts.length === 0) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Peg board behind the tools — a darker plank so the kit reads as
  // hung gear rather than floating pixels.
  const boardX = Math.round(anchorX) - 3;
  const boardY = Math.round(anchorY) - 5;
  const lastDx = mounts[mounts.length - 1].dx;
  const boardW = lastDx + 9;
  ctx.fillStyle = 'rgba(60, 44, 30, 0.85)';
  ctx.fillRect(boardX, boardY, boardW, 13);
  ctx.fillStyle = 'rgba(40, 28, 18, 0.9)';
  ctx.fillRect(boardX, boardY + 12, boardW, 1);
  for (const m of mounts) {
    drawTool(ctx, Math.round(anchorX + m.dx), Math.round(anchorY), m.kind, m.body, m.sheen);
  }
  ctx.restore();
}

/** Dispatch to the per-tool silhouette. Each fits in a ~6x10 cell. */
function drawTool(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  kind: RackToolKind,
  body: string,
  sheen: string,
): void {
  switch (kind) {
    case 'hoe':
      drawHoe(ctx, cx, cy, body, sheen);
      break;
    case 'can':
      drawCan(ctx, cx, cy, body, sheen);
      break;
    case 'pickaxe':
      drawPickaxe(ctx, cx, cy, body, sheen);
      break;
    case 'rod':
      drawRod(ctx, cx, cy, body, sheen);
      break;
  }
}

/** A wooden handle pixel column with a metal head. Shared shaft helper. */
function drawShaft(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  ctx.fillStyle = '#6B4A2A';
  ctx.fillRect(x, y, 1, h);
}

/** Hoe — angled handle with a flat blade at the foot. */
function drawHoe(ctx: CanvasRenderingContext2D, cx: number, cy: number, body: string, sheen: string): void {
  drawShaft(ctx, cx, cy - 5, 9);
  ctx.fillStyle = body;
  // Blade kicks out to the right at the foot.
  ctx.fillRect(cx + 1, cy + 3, 3, 1);
  ctx.fillRect(cx + 3, cy + 2, 1, 1);
  ctx.fillStyle = sheen;
  ctx.fillRect(cx, cy - 5, 1, 1);
}

/** Watering can — a squat body with a spout and a top handle. */
function drawCan(ctx: CanvasRenderingContext2D, cx: number, cy: number, body: string, sheen: string): void {
  ctx.fillStyle = body;
  // Body block.
  ctx.fillRect(cx - 1, cy - 1, 4, 5);
  // Spout up-left.
  ctx.fillRect(cx - 2, cy - 2, 1, 1);
  ctx.fillRect(cx - 1, cy - 2, 1, 1);
  // Handle nub on top.
  ctx.fillRect(cx + 1, cy - 3, 1, 1);
  ctx.fillStyle = sheen;
  ctx.fillRect(cx, cy - 1, 1, 1);
}

/** Pickaxe — vertical handle with a curved double-headed metal top. */
function drawPickaxe(ctx: CanvasRenderingContext2D, cx: number, cy: number, body: string, sheen: string): void {
  drawShaft(ctx, cx + 1, cy - 4, 9);
  ctx.fillStyle = body;
  // Head spanning the top.
  ctx.fillRect(cx - 1, cy - 4, 5, 1);
  ctx.fillRect(cx - 1, cy - 3, 1, 1);
  ctx.fillRect(cx + 3, cy - 3, 1, 1);
  ctx.fillStyle = sheen;
  ctx.fillRect(cx, cy - 4, 1, 1);
}

/** Rod — a long thin pole with a line + tip bobble. */
function drawRod(ctx: CanvasRenderingContext2D, cx: number, cy: number, body: string, sheen: string): void {
  ctx.fillStyle = body;
  // Diagonal pole from low-left to high-right.
  ctx.fillRect(cx, cy + 4, 1, 1);
  ctx.fillRect(cx + 1, cy + 2, 1, 1);
  ctx.fillRect(cx + 2, cy, 1, 1);
  ctx.fillRect(cx + 3, cy - 2, 1, 1);
  ctx.fillRect(cx + 4, cy - 4, 1, 1);
  // Line dangling from the tip.
  ctx.fillStyle = 'rgba(220, 220, 220, 0.7)';
  ctx.fillRect(cx + 4, cy - 3, 1, 3);
  ctx.fillStyle = sheen;
  ctx.fillRect(cx + 4, cy - 4, 1, 1);
}
