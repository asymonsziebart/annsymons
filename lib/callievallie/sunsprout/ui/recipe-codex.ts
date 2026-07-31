// Recipe codex panel — `R` toggles a read-only catalog of every recipe.
//
// The codex shows three discovery states: cooked (the player has made
// this dish at least once), known (the player has the ingredients to
// cook it right now), locked (neither). Locked recipes show only their
// name + slot — flavour text and ingredient list are hidden until the
// player discovers them, so reaching a new recipe still feels like a
// reveal. Cooked rows show their cooked count.
//
// Rendering is a top-right floating panel with the same chrome as the
// hearts panel — it floats above the world without dimming it, and
// closes with a second `R` press or Escape.

import type { Player } from '../world/world';
import { buildCodex, codexSections, recipesCooked, totalDishesCooked, totalPremiumDishesCooked, applyCodexFilter, cycleCodexFilter, codexFilterLabel, type RecipeCodexRow, type RecipeCodexFilter } from '../game/cooking-history';
import { RECIPES, RECIPE_KEYS } from '../game/cooking';
import { nextFilterHint } from '../game/panel-empty';
import { panelOpenAlpha } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_BG = 'rgba(26, 20, 38, 0.95)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const KNOWN = '#A3D77A';
const COOKED = '#F0C24A';
const LOCKED = '#7a6a9a';
const GOLD = '#F0C24A';
const PREMIUM = '#E8B4F0';
const FILTER_CHIP = 'rgba(200, 182, 232, 0.7)';

const PANEL_W = 360;
const ROW_H = 28;
const ROW_H_PREMIUM = 40;
/** Discovery-section divider band height (label + a touch of breathing room). */
const SECTION_H = 18;

function pretty(key: string): string {
  if (key.endsWith('_harvest')) return key.slice(0, -'_harvest'.length);
  if (key.startsWith('fish-')) return key.slice('fish-'.length);
  if (key.startsWith('forage-')) return key.slice('forage-'.length);
  return key;
}

/** Pure controller for the recipe codex. */
export class RecipeCodex {
  private opened = false;
  private lockoutMs = 0;
  private filter: RecipeCodexFilter = 'all';

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.filter = 'all';
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

  /** Active discovery filter — exposed for tests. */
  currentFilter(): RecipeCodexFilter {
    return this.filter;
  }

  /** Cycle the discovery filter (all -> cooked -> ready -> undiscovered). */
  cycleFilter(): void {
    if (!this.opened) return;
    this.filter = cycleCodexFilter(this.filter);
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  /** Renders the codex on top of the world. No-op when closed. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, _canvasH: number): void {
    if (!this.opened) return;
    const allRows = buildCodex(player);
    // The active filter narrows WHICH recipes show; the header tally still
    // reflects the whole book so the player keeps the full picture.
    const rows = applyCodexFilter(allRows, this.filter);
    const hasAnyRows = allRows.length > 0;
    // Group into Cooked / Ready / Locked discovery sections so the list
    // reads as "mastered / can-make-now / still-hidden" rather than one
    // flat scroll keyed only by a pip colour.
    const sections = codexSections(rows);
    // Each row is ROW_H, premium (unlocked egg) rows are taller; each
    // section adds a divider band. Pre-sum so the chrome scales exactly.
    const rowH = (r: RecipeCodexRow) =>
      r.discovery !== 'locked' && r.hasPremium ? ROW_H_PREMIUM : ROW_H;
    const rowsTotalH = rows.reduce((a, r) => a + rowH(r), 0);
    const sectionsTotalH = sections.length * SECTION_H;
    // When a filter hides every recipe, reserve two rows for the note so
    // the panel doesn't collapse to a sliver and the message has room.
    const emptyH = rows.length === 0 ? 2 * ROW_H : 0;
    const h = 56 + rowsTotalH + sectionsTotalH + emptyH + 22;
    const x = canvasW - PANEL_W - 12;
    const y = 40;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout; reduce-motion snaps it solid.
    ctx.globalAlpha = panelOpenAlpha(this.lockoutMs, getSettings(player).reduceMotion);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillText('recipe codex  (R)', x + 12, y + 8);

    // Filter chip — dim pill right of the title when the filter is
    // narrowing the view, so the `f` cycle is discoverable and the current
    // scope is legible. Quiet on 'all' (no narrowing).
    if (this.filter !== 'all') {
      ctx.font = 'bold 13px ui-monospace, monospace';
      const titleW = ctx.measureText('recipe codex  (R)').width;
      ctx.fillStyle = FILTER_CHIP;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`- ${codexFilterLabel(this.filter)}`, x + 12 + titleW + 8, y + 11);
    }

    const cooked = recipesCooked(player);
    const total = RECIPE_KEYS.length;
    const totalDishes = totalDishesCooked(player);
    const totalPremium = totalPremiumDishesCooked(player);
    ctx.fillStyle = DIM;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    // Premium tally tucked at the right of the header — only when nonzero
    // so a fresh save sees the regular line untouched.
    const headerRight = totalPremium > 0
      ? `${cooked}/${total} known  -  ${totalDishes} cooked  -  ${totalPremium} premium`
      : `${cooked}/${total} known  -  ${totalDishes} cooked`;
    ctx.fillText(headerRight, x + PANEL_W - 12, y + 9);

    if (rows.length === 0) {
      // A filter hid every recipe (the book is never truly empty — RECIPES
      // is a static catalog). Point the player at the `f` cycle AND name
      // where the next press lands so they know where the cycle goes.
      ctx.fillStyle = HINT;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`no ${codexFilterLabel(this.filter)} recipes`, x + PANEL_W / 2, y + 44);
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(nextFilterHint(this.filter, cycleCodexFilter, codexFilterLabel), x + PANEL_W / 2, y + 60);
    } else {
      // Walk the discovery sections, drawing a small divider above each
      // group then its rows.
      let ry = y + 32;
      for (const section of sections) {
        this.drawSectionHeader(ctx, section.header, section.rows.length, x, ry);
        ry += SECTION_H;
        for (const row of section.rows) {
          this.drawRow(ctx, row, x, ry);
          ry += rowH(row);
        }
      }
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      hasAnyRows ? 'R or Esc to close - f filter' : 'R or Esc to close',
      x + PANEL_W / 2,
      y + h - 14,
    );

    ctx.restore();
    void RECIPES;
  }

  /** Small discovery-section divider, e.g. "COOKED  3" + a trailing rule. */
  private drawSectionHeader(
    ctx: CanvasRenderingContext2D,
    header: string,
    count: number,
    x: number,
    ry: number,
  ): void {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = DIM;
    ctx.font = 'bold 9px ui-monospace, monospace';
    const label = `${header}  ${count}`;
    ctx.fillText(label, x + 12, ry + 5);
    // A thin rule trailing off to the right so the divider reads as a
    // section break without shouting (mirrors the almanac sections).
    const labelW = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(74, 59, 110, 0.5)';
    ctx.fillRect(x + 12 + labelW + 8, ry + 9, PANEL_W - 24 - labelW - 8, 1);
  }

  /** Draw one recipe row at top `ry`. Height is ROW_H / ROW_H_PREMIUM. */
  private drawRow(
    ctx: CanvasRenderingContext2D,
    row: RecipeCodexRow,
    x: number,
    ry: number,
  ): void {
    // Status pip on the left.
    const color =
      row.discovery === 'cooked' ? COOKED : row.discovery === 'known' ? KNOWN : LOCKED;
    ctx.fillStyle = color;
    ctx.fillRect(x + 12, ry + 4, 4, 4);

    // Name (locked rows show "????" so the reveal moment stays intact).
    ctx.fillStyle = row.discovery === 'locked' ? DIM : TEXT_COLOR;
    ctx.textAlign = 'left';
    ctx.font = '11px ui-monospace, monospace';
    const nameLabel =
      row.discovery === 'locked'
        ? row.name.replace(/[A-Za-z]/g, '?')
        : row.name;
    ctx.fillText(nameLabel, x + 22, ry + 1);

    // Sell price right-aligned.
    if (row.discovery !== 'locked') {
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'right';
      ctx.fillText(`${row.sellPrice}g`, x + PANEL_W - 12, ry + 1);
    }

    // Ingredient row (only when known or cooked).
    if (row.discovery !== 'locked') {
      ctx.fillStyle = HINT;
      ctx.textAlign = 'left';
      ctx.font = '11px ui-monospace, monospace';
      const parts = row.ingredients
        .map((ing) => `${pretty(ing.key)} ${ing.have}/${ing.count}`)
        .join('  -  ');
      ctx.fillText(parts, x + 22, ry + 14);
      // Premium sub-row — only for egg-bearing recipes the player has
      // unlocked. Shows the swap markup line + a per-recipe tally so
      // the player can see at a glance how much they've leaned into
      // the breeder-egg pipeline.
      if (row.hasPremium) {
        const owned = row.premiumOwned;
        const cooked = row.premiumCookedCount;
        // Premium tally pip on the right edge — pink so it visually
        // doesn't compete with the gold sell price above it.
        if (owned > 0 || cooked > 0) {
          ctx.fillStyle = PREMIUM;
          ctx.textAlign = 'right';
          ctx.font = 'bold 10px ui-monospace, monospace';
          const tally = owned > 0 ? `x${owned} ready` : `cooked x${cooked}`;
          ctx.fillText(tally, x + PANEL_W - 12, ry + 26);
          ctx.font = '11px ui-monospace, monospace';
        }
        // Premium markup line — dim pink so the eye picks it up but
        // it doesn't compete with the primary ingredient line.
        ctx.fillStyle = 'rgba(232, 180, 240, 0.65)';
        ctx.textAlign = 'left';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(row.premiumLine, x + 22, ry + 28);
        ctx.font = '11px ui-monospace, monospace';
      }
    } else {
      ctx.fillStyle = DIM;
      ctx.textAlign = 'left';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('cook the right combo to discover', x + 22, ry + 14);
    }
  }
}
