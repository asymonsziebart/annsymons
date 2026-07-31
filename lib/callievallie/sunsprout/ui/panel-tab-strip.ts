// Panel tab-strip widget — the thin draw layer over game/panel-tabs.ts.
//
// Renders one row of tabs in the shared dark-violet panel chrome used by
// the lore / bag / settings family: a filled cell per tab, the active one
// lit warmer + lifted, the primary label centred with an optional small
// secondary line (progress, count) beneath it. The geometry + active flag
// come from tabStripLayout so this file owns only colours + text.
//
// Pure drawing: no state, no engine imports. Callers pass the laid-out
// rects (from tabStripLayout) so the panel keeps one source of truth for
// where each tab sits.

import type { TabRect } from '../game/panel-tabs';

const TAB_BG = 'rgba(40, 30, 60, 0.85)';
const TAB_ACTIVE = 'rgba(108, 86, 158, 0.92)';
const TAB_BORDER = '#6b5b8e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const HINT = 'rgba(245, 233, 212, 0.55)';

/**
 * Draw a laid-out tab strip. Each rect already knows its position, size,
 * label, optional sub line, and whether it's the active tab. The active
 * tab fills with the warm violet + draws its label in the title colour;
 * inactive tabs use the muted fill + body text. The sub line (e.g. "3/5")
 * sits under the label in the body/hint colour.
 */
export function drawTabStrip(ctx: CanvasRenderingContext2D, rects: readonly TabRect[]): void {
  if (rects.length === 0) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'top';
  for (const r of rects) {
    ctx.fillStyle = r.active ? TAB_ACTIVE : TAB_BG;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = TAB_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

    const cx = r.x + r.w / 2;
    ctx.textAlign = 'center';
    if (r.sub) {
      // Two lines: label up top, sub underneath.
      ctx.fillStyle = r.active ? TITLE_COLOR : TEXT_COLOR;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(r.label, cx, r.y + 4);
      ctx.fillStyle = r.active ? TEXT_COLOR : HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(r.sub, cx, r.y + 16);
    } else {
      // Single centred label.
      ctx.fillStyle = r.active ? TITLE_COLOR : TEXT_COLOR;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(r.label, cx, r.y + Math.floor((r.h - 11) / 2));
    }
  }
  ctx.restore();
}
