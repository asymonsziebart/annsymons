// Sleep summary overlay — modal shown the morning after sleep().
//
// Renders a small, centered panel listing yesterday's deltas: gold,
// harvest, dishes, heart gains, each with a category tint + a small
// monochrome pixel glyph, plus a "best moment" highlight line and the
// dawn flavour. The player dismisses with any of the usual keys (Space /
// Enter / Escape) — the Game's input loop is responsible for calling
// close().
//
// The row + highlight logic lives in pure game/day-summary.ts so the
// wording is unit-testable; this file is the thin canvas layer.

import type { DaySummary } from '../game/sleep';
import type { Player } from '../world/world';
import {
  summaryRows,
  bestMomentLine,
  continuityLine,
  SUMMARY_ROW_COLOR,
  type SummaryRowKind,
} from '../game/day-summary';
import { buildJournal } from '../game/crop-journal';

const PANEL_BG = 'rgba(26, 20, 38, 0.94)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const SUBTLE = '#9D8FB8';
const BEST_COLOR = '#F5E9D4';
const BEST_BG = 'rgba(64, 48, 96, 0.55)';
const CONTINUITY_COLOR = '#7CC55C';

export class SleepSummary {
  private summary: DaySummary | null = null;
  private fadeInMs = 0;

  /** Open the panel with a fresh summary. */
  open(s: DaySummary): void {
    this.summary = s;
    this.fadeInMs = 400; // 400ms ease-in fade
  }

  /** True while the modal is on screen. */
  isVisible(): boolean {
    return this.summary !== null;
  }

  /** Dismiss the modal. */
  close(): void {
    this.summary = null;
    this.fadeInMs = 0;
  }

  /** Per-frame countdown for the fade-in. */
  update(dtMs: number): void {
    if (this.fadeInMs > 0) this.fadeInMs = Math.max(0, this.fadeInMs - dtMs);
  }

  /** Public for the input loop — dismiss after a brief lockout to avoid skip-on-open. */
  canDismiss(): boolean {
    return this.summary !== null && this.fadeInMs <= 0;
  }

  /** Render the panel. No-op when no summary is open. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    const s = this.summary;
    if (!s) return;
    // Compute alpha for the fade-in.
    const alpha = 1 - this.fadeInMs / 400;

    ctx.save();
    ctx.globalAlpha = alpha;
    // Dim backdrop.
    ctx.fillStyle = 'rgba(15, 10, 25, 0.55)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const w = 320;
    const rows = summaryRows(s);
    const best = bestMomentLine(s);
    // Lifetime crops-reaped tally drives the continuity line that ties
    // this dawn to the farm's whole story.
    const lifetimeHarvest = buildJournal(player).reduce(
      (sum, e) => sum + e.normal + e.silver + e.gold,
      0,
    );
    const continuity = continuityLine(s, lifetimeHarvest);

    const titleH = 28;
    const lineH = 18;
    const bestH = best ? 22 : 0;
    const continuityH = continuity ? 16 : 0;
    const flavorH = 22;
    const pad = 14;
    const h = pad + titleH + rows.length * lineH + bestH + continuityH + flavorH + pad;
    const x = Math.floor((canvasW - w) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Title.
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Morning of Day ${s.newDay}`, x + w / 2, y + pad);

    // Rows — each with a small category glyph + tinted text.
    ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ry = y + pad + titleH + i * lineH;
      const color = SUMMARY_ROW_COLOR[row.kind];
      drawRowGlyph(ctx, row.kind, x + pad + 2, ry + 2, color);
      ctx.fillStyle = color;
      ctx.fillText(row.text, x + pad + 18, ry);
    }

    // Best-moment highlight band — the standout of the slept day.
    let cursorY = y + pad + titleH + rows.length * lineH;
    if (best) {
      ctx.fillStyle = BEST_BG;
      ctx.fillRect(x + pad - 2, cursorY - 1, w - (pad - 2) * 2, lineH);
      ctx.fillStyle = BEST_COLOR;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(best, x + w / 2, cursorY + 3);
      cursorY += bestH;
    }

    // Continuity line — ties this dawn's harvest to the lifetime tally so
    // the recap connects to the last rather than reading as a receipt.
    if (continuity) {
      ctx.fillStyle = CONTINUITY_COLOR;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(continuity, x + w / 2, cursorY + 2);
      cursorY += continuityH;
    }

    // Flavor.
    ctx.fillStyle = SUBTLE;
    ctx.font = 'italic 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(s.flavor, x + w / 2, cursorY + 2);

    // Footer dismiss hint.
    ctx.fillStyle = SUBTLE;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(this.canDismiss() ? 'press SPACE to wake' : '...', x + w / 2, y + h - 14);

    ctx.restore();
  }
}

/**
 * A tiny 6x6-ish monochrome pixel glyph per category, drawn to the left
 * of each row. Kept deliberately simple (coin, sheaf, bowl, heart) so
 * they read at a glance and match the pixel-art chrome.
 */
function drawRowGlyph(
  ctx: CanvasRenderingContext2D,
  kind: SummaryRowKind,
  x: number,
  y: number,
  color: string,
): void {
  ctx.save();
  ctx.fillStyle = color;
  let px: number[][];
  switch (kind) {
    case 'gold':
      // coin — filled diamond/circle
      px = [
        [2, 0], [3, 0],
        [1, 1], [2, 1], [3, 1], [4, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2],
        [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
        [1, 4], [2, 4], [3, 4], [4, 4],
        [2, 5], [3, 5],
      ];
      break;
    case 'harvest':
      // sheaf — three stalks fanning up
      px = [
        [2, 0], [0, 1], [2, 1], [4, 1],
        [0, 2], [2, 2], [4, 2],
        [1, 3], [2, 3], [3, 3],
        [2, 4], [2, 5],
      ];
      break;
    case 'dishes':
      // bowl — rounded base with a rim
      px = [
        [0, 1], [5, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2],
        [1, 3], [2, 3], [3, 3], [4, 3],
        [2, 4], [3, 4],
      ];
      break;
    case 'hearts':
      // small heart
      px = [
        [1, 0], [2, 0], [4, 0], [5, 0],
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
        [1, 2], [2, 2], [3, 2], [4, 2], [5, 2],
        [2, 3], [3, 3], [4, 3],
        [3, 4],
      ];
      break;
    default:
      // quiet — a small moon crescent
      px = [
        [2, 0], [3, 0],
        [1, 1], [2, 1],
        [1, 2], [2, 2],
        [1, 3], [2, 3],
        [2, 4], [3, 4],
      ];
      break;
  }
  for (const [dx, dy] of px) ctx.fillRect(x + dx, y + dy, 1, 1);
  ctx.restore();
}
