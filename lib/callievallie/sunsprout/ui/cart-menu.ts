// Cart menu — modal for buying from Pip's travelling cart.
//
// Opens when the player walks onto a tile next to the parked cart and
// presses E. Up/Down picks a row, Enter buys one of the highlighted
// item. Esc closes. Tests cover the controller; the canvas draw is
// exercised through wider build smoke.

import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import { CART_CATALOG, type CartItem, buyFromCart, type CartBuyOutcome, staminaTeaTradeInLine } from '../game/cart';
import { ownsDecor } from '../game/decor';
import { isCurrentHeadlinerKey, rumorFooterLine, rumorHistorySummary, rumorRebateAmount, rumorStreakLine } from '../game/cart-rumor';
import { panelOpenAlpha, MODAL_OPEN_LOCKOUT_MS } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_W = 560;
const PANEL_H = 380;
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

export class CartMenu {
  private opened = false;
  private index = 0;
  private lockoutMs = 0;

  open(): void {
    this.opened = true;
    this.index = 0;
    this.lockoutMs = MODAL_OPEN_LOCKOUT_MS;
  }

  close(): void {
    this.opened = false;
  }

  isVisible(): boolean {
    return this.opened;
  }

  /** Highlighted catalog item (always valid while open). */
  selected(): CartItem {
    return CART_CATALOG[this.index];
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) {
      this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
    }
  }

  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  selectPrev(): void {
    if (!this.opened) return;
    this.index = (this.index - 1 + CART_CATALOG.length) % CART_CATALOG.length;
  }

  selectNext(): void {
    if (!this.opened) return;
    this.index = (this.index + 1) % CART_CATALOG.length;
  }

  /** Attempts to buy the highlighted item. */
  confirm(
    player: Player,
    px: number,
    py: number,
    time: TimeOfDay,
  ): CartBuyOutcome {
    if (!this.opened) return { kind: 'closed' };
    return buyFromCart(player, px, py, time, this.selected().key);
  }

  /** Renders the menu over the world. No-op when closed. */
  draw(
    ctx: CanvasRenderingContext2D,
    player: Player,
    canvasW: number,
    canvasH: number,
    time?: TimeOfDay,
  ): void {
    if (!this.opened) return;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - PANEL_H) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout, the same hook the info-panel
    // family + hearts use; reduce-motion snaps it solid. Scoped by the
    // save/restore so the scrim + panel ease in together.
    ctx.globalAlpha = panelOpenAlpha(
      this.lockoutMs,
      getSettings(player).reduceMotion,
      MODAL_OPEN_LOCKOUT_MS,
    );
    // Dim the world.
    ctx.fillStyle = 'rgba(10, 6, 18, 0.45)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    // Panel.
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

    // Title + gold readout.
    ctx.font = 'bold 16px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillStyle = TITLE_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText("Pip's Travelling Cart", x + 18, y + 14);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.fillText('Premium goods. Here today, gone tomorrow.', x + 18, y + 36);
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(`${player.gold}g`, x + PANEL_W - 18, y + 18);

    // Rows.
    const rowH = 50;
    const rowsTop = y + 64;
    const season = time ? time.season : -1;
    for (let i = 0; i < CART_CATALOG.length; i++) {
      const item = CART_CATALOG[i];
      const have = player.gold >= item.buyPrice;
      const rowX = x + 14;
      const rowY = rowsTop + i * (rowH + 4);
      const rowW = PANEL_W - 28;
      const selected = i === this.index;
      ctx.fillStyle = selected ? ROW_BG_SELECTED : ROW_BG;
      ctx.fillRect(rowX, rowY, rowW, rowH);
      ctx.strokeStyle = selected ? BORDER : ROW_BORDER;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(rowX + 0.5, rowY + 0.5, rowW - 1, rowH - 1);

      // Name + price.
      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.fillStyle = have ? TEXT : DIM;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, rowX + 10, rowY + 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = have ? GOLD : DIM;
      ctx.fillText(`${item.buyPrice}g`, rowX + rowW - 10, rowY + 8);

      // Flavor.
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = have ? TEXT : DIM;
      ctx.textAlign = 'left';
      ctx.fillText(item.flavor, rowX + 10, rowY + 28);

      // Owned counter.
      const owned = item.key.startsWith('decor-')
        ? (ownsDecor(player, item.key.slice('decor-'.length)) ? 1 : 0)
        : (player.inventory[item.key] ?? 0);
      if (owned > 0) {
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillStyle = TITLE_COLOR;
        ctx.textAlign = 'right';
        ctx.fillText(`x${owned}`, rowX + rowW - 10, rowY + 30);
      }

      // Rumor headliner tag — small "TEASED -Ng" chip on the row Pip
      // pre-announced last visit. Only when we know the season AND
      // the row isn't already saturated with an owned chip.
      if (season >= 0 && isCurrentHeadlinerKey(season, item.key)) {
        const rebate = rumorRebateAmount(item.buyPrice);
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillStyle = TITLE_COLOR;
        ctx.textAlign = 'right';
        const tagY = owned > 0 ? rowY + 18 : rowY + 30;
        ctx.fillText(`TEASED -${rebate}g`, rowX + rowW - 10, tagY);
      }
    }

    // Footer.
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.textAlign = 'center';
    if (time) {
      const rumor = rumorFooterLine(time.season);
      if (rumor) {
        ctx.fillStyle = TITLE_COLOR;
        ctx.fillText(rumor, x + PANEL_W / 2, y + PANEL_H - 50);
        ctx.fillStyle = HINT;
      }
      // Rumor history summary — "Headliners: 2/4 bought." right below
      // the next-visit hint so the player sees both at a glance.
      // Empty when the player has never opened the cart, in which case
      // the line is suppressed.
      const summary = rumorHistorySummary(player);
      if (summary) {
        ctx.fillStyle = HINT;
        ctx.fillText(summary, x + PANEL_W / 2, y + PANEL_H - 36);
      }
      // Streak chip — surfaces "streak: 4 bought (-15g on headliners)"
      // when the player has bought one or more in a row. Empty at
      // streak=0 so a fresh save / clean break doesn't add a row.
      const streak = rumorStreakLine(player);
      if (streak) {
        ctx.fillStyle = TITLE_COLOR;
        ctx.fillText(streak, x + PANEL_W / 2, y + PANEL_H - 64);
        ctx.fillStyle = HINT;
      }
      // Stamina-tea trade-in chip — heads-up that the auto-trade-on-
      // open path will fire (or how many more teas the player needs).
      // Sits ABOVE the streak chip so the two are stacked top-down:
      // "tea trade", then "headliner streak". Empty when balance==0.
      const teaLine = staminaTeaTradeInLine(player);
      if (teaLine) {
        ctx.fillStyle = TITLE_COLOR;
        ctx.fillText(teaLine, x + PANEL_W / 2, y + PANEL_H - 78);
        ctx.fillStyle = HINT;
      }
    }
    ctx.fillText('↑/↓ to choose · Enter to buy · Esc to leave', x + PANEL_W / 2, y + PANEL_H - 22);

    ctx.restore();
  }
}
