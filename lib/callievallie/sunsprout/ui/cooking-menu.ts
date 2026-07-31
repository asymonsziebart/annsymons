// Cooking menu — slice 3 of the v0.3.0 cooking pot.
//
// A small modal overlay opened with `C` while standing near the inn.
// Lists every recipe, shows its ingredients, and lets the player cook
// the currently-highlighted one with Enter / Space. Recipes whose
// ingredients aren't available are visually dimmed and refuse to cook.
//
// Like dialogue.ts and fishing-minigame.ts before it, the panel keeps
// rendering on a CanvasRenderingContext2D while its state lives in a
// plain class — the math/state half is fully unit-testable in node.

import type { Player } from '../world/world';
import {
  RECIPES,
  RECIPE_KEYS,
  canCook,
  canCookDoubleBatch,
  cook,
  cookDoubleBatch,
  dishInventoryKey,
  doubleBatchLine,
  ingredientsValue,
  isStaminaTea,
  type DishKey,
} from '../game/cooking';
import { innForageTradeInLine } from '../game/inn-trade';
import { panelOpenAlpha, MODAL_OPEN_LOCKOUT_MS } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_W = 520;
const PANEL_H = 360;
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

/** Cook mode — regular single-yield or stamina-tea double-batch. */
export type CookMode = 'single' | 'double';

/** Result of an attempted cook from the menu. */
export type CookOutcome =
  | { kind: 'cooked'; recipe: DishKey; name: string; mode: CookMode; yield: number }
  | { kind: 'missing'; recipe: DishKey; name: string; mode: CookMode }
  | { kind: 'not-eligible-double'; recipe: DishKey; name: string }
  | { kind: 'noop' };

/**
 * Pure controller for the cooking menu — no DOM or canvas. Holds the
 * open/closed flag plus the currently-highlighted recipe index. All
 * input handlers return a CookOutcome the caller can route into a
 * toast / sound / quest hook.
 */
export class CookingMenu {
  private opened = false;
  private index = 0;
  /** Lockout so the same key that opened the menu doesn't immediately fire. */
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

  /** Currently-highlighted recipe key (always valid while open). */
  selectedKey(): DishKey {
    return RECIPE_KEYS[this.index];
  }

  /** Decrement open-lockout. Called each fixed-step from the game loop. */
  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) {
      this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
    }
  }

  /** True iff the menu has settled enough to accept new keypresses. */
  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  /** Move the highlight up one row, wrapping at the top. */
  selectPrev(): void {
    if (!this.opened) return;
    this.index = (this.index - 1 + RECIPE_KEYS.length) % RECIPE_KEYS.length;
  }

  /** Move the highlight down one row, wrapping at the bottom. */
  selectNext(): void {
    if (!this.opened) return;
    this.index = (this.index + 1) % RECIPE_KEYS.length;
  }

  /**
   * Attempts to cook the currently-selected recipe. Defaults to the
   * regular single-yield path; pass mode='double' to fire the
   * stamina-tea double-batch (consumes 2x ingredients, mints 3 dishes).
   * Returns a tagged outcome so the game layer can show the right toast
   * (or stay quiet if the menu wasn't actually open).
   */
  confirm(player: Player, mode: CookMode = 'single'): CookOutcome {
    if (!this.opened) return { kind: 'noop' };
    const key = this.selectedKey();
    const recipe = RECIPES[key];
    if (mode === 'double') {
      // The double-batch path only applies to stamina teas — refuse
      // up front so the game layer can route a clearer toast than
      // "missing ingredients" when the player tries to batch e.g.
      // hearty stew.
      if (!isStaminaTea(key)) {
        return { kind: 'not-eligible-double', recipe: key, name: recipe.name };
      }
      if (!canCookDoubleBatch(player, key)) {
        return { kind: 'missing', recipe: key, name: recipe.name, mode };
      }
      cookDoubleBatch(player, key);
      return {
        kind: 'cooked',
        recipe: key,
        name: recipe.name,
        mode,
        yield: 3, // DOUBLE_BATCH_DISH_YIELD — kept inline so the menu
                  // doesn't import the constant for a single literal.
      };
    }
    if (!canCook(player, key)) {
      return { kind: 'missing', recipe: key, name: recipe.name, mode };
    }
    cook(player, key);
    return { kind: 'cooked', recipe: key, name: recipe.name, mode, yield: 1 };
  }

  // -------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------

  /** Renders the menu over the world. No-op when closed. */
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

    // Dim the world behind the panel.
    ctx.fillStyle = 'rgba(10, 6, 18, 0.45)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Panel frame.
    ctx.fillStyle = BG;
    ctx.fillRect(x, y, PANEL_W, PANEL_H);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, PANEL_W - 2, PANEL_H - 2);
    // Corner pixels.
    ctx.fillStyle = BORDER;
    ctx.fillRect(x + 4, y + 4, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + 4, 4, 4);
    ctx.fillRect(x + 4, y + PANEL_H - 8, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + PANEL_H - 8, 4, 4);

    // Title.
    ctx.font = 'bold 16px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillStyle = TITLE_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Cooking Pot', x + 18, y + 14);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.fillText("Callie's recipes — turn harvest into dishes", x + 18, y + 36);

    // Recipe rows.
    const rowH = 38;
    const rowsTop = y + 60;
    for (let i = 0; i < RECIPE_KEYS.length; i++) {
      const key = RECIPE_KEYS[i];
      const recipe = RECIPES[key];
      const have = canCook(player, key);
      const rowX = x + 14;
      const rowY = rowsTop + i * (rowH + 4);
      const rowW = PANEL_W - 28;
      const selected = i === this.index;
      ctx.fillStyle = selected ? ROW_BG_SELECTED : ROW_BG;
      ctx.fillRect(rowX, rowY, rowW, rowH);
      ctx.strokeStyle = selected ? BORDER : ROW_BORDER;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(rowX + 0.5, rowY + 0.5, rowW - 1, rowH - 1);

      // Name + sell price.
      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.fillStyle = have ? TEXT : DIM;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(recipe.name, rowX + 10, rowY + 6);

      ctx.textAlign = 'right';
      ctx.fillStyle = have ? GOLD : DIM;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(`${recipe.sellPrice}g`, rowX + rowW - 10, rowY + 6);

      // Ingredient line.
      const parts = recipe.ingredients.map((ing) => {
        const owned = player.inventory[ing.key] ?? 0;
        const label = prettyIngredient(ing.key);
        return `${label} ${owned}/${ing.count}`;
      });
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = have ? TEXT : DIM;
      ctx.textAlign = 'left';
      ctx.fillText(parts.join('  ·  '), rowX + 10, rowY + 22);

      // Owned dish badge.
      const dishCount = player.inventory[dishInventoryKey(key)] ?? 0;
      if (dishCount > 0) {
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillStyle = TITLE_COLOR;
        ctx.textAlign = 'right';
        ctx.fillText(`×${dishCount}`, rowX + rowW - 10, rowY + 22);
      }

      // Markup hint on selected row only (keeps the panel uncluttered).
      if (selected) {
        const markup = recipe.sellPrice - ingredientsValue(recipe);
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillStyle = HINT;
        ctx.textAlign = 'center';
        // Tea recipes get the double-batch hint here instead of the
        // "+Ng over raw" markup line — both communicate the same
        // "what does the highlighted recipe offer beyond a normal cook"
        // sentiment and the batch line is more actionable for teas.
        const doubleHint = doubleBatchLine(key);
        if (doubleHint.length > 0) {
          ctx.fillText(doubleHint, rowX + rowW / 2, rowY + rowH - 12);
        } else {
          ctx.fillText(`+${markup}g over raw`, rowX + rowW / 2, rowY + rowH - 12);
        }
      }
    }

    // Footer hints — surface the Shift+Enter batch path when the
    // currently-selected recipe is a stamina tea.
    const selectedKey = this.selectedKey();
    const batchEligible = isStaminaTea(selectedKey);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.textAlign = 'center';
    // Inn forage trade-in chip — heads-up that the auto-trade-on-
    // open path will fire (or how many more forage the player needs).
    // Sits ABOVE the keybind footer so the chips read top-down:
    // "forage trade", then "keybinds". Empty when balance==0.
    const innLine = innForageTradeInLine(player);
    if (innLine) {
      ctx.fillStyle = TITLE_COLOR;
      ctx.fillText(innLine, x + PANEL_W / 2, y + PANEL_H - 38);
      ctx.fillStyle = HINT;
    }
    const footer = batchEligible
      ? '↑/↓ choose · Enter cook · Shift+Enter double-batch · C / Esc close'
      : '↑/↓ to choose · Enter to cook · C / Esc to close';
    ctx.fillText(
      footer,
      x + PANEL_W / 2,
      y + PANEL_H - 22,
    );

    ctx.restore();
  }
}

/** Friendly label for an ingredient inventory key (e.g. wheat_harvest → wheat). */
export function prettyIngredient(key: string): string {
  if (key.endsWith('_harvest')) return key.slice(0, -'_harvest'.length);
  if (key.startsWith('fish-')) return key.slice('fish-'.length);
  return key;
}
