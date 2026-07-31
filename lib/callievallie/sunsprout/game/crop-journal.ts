// Crop journal — a per-crop lifetime tally + the data underneath the `;`
// panel. The journal records:
//
//   - sown   : total seeds planted (across all qualities)
//   - harvested by tier (normal / silver / gold)
//   - best streak : longest watered-day streak ever achieved
//
// Everything here is pure. The Game wires plant() / harvest() through
// recordSown() and recordHarvest() so the counters tick in lock-step
// with the gameplay loop. Persistence is handled in persistence.ts.

import type { Player } from '../world/world';
import { CROPS, CROP_KEYS } from './crops';
import type { CropQuality } from './crop-quality';
import { festivalCalendar } from './festivals';
import type { TimeOfDay } from './time';

/** Per-crop running totals. */
export interface CropJournalRow {
  sown: number;
  normal: number;
  silver: number;
  gold: number;
  bestStreak: number;
  /**
   * Heaviest single-day harvest count for this crop across the run.
   * Bumped at every recordHarvest call when today's running tally
   * exceeds the previous record. The `ribbonDay` field tags which
   * (season,day) earned the ribbon so the journal can flavour it.
   */
  bestDayHarvest?: number;
  ribbonSeason?: number;
  ribbonDay?: number;
  /** Internal running tally for the current in-game day. */
  todayHarvest?: number;
  todayKey?: string;
}

/** Journal map keyed by crop key (wheat / tomato / pumpkin / flower). */
export type CropJournal = Record<string, CropJournalRow>;

/** Lazy accessor — creates a fresh empty entry on first read. */
export function getJournal(player: Player): CropJournal {
  const p = player as Player & { cropJournal?: CropJournal };
  if (!p.cropJournal) p.cropJournal = {};
  return p.cropJournal;
}

function row(journal: CropJournal, cropKey: string): CropJournalRow {
  if (!journal[cropKey]) {
    journal[cropKey] = { sown: 0, normal: 0, silver: 0, gold: 0, bestStreak: 0 };
  }
  return journal[cropKey];
}

/** Increment the sown counter for a crop. */
export function recordSown(player: Player, cropKey: string): void {
  if (!CROPS[cropKey]) return;
  const r = row(getJournal(player), cropKey);
  r.sown += 1;
}

/**
 * Increment the right harvest bucket. Optionally pass the water-streak
 * the crop had at harvest time so we can update the best-streak record.
 *
 * Pass `time` (as `{ season, day }`) so we can attribute today's harvest
 * to a single calendar day and update the per-crop ribbon (heaviest
 * single-day yield ever). Calls without a time field still work — the
 * ribbon just won't be touched.
 */
export function recordHarvest(
  player: Player,
  cropKey: string,
  quality: CropQuality,
  streak: number = 0,
  time?: { season: number; day: number },
): void {
  if (!CROPS[cropKey]) return;
  const r = row(getJournal(player), cropKey);
  if (quality === 'gold') r.gold += 1;
  else if (quality === 'silver') r.silver += 1;
  else r.normal += 1;
  if (streak > r.bestStreak) r.bestStreak = streak;
  if (time) {
    const key = `${time.season}:${time.day}`;
    if (r.todayKey !== key) {
      r.todayKey = key;
      r.todayHarvest = 0;
    }
    r.todayHarvest = (r.todayHarvest ?? 0) + 1;
    if ((r.todayHarvest ?? 0) > (r.bestDayHarvest ?? 0)) {
      r.bestDayHarvest = r.todayHarvest;
      r.ribbonSeason = time.season;
      r.ribbonDay = time.day;
    }
  }
}

/** Total harvest count (all tiers) for a crop. */
export function totalHarvest(row: CropJournalRow): number {
  return row.normal + row.silver + row.gold;
}

/** "Best season" advice for a crop — purely lore right now (all crops can
 *  grow year-round in v0.x), but tied to the catalog so future season
 *  gating drops in cleanly. */
const BEST_SEASON_HINT: Record<string, string> = {
  wheat: 'Spring',
  tomato: 'Summer',
  pumpkin: 'Fall',
  flower: 'any',
};

export function bestSeasonHint(cropKey: string): string {
  return BEST_SEASON_HINT[cropKey] ?? 'any';
}

/** Season-index → name, for matching a crop's best-season hint to the clock. */
const SEASON_INDEX_NAME = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/**
 * True when a crop's best-season hint matches the CURRENT season, so the
 * journal can tint "plant this now" advice. A hint of 'any' (crops that
 * grow year-round, like flowers) is never highlighted — there's no single
 * best window to call out. Pure: compares the catalog hint string to the
 * clock's season index. Off-range seasons wrap via modulo so it stays
 * robust if the season space ever grows.
 */
export function isBestSeasonNow(bestSeason: string, season: number): boolean {
  if (bestSeason === 'any') return false;
  const name = SEASON_INDEX_NAME[((season % 4) + 4) % 4];
  return bestSeason === name;
}

/** Pure summary row for the journal panel + unit tests. */
export interface CropJournalEntry {
  key: string;
  name: string;
  seedPrice: number;
  sellPrice: number;
  growthDays: number;
  bestSeason: string;
  sown: number;
  normal: number;
  silver: number;
  gold: number;
  bestStreak: number;
  /** Heaviest single-day harvest count this crop ever produced. 0 when none. */
  ribbonCount: number;
  /** Human-readable label for the ribbon day, e.g. "Fall d4" or undefined. */
  ribbonWhen?: string;
}

/** Season-index → short two-letter label used for ribbons + festivals. */
const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/** Format a (season, day) record as "Fall d4" / "Spring d1". */
export function formatRibbonWhen(season: number | undefined, day: number | undefined): string | undefined {
  if (season === undefined || day === undefined) return undefined;
  const name = SEASON_NAMES[Math.abs(season) % 4] ?? 'Spring';
  return `${name} d${day}`;
}

/** Snapshot every crop with current catalog + journal data. */
export function buildJournal(player: Player): CropJournalEntry[] {
  const j = getJournal(player);
  return CROP_KEYS.map((key) => {
    const crop = CROPS[key];
    const r = j[key] ?? { sown: 0, normal: 0, silver: 0, gold: 0, bestStreak: 0 };
    // Total days to reach harvest = stages * daysPerStage (each watered day = one stage step).
    return {
      key,
      name: crop.name,
      seedPrice: crop.seedPrice,
      sellPrice: crop.sellPrice,
      growthDays: (crop.growthStages - 1) * crop.daysPerStage,
      bestSeason: bestSeasonHint(key),
      sown: r.sown,
      normal: r.normal,
      silver: r.silver,
      gold: r.gold,
      bestStreak: r.bestStreak,
      ribbonCount: r.bestDayHarvest ?? 0,
      ribbonWhen: formatRibbonWhen(r.ribbonSeason, r.ribbonDay),
    };
  });
}

/** Festival forecast tucked at the bottom of the journal. */
export function nextFestivals(time: TimeOfDay, count: number = 2): string[] {
  return festivalCalendar(time)
    .slice(0, count)
    .map((f) => `${f.name}: ${f.daysUntil === 0 ? 'today' : `${f.daysUntil}d`}`);
}

// ---------------------------------------------------------------------
// Field status — a live "right now" digest of the crops actually growing
// in the world, so the reference journal ties back to the current farm.
// The journal had only lifetime tallies; this header answers "what does
// my field need today?" at a glance: how many crops are growing, how
// many are ready to harvest, and how many are thirsty (un-watered today).
// ---------------------------------------------------------------------

/** One live crop on the field, reduced to just the fields the digest needs. */
export interface FieldCropSample {
  /** Current growth stage (0-indexed). */
  stage: number;
  /** Stages this crop needs to fully ripen. */
  growthStages: number;
  /** True when the crop was watered today (reset at the day rollover). */
  watered: boolean;
}

/** Disjoint field tallies. `ready + growing == total`; `thirsty <= growing`. */
export interface FieldStatus {
  /** Total crops on the field. */
  total: number;
  /** Crops at their final stage — harvest now. */
  ready: number;
  /** Crops still maturing (stage below the final one). */
  growing: number;
  /** Growing crops not yet watered today — they need attention. */
  thirsty: number;
}

/**
 * Tally the live field into ready / growing / thirsty buckets. A crop is
 * `ready` once its stage reaches growthStages-1 (the same gate harvest()
 * uses); everything else is `growing`. Of the growing crops, the ones not
 * watered today are `thirsty` — a ready crop is never counted thirsty
 * since watering won't help it. Pure: reads only the samples.
 */
export function fieldStatusCounts(samples: readonly FieldCropSample[]): FieldStatus {
  const status: FieldStatus = { total: 0, ready: 0, growing: 0, thirsty: 0 };
  for (const s of samples) {
    status.total += 1;
    if (s.stage >= s.growthStages - 1) {
      status.ready += 1;
    } else {
      status.growing += 1;
      if (!s.watered) status.thirsty += 1;
    }
  }
  return status;
}

/**
 * Render the field status as one compact, urgency-ordered caption:
 * \"4 growing, 2 ready to harvest, 1 thirsty\". Ready leads when present
 * (it's the immediate payoff), then growing, then a thirsty nudge. ''
 * when the field is empty so the journal collapses the band. Pure.
 */
export function fieldStatusSummary(status: FieldStatus): string {
  if (status.total === 0) return '';
  const parts: string[] = [];
  if (status.ready > 0) parts.push(`${status.ready} ready to harvest`);
  if (status.growing > 0) parts.push(`${status.growing} growing`);
  if (status.thirsty > 0) parts.push(`${status.thirsty} thirsty`);
  return parts.join(', ');
}

/** Urgency bucket of one field-status part, for the panel's tinted pip. */
export type FieldStatusKind = 'ready' | 'growing' | 'thirsty';

/** One \"{count} {label}\" segment of the field digest + its pip kind. */
export interface FieldStatusPart {
  kind: FieldStatusKind;
  count: number;
  /** Bare label without the count, e.g. \"ready to harvest\". */
  label: string;
}

/**
 * The same urgency-ordered digest as fieldStatusSummary, but broken into
 * tagged parts so the panel can lead each count with a tiny tinted pip
 * (ready green / thirsty amber / growing dim) and a colour-blind player
 * scans the urgency from the count, not the hue alone. Zero buckets are
 * omitted; ready leads, then growing, then thirsty. Empty on a bare field
 * so the band collapses. Pure — reads only the status tally.
 */
export function fieldStatusParts(status: FieldStatus): FieldStatusPart[] {
  if (status.total === 0) return [];
  const out: FieldStatusPart[] = [];
  if (status.ready > 0) out.push({ kind: 'ready', count: status.ready, label: 'ready to harvest' });
  if (status.growing > 0) out.push({ kind: 'growing', count: status.growing, label: 'growing' });
  if (status.thirsty > 0) out.push({ kind: 'thirsty', count: status.thirsty, label: 'thirsty' });
  return out;
}

// ---------------------------------------------------------------------
// Harvest mini-bar — a tiny inline stacked bar per journal row so the
// lifetime tally scans visually, not just as text. The bar's overall
// length encodes how much of this crop you've harvested vs your busiest
// crop (a shared scale across rows), and it's split into normal / silver
// / gold segments so the quality mix reads at a glance.
// ---------------------------------------------------------------------

/** Pixel widths of a crop's stacked harvest bar, by quality tier. */
export interface HarvestBarSegments {
  normal: number;
  silver: number;
  gold: number;
  /** Total bar width (normal + silver + gold), 0 when nothing harvested. */
  total: number;
}

/**
 * The largest lifetime harvest total across every journal entry — the
 * denominator that puts all rows on one comparable scale. 0 on a fresh
 * save (no bars drawn). Pure.
 */
export function maxLifetimeHarvest(entries: readonly CropJournalEntry[]): number {
  let max = 0;
  for (const e of entries) {
    const total = e.normal + e.silver + e.gold;
    if (total > max) max = total;
  }
  return max;
}

/**
 * Whether ANY journal row would draw a harvest mini-bar — i.e. at least one
 * crop has been harvested. Drives the journal's bar legend: the n/s/g key
 * is only worth showing once a bar is actually on screen. Equivalent to
 * maxLifetimeHarvest(entries) > 0 but reads as intent. Pure.
 */
export function hasHarvestBars(entries: readonly CropJournalEntry[]): boolean {
  return maxLifetimeHarvest(entries) > 0;
}

/** One swatch + label of the harvest-bar legend, in tier order. */
export interface HarvestBarLegendItem {
  tier: 'normal' | 'silver' | 'gold';
  /** Short key label, e.g. "normal" / "silver" / "gold". */
  label: string;
}

/**
 * The harvest mini-bar legend, in the same left-to-right order the bar
 * stacks its segments (normal, silver, gold). Lets the journal header draw
 * a tiny "normal / silver / gold" key with a colour swatch per tier so the
 * stacked bar in each row is readable instead of three unlabelled hues. The
 * panel owns the tier colours (they live in the UI), so this only carries
 * the order + labels. Pure.
 */
export function harvestBarLegend(): HarvestBarLegendItem[] {
  return [
    { tier: 'normal', label: 'normal' },
    { tier: 'silver', label: 'silver' },
    { tier: 'gold', label: 'gold' },
  ];
}

/**
 * Lay out one crop's stacked harvest bar. The bar's overall length is
 * `total / maxTotal` of `fullWidth` (so the busiest crop fills the track
 * and the rest read proportionally), then split into normal / silver /
 * gold segments by their counts using a largest-remainder allocation so
 * the three segments always sum exactly to the bar length. Any tier with
 * a non-zero count is guaranteed at least 1px (stolen from the widest
 * segment) so a lone gold star never vanishes inside a big normal bar.
 *
 * Returns all-zero widths when nothing's been harvested, on a fresh save
 * (maxTotal 0), or for a non-positive fullWidth. Pure — no canvas.
 */
export function harvestBarSegments(
  entry: CropJournalEntry,
  maxTotal: number,
  fullWidth: number,
): HarvestBarSegments {
  const counts = [entry.normal, entry.silver, entry.gold];
  const total = counts[0] + counts[1] + counts[2];
  if (maxTotal <= 0 || total <= 0 || fullWidth <= 0) {
    return { normal: 0, silver: 0, gold: 0, total: 0 };
  }
  // Overall bar length for this crop on the shared scale (min 1px so an
  // existing-but-tiny harvest still shows a sliver).
  const barW = Math.max(1, Math.round((total / maxTotal) * fullWidth));
  // Largest-remainder allocation of barW across the three tiers.
  const ideal = counts.map((c) => (c / total) * barW);
  const widths = ideal.map((v) => Math.floor(v));
  let used = widths[0] + widths[1] + widths[2];
  const order = [0, 1, 2].sort((a, b) => (ideal[b] - widths[b]) - (ideal[a] - widths[a]));
  let k = 0;
  while (used < barW) {
    widths[order[k % 3]] += 1;
    used += 1;
    k += 1;
  }
  // Guarantee a non-zero tier is at least 1px, borrowing from the widest
  // segment so the total stays exact.
  for (let i = 0; i < 3; i++) {
    if (counts[i] > 0 && widths[i] === 0) {
      const widest = widths.indexOf(Math.max(...widths));
      if (widths[widest] > 1) {
        widths[widest] -= 1;
        widths[i] += 1;
      }
    }
  }
  return { normal: widths[0], silver: widths[1], gold: widths[2], total: barW };
}

/**
 * The lifetime-progress state of a crop's journal row, so the panel can
 * lead the "sown N" tally with a tinted pip the way the live-field digest
 * leads its counts. Three states form a tiny growth ladder:
 *   - 'none':       never sown — a dim pip (the crop's a blank page).
 *   - 'sown':       planted but nothing reaped yet — an amber pip (work in
 *                   progress, mirroring the field-thirsty cue).
 *   - 'harvested':  has produced at least one harvest — a green pip (this
 *                   crop has paid off), matching the streak/ready green.
 * Pure: reads only the entry's sown + tier counts.
 */
export type SownPipState = 'none' | 'sown' | 'harvested';

export function sownPipState(entry: CropJournalEntry): SownPipState {
  if (entry.normal + entry.silver + entry.gold > 0) return 'harvested';
  if (entry.sown > 0) return 'sown';
  return 'none';
}

/** A pixel cell coordinate for a 5x7 ribbon-medal glyph. */
export type RibbonMedalCell = readonly [number, number];

/**
 * A tiny 5x7 rosette/medal: a round disc head over two splayed ribbon
 * tails. Drawn before the heaviest-day "ribbon: N in a day" line so the
 * achievement reads as a marked rosette, not just text — mirroring the
 * almanac tournament glyph's medal vocabulary in the journal's gold-amber
 * ribbon tint. Pure: a static bitmap the panel paints one device pixel per
 * cell, so the symbol lives in the model like the other game glyphs.
 */
export function ribbonMedalGlyph(): readonly RibbonMedalCell[] {
  return [
    // Disc head — a 3-wide round medal on rows 0-2.
    [1, 0], [2, 0], [3, 0],
    [0, 1], [2, 1], [4, 1],
    [1, 2], [2, 2], [3, 2],
    // Crossing tails fanning out below.
    [1, 3], [3, 3],
    [1, 4], [3, 4],
    [0, 5], [4, 5],
    [0, 6], [4, 6],
  ];
}
