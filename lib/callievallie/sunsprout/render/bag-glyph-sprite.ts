// Bag glyph sprite — the thin canvas layer over game/bag-glyph.ts.
//
// Paints one tiny (~12px) recognisable pip per bag row so the inventory
// list scans like the hotbar rather than reading as a wall of text. Seeds
// and crops reuse the procedural crop sprites; forage reuses its world
// sprite; fish / gems / eggs / dishes / supplies get small hand-placed
// pixel silhouettes tinted from the resolver. The resolver (bag-glyph.ts)
// owns which glyph + what colour; this file owns the pixels.
//
// Pure drawing: no state, no engine imports beyond the sibling sprite
// helpers. Caller passes the row's glyph + a centre point; everything is
// pixel-snapped to match the cozy art language.

import type { BagGlyph } from '../game/bag-glyph';
import { drawCropSprite, CROPS } from '../game/crops';
import { drawForageSprite } from '../game/forage';

/** Single-pixel rect helper, snapped, matching the other sprite modules. */
function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, w), Math.max(1, h));
}

/**
 * Draw a bag-row glyph centred at (cx, cy). The glyph occupies roughly a
 * 12x12 box around the centre. Snaps to integer pixels and leaves the
 * context fill state restored to the caller's expectations via save/restore.
 */
export function drawBagGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  glyph: BagGlyph,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const x = Math.round(cx);
  const y = Math.round(cy);
  switch (glyph.kind) {
    case 'crop': {
      // Reuse the crop sprite at its ripe stage. drawCropSprite anchors at
      // centre-bottom, so nudge the anchor down to centre the head in the
      // pip box.
      const crop = CROPS[glyph.cropKey];
      const stage = crop ? crop.growthStages - 1 : 0;
      drawCropSprite(ctx, x, y + 6, glyph.cropKey, stage);
      break;
    }
    case 'forage': {
      // The forage sprite anchors at centre-bottom too; nudge down a touch.
      drawForageSprite(ctx, x, y + 5, glyph.forage);
      break;
    }
    case 'fish': {
      drawFish(ctx, x, y, glyph.color);
      break;
    }
    case 'gem': {
      drawGem(ctx, x, y, glyph.color);
      break;
    }
    case 'egg': {
      drawEgg(ctx, x, y, glyph.color);
      break;
    }
    case 'dish': {
      drawDish(ctx, x, y, glyph.color);
      break;
    }
    case 'supply': {
      drawCrate(ctx, x, y);
      break;
    }
  }
  ctx.restore();
}

/** A small left-facing fish: oval body + a triangular tail + an eye. */
function drawFish(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  // Body — a rounded 8x5 oval.
  px(ctx, cx - 4, cy - 1, 8, 3, color);
  px(ctx, cx - 3, cy - 2, 6, 1, color);
  px(ctx, cx - 3, cy + 2, 6, 1, color);
  // Tail fan on the right.
  px(ctx, cx + 4, cy - 2, 1, 5, color);
  px(ctx, cx + 5, cy - 3, 1, 7, color);
  // Belly highlight + eye.
  px(ctx, cx - 3, cy + 1, 4, 1, 'rgba(255,255,255,0.28)');
  px(ctx, cx - 3, cy - 1, 1, 1, '#1A1426');
}

/** A faceted gem: a 6x7 diamond with a bright top facet. */
function drawGem(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  // Crown (top) and pavilion (bottom) of a cut stone.
  px(ctx, cx - 2, cy - 3, 5, 1, color);
  px(ctx, cx - 3, cy - 2, 7, 1, color);
  px(ctx, cx - 3, cy - 1, 7, 2, color);
  px(ctx, cx - 2, cy + 1, 5, 1, color);
  px(ctx, cx - 1, cy + 2, 3, 1, color);
  px(ctx, cx, cy + 3, 1, 1, color);
  // Facet sheen — a bright wedge top-left.
  px(ctx, cx - 2, cy - 2, 2, 1, 'rgba(255,255,255,0.55)');
  px(ctx, cx - 2, cy - 1, 1, 1, 'rgba(255,255,255,0.35)');
}

/** An egg: a 5x6 ovoid, narrower at the top, with a soft highlight. */
function drawEgg(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  px(ctx, cx - 1, cy - 4, 3, 1, color);
  px(ctx, cx - 2, cy - 3, 5, 1, color);
  px(ctx, cx - 2, cy - 2, 5, 4, color);
  px(ctx, cx - 1, cy + 2, 3, 1, color);
  // Highlight glint top-left.
  px(ctx, cx - 1, cy - 3, 1, 2, 'rgba(255,255,255,0.5)');
}

/** A bowl of food: a rounded bowl + a steaming mound. */
function drawDish(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string): void {
  // Mound of food poking over the rim.
  px(ctx, cx - 3, cy - 2, 6, 1, color);
  px(ctx, cx - 2, cy - 3, 4, 1, color);
  // Bowl — a pale ceramic curve.
  const bowl = '#E8DCC8';
  px(ctx, cx - 4, cy - 1, 8, 1, bowl);
  px(ctx, cx - 4, cy, 8, 2, bowl);
  px(ctx, cx - 3, cy + 2, 6, 1, bowl);
  // Rim shadow.
  px(ctx, cx - 4, cy + 1, 8, 1, 'rgba(0,0,0,0.18)');
}

/** A generic supply crate: a wooden box with a cross-board. */
function drawCrate(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const wood = '#A9763F';
  const dark = '#7A5630';
  px(ctx, cx - 4, cy - 3, 8, 7, wood);
  // Plank borders.
  px(ctx, cx - 4, cy - 3, 8, 1, dark);
  px(ctx, cx - 4, cy + 3, 8, 1, dark);
  px(ctx, cx - 4, cy - 3, 1, 7, dark);
  px(ctx, cx + 3, cy - 3, 1, 7, dark);
  // Diagonal cross-board (stepped pixels).
  px(ctx, cx - 3, cy + 2, 1, 1, dark);
  px(ctx, cx - 1, cy, 1, 1, dark);
  px(ctx, cx + 1, cy - 2, 1, 1, dark);
  px(ctx, cx + 2, cy - 2, 1, 1, dark);
}
