// Seasonal shop banner sprite — the thin canvas layer that paints the
// banner descriptor from game/shop-banner.ts over Vallie's shop roof.
//
// A small hanging cloth on two posts, striped in the season's colour with
// the season motif blitted in the accent hue and the season word beneath.
// Pure drawing: every value comes from the ShopBannerStyle, so the look is
// decided + tested in the game/ module and this file just renders pixels.

import type { ShopBannerStyle } from '../game/shop-banner';

/** Banner cloth size in screen pixels. */
const BANNER_W = 34;
const BANNER_H = 24;
const MOTIF_PX = 2; // each motif cell is 2x2 device pixels (5x5 -> 10x10)

/**
 * Draw the banner centred horizontally on (cx) with its top at (topY),
 * both in screen space. The caller positions it over the shop roof.
 */
export function drawShopBanner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  style: ShopBannerStyle,
): void {
  const x = Math.round(cx - BANNER_W / 2);
  const y = Math.round(topY);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Cross-beam the banner hangs from.
  ctx.fillStyle = '#5A4030';
  ctx.fillRect(x - 2, y - 3, BANNER_W + 4, 3);
  // Two short ropes from the beam to the cloth top.
  ctx.fillRect(x + 3, y, 1, 3);
  ctx.fillRect(x + BANNER_W - 4, y, 1, 3);

  const clothY = y + 3;
  // Cloth body.
  ctx.fillStyle = style.cloth;
  ctx.fillRect(x, clothY, BANNER_W, BANNER_H);
  // Darker vertical stripes for a woven-cloth read.
  ctx.fillStyle = style.clothDark;
  for (let i = 0; i < BANNER_W; i += 8) {
    ctx.fillRect(x + i, clothY, 3, BANNER_H);
  }
  // Top + bottom trim bands.
  ctx.fillRect(x, clothY, BANNER_W, 2);
  ctx.fillRect(x, clothY + BANNER_H - 2, BANNER_W, 2);

  // Motif, centred on the cloth.
  const motif = style.motif;
  const motifW = motif[0].length * MOTIF_PX;
  const motifH = motif.length * MOTIF_PX;
  const mx = x + Math.floor((BANNER_W - motifW) / 2);
  const my = clothY + 4;
  ctx.fillStyle = style.accent;
  for (let r = 0; r < motif.length; r++) {
    for (let c = 0; c < motif[r].length; c++) {
      if (motif[r][c] === 1) {
        ctx.fillRect(mx + c * MOTIF_PX, my + r * MOTIF_PX, MOTIF_PX, MOTIF_PX);
      }
    }
  }

  // Season word beneath the motif.
  ctx.font = '7px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = style.accent;
  ctx.fillText(style.label, x + BANNER_W / 2, my + motifH + 1);

  ctx.restore();
}
