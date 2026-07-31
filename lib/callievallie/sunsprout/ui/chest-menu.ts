// Chest menu — modal for inspecting and shuffling items between the
// player's bag and a placed chest.
//
// Opens via `]` when standing next to (or on) a chest. Up/Down picks a
// row from the chest, Enter withdraws one of the highlighted item back
// into the bag. `d` plus a number key (1..5) is reserved for the
// deposit flow later; for the first tick we ship the read + withdraw
// loop plus a "deposit best harvest" Tab shortcut so the player can
// off-load their farm yield instantly. Tests cover the controller; the
// canvas draw is exercised through wider build smoke.

import type { Player } from '../world/world';
import {
  type PlacedChest,
  chestTotal,
  depositItem,
  listChestItems,
  withdrawItem,
} from '../game/chest';
import { panelOpenAlpha, MODAL_OPEN_LOCKOUT_MS } from '../game/panel-transition';

const PANEL_W = 460;
const PANEL_H = 320;
const BG = 'rgba(26, 20, 38, 0.94)';
const BORDER = '#F5C9A0';
const TITLE_COLOR = '#F5C9A0';
const ROW_BG = 'rgba(40, 30, 60, 0.85)';
const ROW_BG_SELECTED = 'rgba(108, 86, 158, 0.85)';
const ROW_BORDER = '#6b5b8e';
const TEXT = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.45)';
const HINT = 'rgba(245, 233, 212, 0.55)';

export type ChestAction =
  | { kind: 'deposited'; key: string; count: number }
  | { kind: 'withdrew'; key: string; count: number }
  | { kind: 'empty' }
  | { kind: 'noop' };

/** Pretty an inventory key by stripping common suffixes/prefixes. */
function pretty(key: string): string {
  return key
    .replace('_harvest_silver', ' (silver)')
    .replace('_harvest_gold', ' (gold)')
    .replace('_harvest', '')
    .replace('fish-', '')
    .replace('gem-', '')
    .replace('forage-', '');
}

/** Pure controller — no canvas. */
export class ChestMenu {
  private opened = false;
  private chest: PlacedChest | null = null;
  private index = 0;
  private lockoutMs = 0;

  open(chest: PlacedChest): void {
    this.opened = true;
    this.chest = chest;
    this.index = 0;
    this.lockoutMs = MODAL_OPEN_LOCKOUT_MS;
  }

  close(): void {
    this.opened = false;
    this.chest = null;
  }

  isVisible(): boolean {
    return this.opened;
  }

  currentChest(): PlacedChest | null {
    return this.chest;
  }

  selectedRow(): { key: string; count: number } | null {
    if (!this.chest) return null;
    const items = listChestItems(this.chest);
    if (items.length === 0) return null;
    const idx = ((this.index % items.length) + items.length) % items.length;
    return items[idx];
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
    if (!this.opened || !this.chest) return;
    const items = listChestItems(this.chest);
    if (items.length === 0) return;
    this.index = (this.index - 1 + items.length) % items.length;
  }

  selectNext(): void {
    if (!this.opened || !this.chest) return;
    const items = listChestItems(this.chest);
    if (items.length === 0) return;
    this.index = (this.index + 1) % items.length;
  }

  /** Withdraw one of the highlighted row's item back to the player's bag. */
  withdrawOne(player: Player): ChestAction {
    if (!this.chest) return { kind: 'noop' };
    const row = this.selectedRow();
    if (!row) return { kind: 'empty' };
    const moved = withdrawItem(this.chest, player, row.key, 1);
    if (moved === 0) return { kind: 'empty' };
    return { kind: 'withdrew', key: row.key, count: moved };
  }

  /**
   * Deposit every "_harvest" bucket (all three tiers) the player is
   * carrying into the chest. Useful as a one-keystroke shortcut.
   */
  depositAllHarvest(player: Player): ChestAction {
    if (!this.chest) return { kind: 'noop' };
    let totalMoved = 0;
    for (const key of Object.keys(player.inventory)) {
      if (
        !key.endsWith('_harvest') &&
        !key.endsWith('_harvest_silver') &&
        !key.endsWith('_harvest_gold')
      ) {
        continue;
      }
      const moved = depositItem(this.chest, player, key, player.inventory[key]);
      totalMoved += moved;
    }
    if (totalMoved === 0) return { kind: 'noop' };
    return { kind: 'deposited', key: 'harvest', count: totalMoved };
  }

  /** Renders the panel + the chest's contents on top of the world. */
  draw(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    reduceMotion: boolean = false,
  ): void {
    if (!this.opened || !this.chest) return;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - PANEL_H) / 2);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout, the same hook the rest of the
    // modal family + info panels use; reduce-motion snaps it solid. The
    // chest menu draws no world scrim, so the panel itself eases in.
    ctx.globalAlpha = panelOpenAlpha(this.lockoutMs, reduceMotion, MODAL_OPEN_LOCKOUT_MS);
    ctx.fillStyle = BG;
    ctx.fillRect(x, y, PANEL_W, PANEL_H);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, PANEL_W - 2, PANEL_H - 2);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 16px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillText('Chest', x + 16, y + 12);
    ctx.fillStyle = DIM;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(`${chestTotal(this.chest)} item${chestTotal(this.chest) === 1 ? '' : 's'} stored`, x + 16, y + 32);

    const items = listChestItems(this.chest);
    const rowH = 22;
    const innerX = x + 16;
    const innerY = y + 56;
    const innerW = PANEL_W - 32;
    if (items.length === 0) {
      ctx.fillStyle = DIM;
      ctx.font = '13px ui-monospace, monospace';
      ctx.fillText('(chest is empty)', innerX, innerY);
    } else {
      const selected = ((this.index % items.length) + items.length) % items.length;
      for (let i = 0; i < items.length; i++) {
        const rowY = innerY + i * rowH;
        if (rowY + rowH > y + PANEL_H - 40) break;
        ctx.fillStyle = i === selected ? ROW_BG_SELECTED : ROW_BG;
        ctx.fillRect(innerX, rowY, innerW, rowH - 2);
        ctx.strokeStyle = ROW_BORDER;
        ctx.strokeRect(innerX + 0.5, rowY + 0.5, innerW - 1, rowH - 3);
        ctx.fillStyle = TEXT;
        ctx.font = '13px ui-monospace, monospace';
        ctx.fillText(`x${items[i].count}  ${pretty(items[i].key)}`, innerX + 8, rowY + 4);
      }
    }
    ctx.fillStyle = HINT;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('arrows / w-s: move    enter: withdraw one    tab: deposit all harvest    esc: close', x + 16, y + PANEL_H - 22);
    ctx.restore();
  }
}
