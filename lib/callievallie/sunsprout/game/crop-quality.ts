// Crop quality tiers — silver and gold star crops.
//
// Crops grown with sustained care (i.e. watered every single day of their
// growth window) ripen to a higher-quality tier that sells for more gold.
//
//   waterStreak == 0           → normal harvest
//   waterStreak == growthStages  → silver star (sells at 1.5x)
//   waterStreak >  growthStages  → gold star (sells at 2x; the player
//                                  kept watering past the ripen point so
//                                  their growth was "extra cared-for")
//
// Implementation strategy: extend the FarmCrop with a `waterStreak`
// counter that ticks up on every advanceDay() pass where the crop was
// watered. On harvest we resolve a quality and store the produce under
// a tier-flavoured inventory key (`<crop>_harvest`, `<crop>_harvest_silver`,
// `<crop>_harvest_gold`). The well's sellAllHarvest() walks every tier
// and pays the right multiplier.
//
// We keep the existing `<crop>_harvest` keys as the "normal" bucket so
// recipes, gifting and quests continue to work unchanged.
//
// Pure module — exposed helpers operate on a single FarmCrop or just a
// streak number, no World access required (so tests stay tiny).

/** Star tiers a harvested crop can wear. */
export type CropQuality = 'normal' | 'silver' | 'gold';

/** Sell-price multiplier for each tier. */
export const QUALITY_MULTIPLIER: Record<CropQuality, number> = {
  normal: 1,
  silver: 1.5,
  gold: 2,
};

/** Suffix appended to `<crop>_harvest` to bucket a tier's produce separately. */
export const QUALITY_SUFFIX: Record<CropQuality, string> = {
  normal: '',
  silver: '_silver',
  gold: '_gold',
};

/** Pretty label for the HUD / toast. */
export const QUALITY_LABEL: Record<CropQuality, string> = {
  normal: '',
  silver: 'silver-star',
  gold: 'gold-star',
};

/**
 * Resolve the quality tier a crop earns given its `waterStreak`
 * (the count of consecutive watered days) and the crop's total
 * `growthStages` (from CROPS[key]).
 *
 * - streak >= growthStages + 1 → gold
 * - streak >= growthStages     → silver
 * - else                       → normal
 */
export function qualityFromStreak(
  waterStreak: number,
  growthStages: number,
): CropQuality {
  if (waterStreak >= growthStages + 1) return 'gold';
  if (waterStreak >= growthStages) return 'silver';
  return 'normal';
}

/** Inventory key bucket for a (crop, quality) pair. */
export function harvestKey(cropKey: string, quality: CropQuality): string {
  return `${cropKey}_harvest${QUALITY_SUFFIX[quality]}`;
}

/**
 * Decode an inventory key back into (cropKey, quality) if it's a harvest
 * bucket, otherwise return null. Used by the well + recipes when iterating
 * the player's bag.
 */
export function parseHarvestKey(
  key: string,
): { cropKey: string; quality: CropQuality } | null {
  if (!key.endsWith('_harvest_silver') && !key.endsWith('_harvest_gold') && !key.endsWith('_harvest')) {
    return null;
  }
  if (key.endsWith('_harvest_silver')) {
    return { cropKey: key.slice(0, -'_harvest_silver'.length), quality: 'silver' };
  }
  if (key.endsWith('_harvest_gold')) {
    return { cropKey: key.slice(0, -'_harvest_gold'.length), quality: 'gold' };
  }
  return { cropKey: key.slice(0, -'_harvest'.length), quality: 'normal' };
}

/** Star-glyph hint for the (later) inventory badge. Monochrome by spec. */
export function qualityGlyph(quality: CropQuality): string {
  switch (quality) {
    case 'gold':
      return '**';
    case 'silver':
      return '*';
    case 'normal':
      return '';
  }
}

// ---------------------------------------------------------------------
// Quality heatmap — a per-crop tint band for the field overlay shown
// while the crop journal (`;`) is open. The player can't see, from the
// sprites alone, which tilled corners are about to earn a silver/gold
// star and which are languishing dry. This maps a crop's water-streak
// onto a small set of readable bands so the overlay can wash each crop
// tile with a colour the eye reads instantly.
// ---------------------------------------------------------------------

/** Heatmap band a crop falls into, coarsest-care first. */
export type QualityHeatTier = 'dry' | 'building' | 'almost' | 'silver' | 'gold';

export interface QualityHeat {
  /** Which readable band the crop's streak lands in. */
  tier: QualityHeatTier;
  /** Resolved quality tier (what it would harvest as right now). */
  quality: CropQuality;
  /** Overlay tint colour for the band. */
  color: string;
  /** Tint alpha — stronger as the crop nears / reaches a star tier. */
  alpha: number;
}

/** Band colours — reuse the journal panel's gold / silver / green language. */
export const HEAT_COLORS: Record<QualityHeatTier, string> = {
  dry: '#C85A4A', // a careless, un-watered crop — warns the player
  building: '#A3D77A', // a watered streak forming
  almost: '#F0A828', // one watered day from a silver star
  silver: '#D5D8DC',
  gold: '#F0C24A',
};

/**
 * Resolve the heatmap band for a crop's `waterStreak` against its
 * `growthStages`. The streak->quality ladder (see qualityFromStreak):
 *   streak >= growthStages + 1 -> gold star
 *   streak == growthStages     -> silver star
 *   streak == growthStages - 1 -> "almost" (one more watered day = silver)
 *   0 < streak < growthStages-1 -> "building" (alpha climbs with progress)
 *   streak == 0                 -> "dry" (no streak — won't star)
 *
 * Pure — a single number in, a tint band out. The overlay widget owns
 * the projection + draw; this owns the colour decision so it's testable.
 */
export function qualityHeat(
  waterStreak: number,
  growthStages: number,
): QualityHeat {
  const quality = qualityFromStreak(waterStreak, growthStages);
  const streak = Math.max(0, waterStreak);
  if (quality === 'gold') {
    return { tier: 'gold', quality, color: HEAT_COLORS.gold, alpha: 0.5 };
  }
  if (quality === 'silver') {
    return { tier: 'silver', quality, color: HEAT_COLORS.silver, alpha: 0.45 };
  }
  // Normal tier — decide between dry / building / almost.
  if (streak <= 0) {
    return { tier: 'dry', quality, color: HEAT_COLORS.dry, alpha: 0.16 };
  }
  if (streak >= growthStages - 1) {
    return { tier: 'almost', quality, color: HEAT_COLORS.almost, alpha: 0.42 };
  }
  // Building: alpha ramps from 0.18 toward 0.34 as the streak approaches
  // the silver threshold so a more-cared-for crop reads as warmer.
  const span = Math.max(1, growthStages - 1);
  const progress = Math.min(1, streak / span);
  const alpha = 0.18 + progress * 0.16;
  return { tier: 'building', quality, color: HEAT_COLORS.building, alpha };
}

// ---------------------------------------------------------------------
// Heatmap summary — a one-line tally of the field's care state so the
// player can act on the heatmap without scanning every tile. Counts how
// many crops sit in each band and renders a compact, priority-ordered
// sentence ("3 dry, 1 about to gold-star"). Pure: takes the (streak,
// growthStages) pairs the overlay already has, returns counts + a string.
// ---------------------------------------------------------------------

/** Per-band crop counts across the whole field. */
export type QualityHeatCounts = Record<QualityHeatTier, number>;

/** A single (streak, growthStages) pair for one crop on the field. */
export interface CropStreakSample {
  waterStreak: number;
  growthStages: number;
}

/** Tally how many crops fall into each heatmap band. Pure. */
export function qualityHeatCounts(samples: readonly CropStreakSample[]): QualityHeatCounts {
  const counts: QualityHeatCounts = { dry: 0, building: 0, almost: 0, silver: 0, gold: 0 };
  for (const s of samples) {
    const { tier } = qualityHeat(s.waterStreak, s.growthStages);
    counts[tier] += 1;
  }
  return counts;
}

/**
 * Pluralizing phrase for one band's count, e.g. "3 dry", "1 about to
 * gold-star". The "almost" band frames it as actionable ("about to
 * silver-star") rather than naming the band. Returns '' for a zero count.
 */
function bandPhrase(tier: QualityHeatTier, n: number): string {
  if (n <= 0) return '';
  switch (tier) {
    case 'dry':
      return `${n} dry`;
    case 'building':
      return n === 1 ? '1 growing a streak' : `${n} growing a streak`;
    case 'almost':
      return n === 1 ? '1 about to silver-star' : `${n} about to silver-star`;
    case 'silver':
      return `${n} silver-star`;
    case 'gold':
      return `${n} gold-star`;
  }
}

/**
 * A compact, priority-ordered summary line for the field's care state.
 * Order is "what needs me" first: dry (neglected) -> almost (one watering
 * from a star) -> building -> silver -> gold. Only non-zero bands appear.
 * Returns '' when there are no crops at all so the caller can hide the chip.
 *
 * Examples:
 *   "3 dry, 1 about to silver-star"
 *   "2 gold-star, 1 silver-star"   (a well-tended field, still informative)
 */
export function qualityHeatSummary(samples: readonly CropStreakSample[]): string {
  if (samples.length === 0) return '';
  const counts = qualityHeatCounts(samples);
  const order: QualityHeatTier[] = ['dry', 'almost', 'building', 'silver', 'gold'];
  const parts: string[] = [];
  for (const tier of order) {
    const phrase = bandPhrase(tier, counts[tier]);
    if (phrase) parts.push(phrase);
  }
  return parts.join(', ');
}

/**
 * One-shot toast text for the moment the crop journal opens onto a field
 * that has at least one neglected (dry) crop. The heatmap legend already
 * shows the same tally in the corner, but a player who opened the journal
 * for some other reason might not glance there — so we spill the summary
 * as a toast ONLY when there's something that actually needs them (>= 1
 * dry crop). A well-tended or empty field returns null so the toast stays
 * quiet and the spill never becomes noise.
 *
 * Pure: takes the same (streak, growthStages) samples the overlay builds,
 * returns the toast string or null. The caller decides when to fire it
 * (on the open transition) and pushes it through the toast queue.
 */
export function heatmapToastSpill(samples: readonly CropStreakSample[]): string | null {
  if (samples.length === 0) return null;
  const counts = qualityHeatCounts(samples);
  if (counts.dry <= 0) return null;
  const summary = qualityHeatSummary(samples);
  return summary.length > 0 ? `Field care: ${summary}.` : null;
}
