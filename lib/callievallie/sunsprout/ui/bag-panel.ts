// Inventory / bag panel — `Tab` toggles a single categorized view of
// everything the player owns.
//
// Until now the game had panels for the meta layer (recipes, crops,
// money, lore) but no plain "what's in my bag" screen — produce, fish,
// gems, forage, dishes, eggs, kits and tickets all lived only as opaque
// inventory keys the player never saw listed. This panel walks the pure
// bag model (game/bag.ts), groups stacks into tabs (Seeds / Crops / Fish
// / Gems / Forage / Kitchen / Supplies) drawn through the shared tab
// strip, and renders a scrollable list of label + count (+ unit value)
// rows. Same dark-violet chrome + a/d-tab + w/s-scroll language as the
// lore panel.

import type { Player } from '../world/world';
import {
  BAG_CATEGORIES,
  bagItemsForCategory,
  bagCategoryCounts,
  bagTotalStacks,
  bagTotalValue,
  bagCategoryValue,
  bagItemWorth,
  bagWorthShares,
  bagWorthCaption,
  bagSellHint,
  bagSortLabel,
  bagSortDirection,
  cycleBagSort,
  bagSearchResults,
  bagSearchMatchCount,
  bagSearchCategoryCounts,
  maxBagRowCount,
  bagCountBarWidth,
  type BagCategory,
  type BagSortMode,
  type BagSortDirection,
  type BagItem,
} from '../game/bag';
import { tabStripLayout, cycleTabIndex, type TabStripItem } from '../game/panel-tabs';
import { drawTabStrip } from './panel-tab-strip';
import { bagGlyph, bagCategoryGlyph } from '../game/bag-glyph';
import { drawBagGlyph } from '../render/bag-glyph-sprite';
import { bagEmptyState } from '../game/panel-empty';
import { drawEmptyState } from './empty-state';
import { panelOpenAlpha } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const HINT = 'rgba(245, 233, 212, 0.55)';
const GOLD = '#F0C24A';
const SORT_CHIP = 'rgba(200, 182, 232, 0.7)';
const SELL_HINT = 'rgba(159, 205, 122, 0.66)';
const SEARCH_COLOR = '#A3D77A';
/** Faint track behind the per-row count bar (the tinted fill rides the category palette). */
const COUNT_BAR_TRACK = 'rgba(74, 59, 110, 0.4)';

/**
 * Per-category tint for the worth share bar — distinct, readable hues in
 * the cozy palette so each slice is identifiable against the legend chip.
 * Seeds / Supplies never carry worth so they're muted neutrals (they
 * won't appear in the bar, but the map is total for type-safety).
 */
const CATEGORY_COLOR: Record<BagCategory, string> = {
  Seeds: '#7a6a9a',
  Crops: '#A3D77A',
  Fish: '#6FB8D8',
  Gems: '#E07AB0',
  Forage: '#D8A24A',
  Kitchen: '#F0C24A',
  Supplies: '#9D8FB8',
};

const PANEL_W = 460;
const ROW_H = 26;
const VISIBLE_ROWS = 7;

export class BagPanel {
  private opened = false;
  private lockoutMs = 0;
  private tabIndex = 0;
  private scroll = 0;
  private sortMode: BagSortMode = 'count';
  /**
   * Cross-tab type-to-filter. `searchActive` arms the input-capturing mode
   * (claimed with `/` so the bag's `f`=sort + a/d/w/s nav stay free); while
   * armed, typed letters/digits build `search` and the list shows matches
   * across ALL tabs. Empty `search` while armed shows a prompt.
   */
  private searchActive = false;
  private search = '';

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.scroll = 0;
    this.searchActive = false;
    this.search = '';
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

  /** Currently selected category — exposed for tests. */
  currentCategory(): BagCategory {
    return BAG_CATEGORIES[this.tabIndex];
  }

  /** Active within-category sort mode — exposed for tests. */
  currentSort(): BagSortMode {
    return this.sortMode;
  }

  /** Whether the type-to-filter search mode is armed. Exposed for tests. */
  isSearching(): boolean {
    return this.searchActive;
  }

  /** Current search query (lowercased). Exposed for tests. */
  currentSearch(): string {
    return this.search;
  }

  /**
   * Toggle the search mode on/off (the `/` key). Turning it off clears the
   * query + resets scroll so the player drops back to the tabbed view.
   */
  toggleSearch(): void {
    if (!this.opened) return;
    this.searchActive = !this.searchActive;
    this.search = '';
    this.scroll = 0;
  }

  /**
   * Append a typed letter/digit to the search while armed. Only single
   * printable alphanumerics are accepted (mirrors the help-overlay), so
   * modifier names like 'enter' / 'shift' never pollute the query. Resets
   * scroll so new matches start from the top. Returns true when the query
   * changed.
   */
  typeChar(key: string): boolean {
    if (!this.opened || !this.searchActive) return false;
    if (key.length !== 1) return false;
    if (!/[a-z0-9 ]/.test(key)) return false;
    this.search += key;
    this.scroll = 0;
    return true;
  }

  /** Delete the last search character (Backspace). Returns true if changed. */
  backspaceSearch(): boolean {
    if (!this.opened || !this.searchActive || this.search.length === 0) return false;
    this.search = this.search.slice(0, -1);
    this.scroll = 0;
    return true;
  }

  /**
   * Esc handling inside the bag: first clears a non-empty query, then exits
   * search mode, then (handled by the caller) closes the panel. Returns
   * true when it consumed the Esc so the caller doesn't also close.
   */
  clearSearch(): boolean {
    if (!this.opened || !this.searchActive) return false;
    if (this.search.length > 0) {
      this.search = '';
      this.scroll = 0;
      return true;
    }
    this.searchActive = false;
    this.scroll = 0;
    return true;
  }

  /** Cycle the within-category sort (count -> value -> A-Z). Resets scroll. */
  cycleSort(): void {
    if (!this.opened) return;
    this.sortMode = cycleBagSort(this.sortMode);
    this.scroll = 0;
  }

  nextTab(): void {
    if (!this.opened) return;
    this.tabIndex = cycleTabIndex(this.tabIndex, BAG_CATEGORIES.length, 1);
    this.scroll = 0;
  }

  prevTab(): void {
    if (!this.opened) return;
    this.tabIndex = cycleTabIndex(this.tabIndex, BAG_CATEGORIES.length, -1);
    this.scroll = 0;
  }

  /** The rows the body currently shows: search matches, or the active tab. */
  private visibleRows(player: Player): BagItem[] {
    if (this.searchActive) return bagSearchResults(player, this.search, this.sortMode);
    return bagItemsForCategory(player, this.currentCategory(), this.sortMode);
  }

  scrollDown(player: Player): void {
    if (!this.opened) return;
    const total = this.visibleRows(player).length;
    this.scroll = Math.min(Math.max(0, total - VISIBLE_ROWS), this.scroll + 1);
  }

  scrollUp(): void {
    if (!this.opened) return;
    this.scroll = Math.max(0, this.scroll - 1);
  }

  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const searching = this.searchActive;
    // Body rows: cross-tab search matches while armed, else the active tab.
    const rows = this.visibleRows(player);
    const visibleN = Math.min(VISIBLE_ROWS, Math.max(rows.length, 1));
    // Reserve a footer band for the scroll indicator, the where-to-sell
    // hint, and the controls line (three stacked 14-16px rows).
    const h = 88 + visibleN * ROW_H + 36;
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

    // Title + a glanceable total-stacks / total-worth readout.
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText('bag  (Tab)', x + 14, y + 12);

    // Chip right of the title: while searching it's a live "search: q_  (N)"
    // chip (cross-tab match count) so the query + hits are legible; else the
    // dim sort-mode chip (by count / by value / A-Z) the `f` cycle drives.
    ctx.font = 'bold 14px ui-monospace, monospace';
    const titleW = ctx.measureText('bag  (Tab)').width;
    if (searching) {
      const matches = bagSearchMatchCount(player, this.search);
      ctx.fillStyle = SEARCH_COLOR;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(`search: ${this.search}_  (${matches})`, x + 14 + titleW + 8, y + 15);
    } else {
      ctx.fillStyle = SORT_CHIP;
      ctx.font = '10px ui-monospace, monospace';
      const sortLabel = `- ${bagSortLabel(this.sortMode)}`;
      const sortChipX = x + 14 + titleW + 8;
      ctx.fillText(sortLabel, sortChipX, y + 16);
      // Direction indicator just right of the label so the ordering isn't
      // implicit: a down-arrow for the count/value descending sorts (biggest
      // first), a small "A-Z" glyph for the alphabetical name sort. Pure
      // render off bagSortDirection so it can never disagree with the actual
      // row order.
      const dirX = sortChipX + ctx.measureText(sortLabel).width + 5;
      this.drawSortDirection(ctx, bagSortDirection(this.sortMode), dirX, y + 16);
    }

    const stacks = bagTotalStacks(player);
    const worth = bagTotalValue(player);
    ctx.fillStyle = HINT;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${stacks} stacks  -  ~${worth}g`, x + PANEL_W - 14, y + 14);

    // Worth-share caption — names the top one/two categories by worth so a
    // colour-blind player reads the share bar's hues as words ("most worth
    // in Gems, then Crops"), tucked dim under the stacks readout. Quiet on a
    // worthless bag (no bar) and while searching (no single active focus).
    if (!searching) {
      const caption = bagWorthCaption(player);
      if (caption) {
        ctx.fillStyle = SORT_CHIP;
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(caption, x + PANEL_W - 14, y + 26);
      }
    }

    // Worth share bar — a tiny stacked bar in the gap under the title
    // showing each category's SHARE of the whole-bag worth, so "where's
    // my money" reads visually (like the crop-journal harvest mini-bar).
    // The active tab's slice is outlined so the player can locate the
    // current category in the mix. Drawn only when the bag has worth.
    const BAR_FULL_W = PANEL_W - 28;
    const shares = bagWorthShares(player, BAR_FULL_W);
    if (shares.length > 0) {
      const barX = x + 14;
      const barY = y + 30;
      const barH = 4;
      // Faint track behind the segments.
      ctx.fillStyle = 'rgba(74, 59, 110, 0.45)';
      ctx.fillRect(barX, barY, BAR_FULL_W, barH);
      let sx = barX;
      for (const seg of shares) {
        ctx.fillStyle = CATEGORY_COLOR[seg.category];
        ctx.fillRect(sx, barY, seg.width, barH);
        // Outline the active tab's slice so it stands out in the mix. The
        // outline is meaningless while searching (no single active tab), so
        // it's suppressed then.
        if (!searching && seg.category === this.currentCategory()) {
          ctx.strokeStyle = TEXT_COLOR;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx - 0.5, barY - 1.5, seg.width + 1, barH + 3);
        }
        sx += seg.width;
      }
    }

    // Tabs through the shared strip — one per bag category. The sub line
    // normally shows each category's non-zero stack count; while `/` search
    // is active it instead shows how many of the cross-tab MATCHES live in
    // that category, so the player sees the match distribution (e.g. typing
    // "ruby" concentrates the hits under Gems). Tabs stay (dim, non-active)
    // while searching so the player keeps spatial context for the results.
    const counts = bagCategoryCounts(player);
    const matchCounts = searching
      ? bagSearchCategoryCounts(player, this.search)
      : null;
    const tabItems: TabStripItem[] = BAG_CATEGORIES.map((cat) => ({
      label: cat,
      sub: String((matchCounts ?? counts)[cat]),
    }));
    // While searching, pass -1 so no tab reads as active (no current tab).
    const tabRects = tabStripLayout(tabItems, x + 14, y + 38, PANEL_W - 28, searching ? -1 : this.tabIndex);
    drawTabStrip(ctx, tabRects);

    // Per-tab worth caption in the gap between the strip and the rows —
    // "Gems: 412g in this tab" — so the player sees where their money is
    // sitting. Quiet on valueless tabs (Seeds / Supplies sum to 0g), on an
    // empty tab, and while searching (no single active tab).
    const tabWorth = searching ? 0 : bagCategoryValue(player, this.currentCategory());
    if (tabWorth > 0) {
      ctx.fillStyle = GOLD;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${this.currentCategory()}: ${tabWorth}g in this tab`,
        x + PANEL_W - 14,
        y + 67,
      );
    }

    // Rows, a search prompt/no-match note, or a calm category empty state.
    if (rows.length === 0) {
      if (searching) {
        // Distinguish "type something" from "nothing matched" so the search
        // mode never reads as a broken empty panel.
        ctx.fillStyle = HINT;
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        const msg = this.search.length === 0
          ? 'type to search your whole bag'
          : `no items match "${this.search}"`;
        ctx.fillText(msg, x + PANEL_W / 2, y + 84);
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText('Backspace deletes - Esc clears - / exits search', x + PANEL_W / 2, y + 100);
      } else {
        // A large, dim version of the tab's representative glyph behind the
        // text so an empty tab reads as "this holds fish, you have none" at
        // a glance, not just a sentence. The crate-only Seeds/Supplies tabs
        // get the generic crate, which still says "stuff goes here".
        ctx.save();
        ctx.globalAlpha *= 0.18;
        ctx.translate(x + PANEL_W / 2, y + 78 + 2);
        ctx.scale(2.6, 2.6);
        drawBagGlyph(ctx, 0, 0, bagCategoryGlyph(this.currentCategory()));
        ctx.restore();
        drawEmptyState(ctx, bagEmptyState(this.currentCategory()), x + PANEL_W / 2, y + 78 + 6);
      }
    } else {
      const start = this.scroll;
      const end = Math.min(rows.length, start + visibleN);
      // Shared denominator for the per-row count bars: the fullest stack in
      // the CURRENTLY shown slice (active tab, or the cross-tab matches), so
      // each row's fill reads relative to what's on screen.
      const maxRowCount = maxBagRowCount(rows);
      for (let i = start; i < end; i++) {
        const r = rows[i];
        const ry = y + 78 + (i - start) * ROW_H;
        if (i > start) {
          ctx.fillStyle = 'rgba(74, 59, 110, 0.4)';
          ctx.fillRect(x + 14, ry - 2, PANEL_W - 28, 1);
        }
        // Glyph pip + label on the left. The glyph is a tiny recognisable
        // sprite (crop / fish / gem / egg / dish / crate) so the list scans
        // like the hotbar; it's centred in a ~16px gutter and the label
        // starts to its right.
        drawBagGlyph(ctx, x + 22, ry + 9, bagGlyph(r));
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(r.label, x + 34, ry + 3);
        // While searching the list is cross-tab, so tag each row with its
        // category (dim, tinted to the share-bar palette) so the player
        // knows which tab a match lives under.
        if (searching) {
          ctx.fillStyle = CATEGORY_COLOR[r.category];
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillText(r.category, x + 34, ry + 16);
        }

        // Count, then a value figure, on the right. Under the value sort we
        // emphasise each row's TOTAL worth (count * unitValue) — the figure
        // the ordering actually keys on — in bright bold gold, so a player
        // sorting by value can see why the rows landed in that order. Under
        // the other sorts the per-unit "Ng ea" price stays (quieter, dim).
        ctx.fillStyle = TITLE_COLOR;
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'right';
        const countX = x + PANEL_W - 14;
        ctx.fillText(`x${r.count}`, countX, ry + 3);
        if (r.unitValue > 0) {
          if (this.sortMode === 'value') {
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 11px ui-monospace, monospace';
            ctx.fillText(`${bagItemWorth(r)}g`, countX - 44, ry + 3);
          } else {
            ctx.fillStyle = GOLD;
            ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(`${r.unitValue}g ea`, countX - 44, ry + 4);
          }
        }
        // Count bar — a tiny gauge under the x{count} figure showing this
        // stack's size relative to the fullest stack on screen, so the
        // player reads relative quantities at a glance (which stack is big,
        // which is nearly out) the way the crop-journal harvest bar shows
        // tier mix. A faint full-width track keeps a small stack legible as
        // "short, not missing"; skipped when there's nothing to scale
        // against (a single-row slice fills it, which reads fine).
        const CB_W = 40;
        const CB_H = 3;
        const cbFill = bagCountBarWidth(r.count, maxRowCount, CB_W);
        if (cbFill > 0) {
          const cbX = countX - CB_W;
          const cbY = ry + 18;
          ctx.fillStyle = COUNT_BAR_TRACK;
          ctx.fillRect(cbX, cbY, CB_W, CB_H);
          // Fill tinted to the row's category colour (the share-bar palette)
          // so a cross-tab search match reads its category from the bar as
          // well as the dim tag. On a single tab every row shares the tab's
          // hue, so the gauge stays uniform there.
          ctx.fillStyle = CATEGORY_COLOR[r.category];
          ctx.fillRect(cbX + CB_W - cbFill, cbY, cbFill, CB_H);
        }
      }
    }

    // Scroll indicator when the list overflows the visible window.
    if (rows.length > visibleN) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const top = this.scroll === 0 ? '' : 'up ';
      const bot = this.scroll + visibleN >= rows.length ? '' : 'down';
      ctx.fillText(`${top}${bot}`.trim(), x + PANEL_W / 2, y + h - 44);
    }

    // Where-to-sell hint — closes the loop between seeing a stack's worth
    // and realising it. Quiet on tabs that aren't a sell loop (Seeds /
    // Supplies return null), on an empty tab, and while searching (the
    // cross-tab list has no single sell counter).
    const sellHint = !searching && rows.length > 0 ? bagSellHint(this.currentCategory()) : null;
    if (sellHint) {
      ctx.fillStyle = SELL_HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(sellHint, x + PANEL_W / 2, y + h - 28);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    const controls = searching
      ? 'type to filter - Backspace deletes - Esc clears - / exits search'
      : 'Tab / Esc to close - a/d tabs - w/s scroll - f sort - / search';
    ctx.fillText(controls, x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }

  /**
   * Draw the active sort's direction indicator at left edge (dx, top dy):
   *   - 'desc': a small down-chevron (count + value put the biggest first).
   *   - 'az':   a tiny "a" over "z" stack with a down-tick, reading A->Z.
   * Tinted like the sort chip so it reads as part of the same widget. Pure
   * pixel art (no glyph font / emoji) so it renders crisp at any HUD scale.
   */
  private drawSortDirection(
    ctx: CanvasRenderingContext2D,
    dir: BagSortDirection,
    dx: number,
    dy: number,
  ): void {
    ctx.save();
    ctx.fillStyle = SORT_CHIP;
    if (dir === 'desc') {
      // Down-chevron: a 7px-wide arrowhead pointing down (biggest first).
      const v = [
        [0, 1], [6, 1],
        [1, 2], [5, 2],
        [2, 3], [4, 3],
        [3, 4],
      ];
      for (const [px, py] of v) ctx.fillRect(dx + px, dy + py, 1, 1);
    } else {
      // A->Z: a compact "A" then "Z" with a down-tick between, so the
      // alphabetical-ascending order reads without a word.
      ctx.font = 'bold 8px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('A', dx, dy + 1);
      ctx.fillText('Z', dx + 9, dy + 1);
      // Tiny down-tick between the two letters.
      const tx = dx + 6;
      const tick = [[0, 2], [1, 2], [2, 2], [1, 3]];
      for (const [px, py] of tick) ctx.fillRect(tx + px, dy + py, 1, 1);
    }
    ctx.restore();
  }
}
