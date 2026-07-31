// Crop journal panel — `;` toggles a per-crop reference + lifetime tally.
//
// Each row shows:
//   - crop name, seed/sell prices, growth days, best season
//   - lifetime: sown count, harvest tally with silver/gold breakdown
//   - best water streak ever achieved with this crop
//
// Render anchored under the hearts panel (top-right). Both panels share
// the same chrome — they're peer informational HUD overlays the player
// can stack open while moving around the world.

import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import {
  buildJournal,
  nextFestivals,
  totalHarvest,
  maxLifetimeHarvest,
  harvestBarSegments,
  hasHarvestBars,
  harvestBarLegend,
  isBestSeasonNow,
  fieldStatusCounts,
  fieldStatusSummary,
  fieldStatusParts,
  ribbonMedalGlyph,
  sownPipState,
  type CropJournalEntry,
  type FieldCropSample,
} from '../game/crop-journal';
import { compostLedgerLine } from '../game/compost';
import { panelOpenAlpha } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_BG = 'rgba(26, 20, 38, 0.95)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const GOLD = '#F0C24A';
const SILVER = '#D5D8DC';
const GREEN = '#A3D77A';
const AMBER = '#E8A24A';

const PANEL_W = 360;
const ROW_H = 50;
/** Harvest mini-bar geometry — sits in each row's bottom-right clear space. */
const BAR_W = 84;
const BAR_H = 5;

export class CropJournalPanel {
  private opened = false;
  private lockoutMs = 0;

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
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

  /** Render the journal panel. No-op when closed. */
  draw(
    ctx: CanvasRenderingContext2D,
    player: Player,
    time: TimeOfDay,
    canvasW: number,
    _canvasH: number,
    fieldSamples: readonly FieldCropSample[] = [],
  ): void {
    if (!this.opened) return;
    void canvasW;
    const entries = buildJournal(player);
    const festivals = nextFestivals(time, 2);
    const ledgerLine = compostLedgerLine(player);
    const ledgerExtra = ledgerLine.length > 0 ? 16 : 0;
    // Live field-status digest under the title — a "right now" cousin of
    // the lifetime tallies below it, so the reference panel ties back to
    // the current farm. Present only when crops are growing; the band
    // collapses to nothing on a bare field so the layout stays put. The
    // harvest-bar legend shares this same band (right-aligned), so the band
    // is also reserved when a mini-bar will draw even on an empty field.
    const fieldLine = fieldStatusSummary(fieldStatusCounts(fieldSamples));
    const needsHeaderBand = fieldLine.length > 0 || hasHarvestBars(entries);
    const fieldH = needsHeaderBand ? 14 : 0;
    const h = 44 + fieldH + entries.length * ROW_H + (festivals.length > 0 ? 38 : 12) + ledgerExtra;
    // Top-left overlay — replaces the quest panel while open (same chrome
    // pattern as the recipe codex overlays the hearts panel on the right).
    const x = 12;
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
    ctx.fillText('crop journal  (;)', x + 12, y + 8);

    // Header counts on the right
    const totalSown = entries.reduce((s, e) => s + e.sown, 0);
    const totalHarv = entries.reduce(
      (s, e) => s + totalHarvest({ sown: e.sown, normal: e.normal, silver: e.silver, gold: e.gold, bestStreak: e.bestStreak }),
      0,
    );
    ctx.fillStyle = DIM;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${totalSown} sown  -  ${totalHarv} reaped`, x + PANEL_W - 12, y + 9);

    // Field-status caption band — green for a field that needs nothing,
    // amber-tinted wording when crops are thirsty (the summary already
    // orders ready/growing/thirsty). Drawn dim under the title. A harvest-
    // bar legend (normal / silver / gold key) is right-aligned on the same
    // line once any row would draw a mini-bar, so the stacked bars below
    // read as tiers instead of three unlabelled hues; the field text clips
    // ahead of it so the two never collide.
    const showLegend = hasHarvestBars(entries);
    const legendW = showLegend ? this.measureHarvestLegend(ctx) : 0;
    if (fieldLine) {
      // Walk the urgency-ordered parts, leading each count with a 4px pip
      // tinted by kind (ready green / thirsty amber / growing dim) so a
      // colour-blind player scans the urgency from the figure; the cluster
      // clips ahead of the harvest legend so the two never collide.
      ctx.font = '10px ui-monospace, monospace';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      const fieldMaxW = PANEL_W - 24 - (legendW > 0 ? legendW + 10 : 0);
      let fx = x + 12;
      const fieldRight = x + 12 + fieldMaxW;
      const parts = fieldStatusParts(fieldStatusCounts(fieldSamples));
      for (let pi = 0; pi < parts.length; pi++) {
        const part = parts[pi];
        const seg = `${part.count} ${part.label}${pi < parts.length - 1 ? ',' : ''}`;
        const segW = ctx.measureText(seg).width;
        if (fx + 6 + segW > fieldRight) break;
        ctx.fillStyle = part.kind === 'ready' ? GREEN : part.kind === 'thirsty' ? AMBER : DIM;
        ctx.fillRect(fx, y + 27, 4, 4);
        ctx.fillStyle = HINT;
        ctx.fillText(seg, fx + 6, y + 24);
        fx += 6 + segW + 6;
      }
    }
    if (showLegend) {
      this.drawHarvestLegend(ctx, x + PANEL_W - 12, y + 24);
    }

    // Shared denominator for the per-row harvest mini-bars so every crop's
    // bar reads on the same scale (busiest crop fills the track).
    const maxHarvest = maxLifetimeHarvest(entries);

    for (let i = 0; i < entries.length; i++) {
      const e: CropJournalEntry = entries[i];
      const ry = y + 30 + fieldH + i * ROW_H;
      // Row separator line.
      if (i > 0) {
        ctx.fillStyle = 'rgba(74, 59, 110, 0.55)';
        ctx.fillRect(x + 12, ry - 2, PANEL_W - 24, 1);
      }
      // Name + season pill on left, sell/seed prices on right.
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(e.name, x + 12, ry);
      // Best-season + growth line. When the crop's best season is the
      // CURRENT one, tint the season word green and append an "in season"
      // tag so the player sees at a glance what to plant now; otherwise it
      // stays dim like the rest of the reference text.
      const inSeason = isBestSeasonNow(e.bestSeason, time.season);
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = inSeason ? GREEN : HINT;
      ctx.fillText(e.bestSeason, x + 12, ry + 14);
      const seasonW = ctx.measureText(e.bestSeason).width;
      ctx.fillStyle = HINT;
      ctx.fillText(`  -  ${e.growthDays}d to ripe`, x + 12 + seasonW, ry + 14);
      if (inSeason) {
        const restW = ctx.measureText(`  -  ${e.growthDays}d to ripe`).width;
        ctx.fillStyle = GREEN;
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.fillText('  in season', x + 12 + seasonW + restW, ry + 14);
      }

      ctx.fillStyle = GOLD;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${e.sellPrice}g`, x + PANEL_W - 12, ry);
      ctx.fillStyle = DIM;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`seed ${e.seedPrice}g`, x + PANEL_W - 12, ry + 14);

      // Lifetime tally on the second sub-line.
      ctx.textAlign = 'left';
      ctx.font = '10px ui-monospace, monospace';
      // A 4px pip leads the sown tally, tinted by the crop's lifetime
      // progress (never-sown dim / sown-but-unreaped amber / has-harvested
      // green) so the row's leading figure scans the same way the field-
      // status + streak pips do — the journal's accent palette reads across
      // the live field, the lifetime sown anchor, and the best streak. The
      // text indents past the pip.
      const pip = sownPipState(e);
      ctx.fillStyle = pip === 'harvested' ? GREEN : pip === 'sown' ? AMBER : DIM;
      ctx.fillRect(x + 12, ry + 30, 4, 4);
      const sownStr = `sown ${e.sown}`;
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(sownStr, x + 12 + 7, ry + 28);
      const sownW = 7 + ctx.measureText(sownStr).width;

      let runX = x + 12 + sownW + 10;
      const normal = e.normal;
      const silver = e.silver;
      const gold = e.gold;
      if (normal > 0) {
        ctx.fillStyle = TEXT_COLOR;
        const s = `${normal}n`;
        ctx.fillText(s, runX, ry + 28);
        runX += ctx.measureText(s).width + 8;
      }
      if (silver > 0) {
        ctx.fillStyle = SILVER;
        const s = `${silver}s`;
        ctx.fillText(s, runX, ry + 28);
        runX += ctx.measureText(s).width + 8;
      }
      if (gold > 0) {
        ctx.fillStyle = GOLD;
        const s = `${gold}g`;
        ctx.fillText(s, runX, ry + 28);
        runX += ctx.measureText(s).width + 8;
      }
      if (e.bestStreak > 0) {
        const s = `streak ${e.bestStreak}`;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'right';
        const sw = ctx.measureText(s).width;
        // Small green pip just left of the text, mirroring the field-status
        // pips up top so the journal's accent palette reads across both
        // digests (live field + lifetime streak).
        ctx.fillStyle = GREEN;
        ctx.fillRect(x + PANEL_W - 12 - sw - 8, ry + 30, 4, 4);
        ctx.fillText(s, x + PANEL_W - 12, ry + 28);
      }
      // Ribbon — heaviest single-day harvest. Sits one line below the
      // sown/streak strip, only when the player has actually set one. A tiny
      // rosette/medal pip marks it so the record reads as an award at a
      // glance, not just text; the text shifts right to clear the glyph.
      if (e.ribbonCount > 0) {
        const ribbonY = ry + 40 - 7;
        ctx.fillStyle = '#F0A828';
        for (const [cx, cy] of ribbonMedalGlyph()) {
          ctx.fillRect(x + 12 + cx, ribbonY + cy, 1, 1);
        }
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        const tag = e.ribbonWhen ? ` -  ${e.ribbonWhen}` : '';
        ctx.fillText(`ribbon: ${e.ribbonCount} in a day${tag}`, x + 12 + 8, ribbonY);
      }

      // Harvest mini-bar — a tiny stacked bar in the row's bottom-right
      // clear space so the lifetime tally scans visually, not just as the
      // n/s/g text above it. Length is this crop's share of the busiest
      // crop's total (shared scale); segments are normal / silver / gold
      // tinted to match the tally colours. A faint track shows the full
      // scale so a small crop reads as small, not just short. Skipped on a
      // fresh save / a crop with nothing harvested.
      const segs = harvestBarSegments(e, maxHarvest, BAR_W);
      if (segs.total > 0) {
        const barRight = x + PANEL_W - 12;
        const barLeft = barRight - BAR_W;
        const by = ry + 36;
        // Faint full-width track.
        ctx.fillStyle = 'rgba(74, 59, 110, 0.45)';
        ctx.fillRect(barLeft, by, BAR_W, BAR_H);
        // Stacked filled segments left-to-right: normal, silver, gold.
        let sx = barLeft;
        if (segs.normal > 0) {
          ctx.fillStyle = TEXT_COLOR;
          ctx.fillRect(sx, by, segs.normal, BAR_H);
          sx += segs.normal;
        }
        if (segs.silver > 0) {
          ctx.fillStyle = SILVER;
          ctx.fillRect(sx, by, segs.silver, BAR_H);
          sx += segs.silver;
        }
        if (segs.gold > 0) {
          ctx.fillStyle = GOLD;
          ctx.fillRect(sx, by, segs.gold, BAR_H);
        }
        // In-season outline — when the crop's best season is the current
        // one (the same flag that tints the season word + "in season" tag),
        // ring the whole mini-bar in green so the "plant this now" advice
        // ties to the visual tally, not just the text above it.
        if (inSeason) {
          ctx.strokeStyle = GREEN;
          ctx.lineWidth = 1;
          ctx.strokeRect(barLeft - 0.5, by - 0.5, BAR_W + 1, BAR_H + 1);
        }
      }
    }

    // Festival forecast footer.
    if (festivals.length > 0) {
      const fy = y + 30 + fieldH + entries.length * ROW_H + 4;
      ctx.fillStyle = 'rgba(74, 59, 110, 0.55)';
      ctx.fillRect(x + 12, fy - 4, PANEL_W - 24, 1);
      ctx.fillStyle = TITLE_COLOR;
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('next festivals', x + 12, fy);
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(festivals.join('  -  '), x + 12, fy + 12);
    }

    // Compost ledger line — sits just above the close hint when the
    // player has ever applied a fertilizer bag. Pulled from the pure
    // compostLedgerLine() formatter so the panel doesn't grow a
    // ledger-state dependency directly.
    if (ledgerLine.length > 0) {
      ctx.fillStyle = GREEN;
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ledgerLine, x + PANEL_W / 2, y + h - 30);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('; or Esc to close', x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }

  /** The tier swatch colour for the harvest-bar legend (matches the bar). */
  private harvestTierColor(tier: 'normal' | 'silver' | 'gold'): string {
    return tier === 'gold' ? GOLD : tier === 'silver' ? SILVER : TEXT_COLOR;
  }

  /** Pixel width of the harvest-bar legend, for right-aligned placement. */
  private measureHarvestLegend(ctx: CanvasRenderingContext2D): number {
    ctx.font = '9px ui-monospace, monospace';
    const SWATCH = 6;
    const SWATCH_GAP = 3;
    const ITEM_GAP = 8;
    const items = harvestBarLegend();
    let w = 0;
    for (let i = 0; i < items.length; i++) {
      w += SWATCH + SWATCH_GAP + ctx.measureText(items[i].label).width;
      if (i < items.length - 1) w += ITEM_GAP;
    }
    return w;
  }

  /**
   * Draw the harvest-bar legend ending at right edge `rightX`, baseline-
   * aligned to `topY`: a small colour swatch + tier label per tier, in the
   * same normal/silver/gold order the per-row mini-bar stacks, so the bar
   * reads as a key'd tier breakdown rather than three unlabelled hues.
   */
  private drawHarvestLegend(
    ctx: CanvasRenderingContext2D,
    rightX: number,
    topY: number,
  ): void {
    const items = harvestBarLegend();
    const w = this.measureHarvestLegend(ctx);
    const SWATCH = 6;
    const SWATCH_GAP = 3;
    const ITEM_GAP = 8;
    let lx = rightX - w;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '9px ui-monospace, monospace';
    for (const item of items) {
      ctx.fillStyle = this.harvestTierColor(item.tier);
      ctx.fillRect(lx, topY + 1, SWATCH, SWATCH);
      lx += SWATCH + SWATCH_GAP;
      ctx.fillStyle = HINT;
      ctx.fillText(item.label, lx, topY);
      lx += ctx.measureText(item.label).width + ITEM_GAP;
    }
  }
}
