// Day-summary view model — pure helpers that turn a DaySummary into the
// rows + "best moment" highlight the morning sleep overlay renders.
//
// The sleep overlay used to list gold / harvest / dishes / hearts as flat
// monochrome rows. This module gives each row a category (so the UI can
// tint it + draw a small pixel glyph) and derives a single "best moment"
// line that names the standout of the slept day, so the recap reads like
// a page turn instead of a receipt. Pure + deterministic — no canvas, no
// IO — so the wording + ordering are unit-testable.

import type { DaySummary } from './sleep';

/** Category of a summary row — drives the tint + glyph in the overlay. */
export type SummaryRowKind = 'gold' | 'harvest' | 'dishes' | 'hearts' | 'quiet';

/** A single rendered row of the recap. */
export interface SummaryRow {
  kind: SummaryRowKind;
  text: string;
}

/**
 * Tint per category — pulled to mirror the toast colour-rail palette so
 * the recap shares the HUD's colour language (gold coin, sage hearts,
 * etc). Monochrome hex, no emoji (git-safe).
 */
export const SUMMARY_ROW_COLOR: Record<SummaryRowKind, string> = {
  gold: '#F0C24A',
  harvest: '#7CC55C',
  dishes: '#E8B07A',
  hearts: '#E47ACF',
  quiet: '#9D8FB8',
};

function fmtDelta(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Build the recap rows from a DaySummary. Gold + harvest always show
 * (they're the heartbeat of a farm day, even at zero); dishes + each
 * heart gain only show when they happened. An entirely empty day falls
 * back to a single calm "quiet day" row so the panel never renders blank.
 */
export function summaryRows(s: DaySummary): SummaryRow[] {
  const rows: SummaryRow[] = [];
  rows.push({ kind: 'gold', text: `Gold ${fmtDelta(s.goldDelta)}g` });
  rows.push({ kind: 'harvest', text: `Harvest ${fmtDelta(s.harvestDelta)}` });
  if (s.dishesDelta !== 0) {
    rows.push({ kind: 'dishes', text: `Dishes ${fmtDelta(s.dishesDelta)}` });
  }
  for (const hg of s.heartGains) {
    rows.push({ kind: 'hearts', text: `${hg.name} +${hg.delta} hearts` });
  }
  return rows;
}

/**
 * Pick the single standout of the slept day for the "best moment"
 * highlight. Priority leans toward the rarest, most memorable wins:
 *   1. a heart level-up (relationships are the slowest dial to move),
 *   2. a strong gold day (>= GOLD_HIGHLIGHT),
 *   3. a strong harvest (>= HARVEST_HIGHLIGHT),
 *   4. any dishes cooked,
 *   5. nothing notable -> null (the overlay then shows only the flavour).
 * Returns a warm one-liner, never a bare number.
 */
export const GOLD_HIGHLIGHT = 100;
export const HARVEST_HIGHLIGHT = 6;

export function bestMomentLine(s: DaySummary): string | null {
  if (s.heartGains.length > 0) {
    // Name the biggest single heart gain — that's the standout bond.
    const top = s.heartGains.reduce((a, b) => (b.delta > a.delta ? b : a));
    if (s.heartGains.length > 1) {
      return `Hearts warmed with ${top.name} and ${s.heartGains.length - 1} more.`;
    }
    return `Your bond with ${top.name} grew warmer.`;
  }
  if (s.goldDelta >= GOLD_HIGHLIGHT) {
    return `A handsome ${s.goldDelta}g day at market.`;
  }
  if (s.harvestDelta >= HARVEST_HIGHLIGHT) {
    return `The baskets came in heavy — ${s.harvestDelta} harvested.`;
  }
  if (s.dishesDelta > 0) {
    return `The kitchen was busy — ${s.dishesDelta} cooked.`;
  }
  return null;
}

/**
 * A continuity line that ties the slept day to the farm's whole story:
 * it threads the day's harvest into the lifetime crops-reaped tally from
 * the crop journal, so each morning the recap connects to the last
 * rather than reading as an isolated receipt.
 *
 * `lifetimeHarvest` is the career crops-reaped total (normal + silver +
 * gold across every crop) — the caller passes it in (computed from the
 * crop journal) so this module stays decoupled from the journal. The
 * tally is monotonic, so it never goes backward even on a day the bag
 * shrank from selling.
 *
 * Wording:
 *   never reaped       -> null (the overlay shows nothing; a first-day
 *                          farmer hasn't earned a career line yet)
 *   harvested yesterday-> "That brings your lifetime haul to N crops."
 *   none yesterday     -> "Lifetime haul holds at N crops."
 *
 * The "added today?" signal is the same harvestDelta the summary rows
 * already display, so the line stays consistent with the panel above it.
 */
export function continuityLine(s: DaySummary, lifetimeHarvest: number): string | null {
  if (lifetimeHarvest <= 0) return null;
  const noun = lifetimeHarvest === 1 ? 'crop' : 'crops';
  if (s.harvestDelta > 0) {
    return `That brings your lifetime haul to ${lifetimeHarvest} ${noun}.`;
  }
  return `Lifetime haul holds at ${lifetimeHarvest} ${noun}.`;
}
