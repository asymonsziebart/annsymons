// Lore / bestiary panel — backtick (`) toggles the village discovery
// log. Tabs across categories (Fish / Gems / Forage / Crops / Folk),
// each with a scrollable list of rows. Locked rows show a teaser; once
// discovered they expand to a one-liner description plus the live
// inventory / heart count.

import type { Player } from '../world/world';
import {
  LORE_CATEGORIES,
  type LoreCategory,
  applyRumorFilter,
  buildLoreRows,
  loreCompletionSummary,
  loreCompletionSummaryLine,
  loreProgress,
  loreTabDetailLine,
  loreTabFooter,
  nextRumorFilter,
  rumorFilterLabel,
  type RumorFilter,
} from '../game/lore';
import { tabStripLayout, type TabStripItem } from '../game/panel-tabs';
import { drawTabStrip } from './panel-tab-strip';
import { loreEmptyState } from '../game/panel-empty';
import { drawEmptyState } from './empty-state';
import { loreRowGlyph } from '../game/bag-glyph';
import { drawBagGlyph } from '../render/bag-glyph-sprite';
import { panelOpenAlpha } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.4)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const ROW_PIP_ON = '#F0C24A';
const ROW_PIP_OFF = '#7a6a9a';

const PANEL_W = 520;
const ROW_H = 30;
const VISIBLE_ROWS = 7;

export class LorePanel {
  private opened = false;
  private lockoutMs = 0;
  private tab: LoreCategory = LORE_CATEGORIES[0];
  private scroll = 0;
  /** Three-way Rumors-tab filter. Resets to 'all' on open. */
  private rumorFilter: RumorFilter = 'all';

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.scroll = 0;
    this.rumorFilter = 'all';
  }

  close(): void {
    this.opened = false;
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  isVisible(): boolean {
    return this.opened;
  }

  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  /** Cycle through tabs left -> right. */
  nextTab(): void {
    if (!this.opened) return;
    const idx = LORE_CATEGORIES.indexOf(this.tab);
    this.tab = LORE_CATEGORIES[(idx + 1) % LORE_CATEGORIES.length];
    this.scroll = 0;
  }

  prevTab(): void {
    if (!this.opened) return;
    const idx = LORE_CATEGORIES.indexOf(this.tab);
    this.tab = LORE_CATEGORIES[(idx - 1 + LORE_CATEGORIES.length) % LORE_CATEGORIES.length];
    this.scroll = 0;
  }

  scrollDown(player: Player): void {
    if (!this.opened) return;
    const total = this.rowsForTab(player).length;
    this.scroll = Math.min(Math.max(0, total - VISIBLE_ROWS), this.scroll + 1);
  }

  scrollUp(): void {
    if (!this.opened) return;
    this.scroll = Math.max(0, this.scroll - 1);
  }

  /**
   * Cycle the rumors-tab filter (all -> bought -> skipped -> all).
   * No-op on tabs that aren't Rumors so the keypress doesn't fight
   * for shared keys on other tabs. Resets scroll to 0 so the new
   * filtered list starts at the top.
   */
  cycleRumorFilter(): void {
    if (!this.opened) return;
    if (this.tab !== 'Rumors') return;
    this.rumorFilter = nextRumorFilter(this.rumorFilter);
    this.scroll = 0;
  }

  /** Read-only filter accessor — used by tests / footer rendering. */
  currentRumorFilter(): RumorFilter {
    return this.rumorFilter;
  }

  /** Active-tab rows from the lore catalogue, post-filter. */
  private rowsForTab(player: Player) {
    const all = buildLoreRows(player).filter((r) => r.category === this.tab);
    return applyRumorFilter(all, this.rumorFilter);
  }

  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const rows = this.rowsForTab(player);
    const visibleN = Math.min(VISIBLE_ROWS, rows.length);
    // Reserve an extra footer row when the Gems tab has a per-gem
    // composition breakdown to surface beneath the career + ribbon
    // header. The detail line draws right above the career footer.
    const tabFooter = loreTabFooter(player, this.tab);
    const tabDetail = loreTabDetailLine(player, this.tab);
    const detailExtra = tabDetail.length > 0 ? 14 : 0;
    // When a filter empties the list, reserve two body rows so the shared
    // empty state (message + hint) has room to breathe instead of being
    // crushed against the tab strip.
    const empty = loreEmptyState(this.tab, this.rumorFilter, rows.length);
    const bodyRows = rows.length === 0 ? 2 : visibleN;
    const h = 88 + bodyRows * ROW_H + 22 + detailExtra;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout; reduce-motion snaps it solid.
    ctx.globalAlpha = panelOpenAlpha(this.lockoutMs, getSettings(player).reduceMotion);
    ctx.fillStyle = 'rgba(10, 6, 18, 0.32)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    // Title + overall progress.
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText('village lore  (`)', x + 14, y + 12);

    // Header digest — overall discovered count + percent + how many tabs
    // are fully complete, the "surface the panel's shape" move the almanac
    // count-summary + quest-log %-complete headers make. Replaces the bare
    // "N% discovered" stat in the same right-aligned header slot, so it's
    // strictly more glanceable with no layout change. Rumors excluded (a
    // visit log, not a catalogue) so a skipped headliner can't drag it.
    const summaryLine = loreCompletionSummaryLine(loreCompletionSummary(player));
    ctx.fillStyle = HINT;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(summaryLine, x + PANEL_W - 14, y + 14);

    // Tabs — laid out + drawn through the shared panel tab-strip so the
    // lore panel and the bag panel speak one tab dialect. The layout
    // (origin x+14 / y+38, width PANEL_W-28, gap 4, height 26) reproduces
    // this panel's historical strip pixel-for-pixel.
    const progress = loreProgress(player);
    const tabItems: TabStripItem[] = LORE_CATEGORIES.map((cat, i) => ({
      label: cat,
      sub: `${progress[i].discovered}/${progress[i].total}`,
    }));
    const activeIdx = LORE_CATEGORIES.indexOf(this.tab);
    const tabRects = tabStripLayout(tabItems, x + 14, y + 38, PANEL_W - 28, activeIdx);
    drawTabStrip(ctx, tabRects);

    // Rows — or a calm shared empty state when a filter emptied the list.
    if (empty) {
      drawEmptyState(ctx, empty, x + PANEL_W / 2, y + 78 + 6);
    }
    const start = this.scroll;
    const end = Math.min(rows.length, start + visibleN);
    for (let i = start; i < end; i++) {
      const r = rows[i];
      const ry = y + 78 + (i - start) * ROW_H;
      // Discovery glyph — discovered Fish/Gems/Forage/Crops rows draw the
      // actual catalog sprite (fish/gem silhouette, forage + crop sprites)
      // so the bestiary scans visually like the bag; Folk / Rumors rows
      // and any locked row fall back to the plain pip. The glyph sits in
      // the same left margin the pip used, so the name column never shifts.
      const glyph = r.discovered ? loreRowGlyph(r.category, r.id) : null;
      if (glyph) {
        drawBagGlyph(ctx, x + 17, ry + 9, glyph);
      } else {
        ctx.fillStyle = r.discovered ? ROW_PIP_ON : ROW_PIP_OFF;
        ctx.fillRect(x + 14, ry + 8, 6, 6);
      }

      ctx.fillStyle = r.discovered ? TEXT_COLOR : DIM;
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(r.discovered ? r.name : '???', x + 28, ry + 2);

      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(r.discovered ? r.description : r.teaser, x + 28, ry + 16);

      // Tier color chip — currently set on Folk rows for the per-NPC
      // owl fluency tier (bronze / silver / gold). Tiny diamond-style
      // square drawn just to the LEFT of the count chip so the
      // existing count layout doesn't shift. Skipped when no tier
      // achieved so casual Folk friends keep a clean row.
      if (r.discovered && r.tierColor) {
        // Outline first (slightly larger dark frame) so the chip
        // reads as a deliberate badge rather than a flat color
        // splotch on the panel background.
        ctx.fillStyle = '#1a1426';
        ctx.fillRect(x + PANEL_W - 38, ry + 6, 8, 8);
        ctx.fillStyle = r.tierColor;
        ctx.fillRect(x + PANEL_W - 37, ry + 7, 6, 6);
      }

      if (r.discovered && r.count !== undefined && r.count > 0) {
        ctx.fillStyle = ROW_PIP_ON;
        ctx.textAlign = 'right';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(`x${r.count}`, x + PANEL_W - 14, ry + 6);
      }
    }

    // Per-tab footer line — currently surfaces a lifetime mining recap
    // on the Gems tab and a filter chip on the Rumors tab. Other tabs
    // return an empty string and skip the draw. Sits just above the
    // scroll indicator + bottom hint so it doesn't compete with the
    // row strip.
    if (tabFooter.length > 0) {
      ctx.fillStyle = ROW_PIP_ON;
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tabFooter, x + PANEL_W / 2, y + h - 44 - detailExtra);
    }
    // Per-tab secondary detail line — currently the Gems tab surfaces
    // a per-gem breakdown of the bestRun composition right under the
    // career + ribbon footer. Empty on other tabs / non-record saves.
    if (tabDetail.length > 0) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tabDetail, x + PANEL_W / 2, y + h - 44);
    }
    // Rumors-tab filter chip — only meaningful on the Rumors tab; the
    // chip surfaces even on 'all' so the player has a visible reminder
    // that the filter cycle exists.
    if (this.tab === 'Rumors') {
      ctx.fillStyle = ROW_PIP_ON;
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `filter: ${rumorFilterLabel(this.rumorFilter)}  (f to cycle)`,
        x + PANEL_W / 2,
        y + h - 44,
      );
    }

    // Scroll indicator if list overflows.
    if (rows.length > visibleN) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const top = start === 0 ? '' : 'up ';
      const bot = end >= rows.length ? '' : 'down';
      ctx.fillText(`${top}${bot}`.trim(), x + PANEL_W / 2, y + h - 30);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    const closeHint = this.tab === 'Rumors'
      ? '` / Esc to close - a/d switch tabs - w/s scroll - f cycle filter'
      : '` / Esc to close - a/d switch tabs - w/s scroll';
    ctx.fillText(closeHint, x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }
}
