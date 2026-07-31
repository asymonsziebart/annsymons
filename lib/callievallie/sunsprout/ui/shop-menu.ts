// Shop menu — modal for buying from Vallie's General Goods.
//
// Opens when the player presses E adjacent to the shop. Pip's cart and
// the village board both take priority over the shop in the E-press
// router, so this menu is the last fallback once those checks fail.
//
// Layout matches CartMenu visually so the shop and the cart feel like
// siblings — same border palette, monochrome chrome, no emoji. The
// only structural difference is a category strip at the top because
// the shop catalog is larger and benefits from tabs.

import type { Player } from '../world/world';
import {
  buildShopRows,
  buyShopItem,
  SHOP_CATEGORIES,
  shopCategoryLabel,
  type ShopBuyOutcome,
  type ShopCategory,
  type ShopRow,
} from '../game/shop';
import type { TimeOfDay } from '../game/time';
import { marketBannerLine } from '../game/weekday-market';
import { panelOpenAlpha, MODAL_OPEN_LOCKOUT_MS } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_W = 620;
const PANEL_H = 420;
const BG = 'rgba(26, 20, 38, 0.94)';
const BORDER = '#F5C9A0';
const TITLE_COLOR = '#F5C9A0';
const ROW_BG = 'rgba(40, 30, 60, 0.85)';
const ROW_BG_SELECTED = 'rgba(108, 86, 158, 0.85)';
const ROW_BORDER = '#6b5b8e';
const TEXT = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.45)';
const GOLD = '#F0C24A';
const HINT = 'rgba(245, 233, 212, 0.55)';
const TAB_BG = 'rgba(40, 30, 60, 0.6)';
const TAB_BG_ACTIVE = 'rgba(108, 86, 158, 0.85)';

/** Stable controller. Rebuilds rows on open so ownership flips refresh. */
export class ShopMenu {
  private opened = false;
  private rows: ShopRow[] = [];
  private index = 0;
  private category: ShopCategory = 'seeds';
  private lockoutMs = 0;
  private flash = '';
  private flashFade = 0;
  /** Live time reference so the daily deal banner updates if the day flips. */
  private time: TimeOfDay | null = null;

  open(player: Player, time?: TimeOfDay): void {
    this.opened = true;
    this.time = time ?? null;
    this.rows = buildShopRows(player, this.time ?? undefined);
    this.category = this.firstNonEmptyCategory() ?? 'seeds';
    this.index = this.firstRowIndex(this.category);
    this.lockoutMs = MODAL_OPEN_LOCKOUT_MS;
    this.flash = '';
    this.flashFade = 0;
  }

  close(): void {
    this.opened = false;
  }

  isVisible(): boolean {
    return this.opened;
  }

  /** Current category visible in the tab strip. */
  activeCategory(): ShopCategory {
    return this.category;
  }

  /** Rows in the active category, in display order. */
  visibleRows(): ShopRow[] {
    return this.rows.filter((r) => r.category === this.category);
  }

  /** Highlighted row, or undefined when the tab is empty. */
  selected(): ShopRow | undefined {
    return this.rows[this.index];
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) {
      this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
    }
    if (this.flashFade > 0) {
      this.flashFade = Math.max(0, this.flashFade - dtMs);
    }
  }

  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  selectPrev(): void {
    if (!this.opened) return;
    const vis = this.visibleRows();
    if (vis.length === 0) return;
    const here = vis.findIndex((r) => r.key === this.rows[this.index]?.key);
    const next = (here - 1 + vis.length) % vis.length;
    this.index = this.rows.indexOf(vis[next]);
  }

  selectNext(): void {
    if (!this.opened) return;
    const vis = this.visibleRows();
    if (vis.length === 0) return;
    const here = vis.findIndex((r) => r.key === this.rows[this.index]?.key);
    const next = (here + 1) % vis.length;
    this.index = this.rows.indexOf(vis[next]);
  }

  /** Tab forward through non-empty categories. */
  nextCategory(): void {
    if (!this.opened) return;
    const order = SHOP_CATEGORIES;
    for (let step = 1; step <= order.length; step++) {
      const i = (order.indexOf(this.category) + step) % order.length;
      const c = order[i];
      if (this.rows.some((r) => r.category === c)) {
        this.category = c;
        this.index = this.firstRowIndex(c);
        return;
      }
    }
  }

  prevCategory(): void {
    if (!this.opened) return;
    const order = SHOP_CATEGORIES;
    for (let step = 1; step <= order.length; step++) {
      const i = (order.indexOf(this.category) - step + order.length) % order.length;
      const c = order[i];
      if (this.rows.some((r) => r.category === c)) {
        this.category = c;
        this.index = this.firstRowIndex(c);
        return;
      }
    }
  }

  /** Buy the highlighted row and rebuild the catalog so singletons disappear. */
  confirm(player: Player): ShopBuyOutcome {
    if (!this.opened) return { kind: 'unknown-item' };
    const sel = this.selected();
    if (!sel) return { kind: 'unknown-item' };
    const out = buyShopItem(player, this.rows, sel.key);
    if (out.kind === 'bought') {
      this.setFlash(`Bought ${out.row.label} (-${out.row.price}g)`);
      // Recompute rows so a singleton purchase vanishes from the list.
      const refreshed = buildShopRows(player, this.time ?? undefined);
      this.rows = refreshed;
      // Keep the player on the same category; pick a sensible row.
      const stillThere = refreshed.find((r) => r.key === sel.key);
      if (stillThere) {
        this.index = refreshed.indexOf(stillThere);
      } else {
        this.index = this.firstRowIndex(this.category);
        if (this.index === -1) {
          // Category emptied — jump to the next non-empty one.
          this.nextCategory();
        }
      }
    } else if (out.kind === 'not-enough-gold') {
      this.setFlash(`Need ${out.need}g (you have ${out.have}g)`);
    } else if (out.kind === 'already-owned') {
      this.setFlash(`You already own a ${out.row.label}.`);
    }
    return out;
  }

  private setFlash(s: string): void {
    this.flash = s;
    this.flashFade = 1800;
  }

  private firstRowIndex(c: ShopCategory): number {
    return this.rows.findIndex((r) => r.category === c);
  }

  private firstNonEmptyCategory(): ShopCategory | null {
    for (const c of SHOP_CATEGORIES) {
      if (this.rows.some((r) => r.category === c)) return c;
    }
    return null;
  }

  /** Renders the menu over the world. No-op when closed. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - PANEL_H) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout, the same hook the info-panel
    // family + hearts use; reduce-motion snaps it solid. Scoped by the
    // save/restore so the scrim + panel both ease in together and nothing
    // leaks past this draw.
    ctx.globalAlpha = panelOpenAlpha(
      this.lockoutMs,
      getSettings(player).reduceMotion,
      MODAL_OPEN_LOCKOUT_MS,
    );
    ctx.fillStyle = 'rgba(10, 6, 18, 0.45)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = BG;
    ctx.fillRect(x, y, PANEL_W, PANEL_H);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, PANEL_W - 2, PANEL_H - 2);
    ctx.fillStyle = BORDER;
    ctx.fillRect(x + 4, y + 4, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + 4, 4, 4);
    ctx.fillRect(x + 4, y + PANEL_H - 8, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + PANEL_H - 8, 4, 4);

    ctx.font = 'bold 16px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillStyle = TITLE_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText("Vallie's General Goods", x + 18, y + 14);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.fillText('Tab/Shift+Tab category, Up/Down item, Enter buy, Esc leave.', x + 18, y + 36);
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(`${player.gold}g`, x + PANEL_W - 18, y + 18);

    // Daily-deal banner — sits just under the hint strip, gold text.
    if (this.time) {
      const banner = marketBannerLine(this.time);
      if (banner) {
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.fillStyle = GOLD;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(banner, x + 18, y + 50);
      }
    }

    // Tab strip.
    const tabsTop = y + 58;
    const tabH = 22;
    let tx = x + 18;
    ctx.textBaseline = 'middle';
    for (const c of SHOP_CATEGORIES) {
      const count = this.rows.filter((r) => r.category === c).length;
      if (count === 0) continue;
      const label = `${shopCategoryLabel(c)} (${count})`;
      ctx.font = 'bold 11px ui-monospace, monospace';
      const w = ctx.measureText(label).width + 18;
      const active = c === this.category;
      ctx.fillStyle = active ? TAB_BG_ACTIVE : TAB_BG;
      ctx.fillRect(tx, tabsTop, w, tabH);
      ctx.strokeStyle = active ? BORDER : ROW_BORDER;
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(tx + 0.5, tabsTop + 0.5, w - 1, tabH - 1);
      ctx.fillStyle = active ? TEXT : DIM;
      ctx.textAlign = 'center';
      ctx.fillText(label, tx + w / 2, tabsTop + tabH / 2);
      tx += w + 6;
    }

    // Rows.
    const rowH = 50;
    const rowsTop = tabsTop + tabH + 12;
    const visible = this.visibleRows();
    const maxRows = 5;
    // Simple windowing — keep the highlighted row in view.
    const selKey = this.selected()?.key;
    let startIdx = 0;
    const selVisIdx = visible.findIndex((r) => r.key === selKey);
    if (selVisIdx >= maxRows) startIdx = selVisIdx - maxRows + 1;
    const slice = visible.slice(startIdx, startIdx + maxRows);
    for (let i = 0; i < slice.length; i++) {
      const item = slice[i];
      const affordable = player.gold >= item.price;
      const rowX = x + 14;
      const rowY = rowsTop + i * (rowH + 4);
      const rowW = PANEL_W - 28;
      const selected = item.key === selKey;
      ctx.fillStyle = selected ? ROW_BG_SELECTED : ROW_BG;
      ctx.fillRect(rowX, rowY, rowW, rowH);
      ctx.strokeStyle = selected ? BORDER : ROW_BORDER;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(rowX + 0.5, rowY + 0.5, rowW - 1, rowH - 1);

      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.fillStyle = affordable ? TEXT : DIM;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, rowX + 10, rowY + 8);
      ctx.textAlign = 'right';
      if (item.isDeal) {
        // Strike through the base price next to the discounted one.
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillStyle = DIM;
        const baseLabel = `${item.basePrice}g`;
        const baseW = ctx.measureText(baseLabel).width;
        const baseX = rowX + rowW - 10 - ctx.measureText(`${item.price}g`).width - 6 - baseW;
        ctx.fillText(baseLabel, baseX + baseW, rowY + 10);
        // Line through.
        ctx.fillRect(baseX, rowY + 14, baseW, 1);
        ctx.font = 'bold 13px ui-monospace, monospace';
        ctx.fillStyle = affordable ? GOLD : DIM;
        ctx.fillText(`${item.price}g`, rowX + rowW - 10, rowY + 8);
        // "DEAL" tag pinned to the row's top-right corner.
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.fillStyle = TITLE_COLOR;
        ctx.fillText('DEAL', rowX + rowW - 10, rowY - 4);
      } else {
        ctx.fillStyle = affordable ? GOLD : DIM;
        ctx.fillText(`${item.price}g`, rowX + rowW - 10, rowY + 8);
      }

      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = affordable ? TEXT : DIM;
      ctx.textAlign = 'left';
      ctx.fillText(item.flavor, rowX + 10, rowY + 28);

      const owned = player.inventory[item.key] ?? 0;
      if (owned > 0) {
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillStyle = TITLE_COLOR;
        ctx.textAlign = 'right';
        ctx.fillText(`x${owned}`, rowX + rowW - 10, rowY + 30);
      }
    }
    if (visible.length === 0) {
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillStyle = HINT;
      ctx.textAlign = 'center';
      ctx.fillText('No items in this tab.', x + PANEL_W / 2, rowsTop + 16);
    }
    if (visible.length > maxRows) {
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = HINT;
      ctx.textAlign = 'right';
      ctx.fillText(
        `${selVisIdx + 1}/${visible.length}`,
        x + PANEL_W - 18,
        rowsTop + maxRows * (rowH + 4) - 6,
      );
    }

    // Flash strip — recent buy / error feedback.
    if (this.flashFade > 0 && this.flash) {
      const alpha = Math.min(1, this.flashFade / 600);
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = `rgba(245, 233, 212, ${alpha.toFixed(2)})`;
      ctx.textAlign = 'center';
      ctx.fillText(this.flash, x + PANEL_W / 2, y + PANEL_H - 44);
    }

    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.textAlign = 'center';
    ctx.fillText('Tab category | Up/Down item | Enter buy | Esc leave', x + PANEL_W / 2, y + PANEL_H - 22);

    ctx.restore();
  }
}
