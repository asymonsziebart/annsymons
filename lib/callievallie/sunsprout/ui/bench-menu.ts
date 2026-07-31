// Bench menu — modal for crafting at the carpenter's bench.
//
// Opens when the player walks onto an adjacent tile to BENCH_X/BENCH_Y
// and presses E. Up/Down picks a recipe, Enter crafts the highlighted
// row. Esc closes. Visual chrome mirrors the cart + shop menus.

import type { Player } from '../world/world';
import {
  BENCH_RECIPES,
  canCraft,
  craftAtBench,
  recipeCostLine,
  recipeShoppingList,
  type BenchCraftOutcome,
  type BenchRecipe,
} from '../game/bench';
import { GEMS, gemInventoryKey } from '../game/gems';
import { panelOpenAlpha, MODAL_OPEN_LOCKOUT_MS } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_W = 560;
const PANEL_H = 360;
const BG = 'rgba(26, 20, 38, 0.94)';
const BORDER = '#C9A48F';
const TITLE_COLOR = '#C9A48F';
const ROW_BG = 'rgba(40, 30, 60, 0.85)';
const ROW_BG_SELECTED = 'rgba(108, 86, 158, 0.85)';
const ROW_BORDER = '#6b5b8e';
const TEXT = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.45)';
const GOLD = '#F0C24A';
const HINT = 'rgba(245, 233, 212, 0.55)';

export class BenchMenu {
  private opened = false;
  private index = 0;
  private lockoutMs = 0;
  private flash = '';
  private flashFade = 0;

  open(): void {
    this.opened = true;
    this.index = 0;
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

  selected(): BenchRecipe {
    return BENCH_RECIPES[this.index];
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
    if (this.flashFade > 0) this.flashFade = Math.max(0, this.flashFade - dtMs);
  }

  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  selectPrev(): void {
    if (!this.opened) return;
    this.index = (this.index - 1 + BENCH_RECIPES.length) % BENCH_RECIPES.length;
  }

  selectNext(): void {
    if (!this.opened) return;
    this.index = (this.index + 1) % BENCH_RECIPES.length;
  }

  confirm(player: Player): BenchCraftOutcome {
    if (!this.opened) return { kind: 'unknown-recipe' };
    const out = craftAtBench(player, this.selected().key);
    if (out.kind === 'crafted') {
      this.setFlash(`Crafted ${out.recipe.label}.`);
    } else if (out.kind === 'not-enough-gold') {
      this.setFlash(`Need ${out.need}g (have ${out.have}g).`);
    } else if (out.kind === 'not-enough-gems') {
      const gname = GEMS[out.gemKey].name;
      this.setFlash(`Need ${out.need}x ${gname} (have ${out.have}).`);
    }
    return out;
  }

  private setFlash(s: string): void {
    this.flash = s;
    this.flashFade = 1800;
  }

  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
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
    ctx.fillText("Carpenter's Bench", x + 18, y + 14);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.fillText('Spend gold + gems to craft placeables.', x + 18, y + 36);
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(`${player.gold}g`, x + PANEL_W - 18, y + 18);

    const rowH = 58;
    const rowsTop = y + 64;
    for (let i = 0; i < BENCH_RECIPES.length; i++) {
      const recipe = BENCH_RECIPES[i];
      const ok = canCraft(player, recipe);
      const rowX = x + 14;
      const rowY = rowsTop + i * (rowH + 4);
      const rowW = PANEL_W - 28;
      const selected = i === this.index;
      ctx.fillStyle = selected ? ROW_BG_SELECTED : ROW_BG;
      ctx.fillRect(rowX, rowY, rowW, rowH);
      ctx.strokeStyle = selected ? BORDER : ROW_BORDER;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(rowX + 0.5, rowY + 0.5, rowW - 1, rowH - 1);

      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.fillStyle = ok ? TEXT : DIM;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(recipe.label, rowX + 10, rowY + 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = ok ? GOLD : DIM;
      ctx.fillText(recipeCostLine(recipe), rowX + rowW - 10, rowY + 8);

      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = ok ? TEXT : DIM;
      ctx.textAlign = 'left';
      ctx.fillText(recipe.flavor, rowX + 10, rowY + 28);

      // Per-row gem inventory hint.
      const have = player.inventory[gemInventoryKey(recipe.gem.key)] ?? 0;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = HINT;
      ctx.textAlign = 'right';
      ctx.fillText(`have ${have}x`, rowX + rowW - 10, rowY + 30);

      const owned = player.inventory[recipe.key] ?? 0;
      if (owned > 0) {
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillStyle = TITLE_COLOR;
        ctx.textAlign = 'right';
        ctx.fillText(`x${owned}`, rowX + rowW - 10, rowY + 44);
      }

      // Shopping-list hint on dimmed rows — surfaces the EXACT gap
      // ("need 120g more, need 1 more Iron Nugget") so the player
      // can plan a mining run or well sell without doing the math.
      // Empty for craftable rows; we still skip the draw to keep
      // them visually unfussed.
      if (!ok) {
        const hint = recipeShoppingList(player, recipe);
        if (hint) {
          ctx.font = 'bold 10px ui-monospace, monospace';
          ctx.fillStyle = '#E89C5A';
          ctx.textAlign = 'left';
          ctx.fillText(hint, rowX + 10, rowY + 44);
        }
      }
    }

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
    ctx.fillText('Up/Down to choose · Enter to craft · Esc to leave', x + PANEL_W / 2, y + PANEL_H - 22);

    ctx.restore();
  }
}
