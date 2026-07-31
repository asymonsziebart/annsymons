// Gem catalog — small static table of mineable gems.
//
// Mirrors `fish.ts`: a flat record keyed by GemKey, plus a weighted picker
// so the upcoming mining minigame can roll a drop with seeded RNG. Kept
// separate from `mining.ts` so the state-machine module stays focused on
// flow, and the catalog can be imported standalone by the future shop /
// quest UIs without dragging the Pickaxe class along.
//
// Pricing tier targets the v0.4.0 mining caves loop: copper is roughly a
// wheat-tier filler, iron sits around carp money, silver beats trout, and
// gold/ruby are the pumpkin-tier payouts that justify the trip into the
// caves. Spawn weights skew heavily toward the cheap stuff so the rare
// gems still feel like a moment when they hit.

/** Identifier keys for every mineable gem. */
export type GemKey = 'copper' | 'iron' | 'silver' | 'gold' | 'ruby';

/** Static metadata per gem. */
export interface GemDef {
  name: string;
  /** Gold earned when sold raw. */
  sellPrice: number;
  /** Relative spawn weight in the strike-pool. Higher = more common. */
  weight: number;
  /** Hex colour the renderer will use for the procedural pebble sprite. */
  color: string;
}

export const GEMS: Record<GemKey, GemDef> = {
  copper: { name: 'Copper Nugget', sellPrice: 8,  weight: 45, color: '#B87333' },
  iron:   { name: 'Iron Chunk',    sellPrice: 18, weight: 28, color: '#8C8C9A' },
  silver: { name: 'Silver Vein',   sellPrice: 35, weight: 15, color: '#D5D8DC' },
  gold:   { name: 'Gold Nugget',   sellPrice: 70, weight: 8,  color: '#F0C24A' },
  ruby:   { name: 'Cave Ruby',     sellPrice: 140, weight: 4, color: '#C8324A' },
};

/** All gem keys, listed in catalog declaration order. */
export const GEM_KEYS: GemKey[] = Object.keys(GEMS) as GemKey[];

/**
 * Picks a gem key weighted by `weight`. Accepts any rng returning a
 * number in [0, 1). Pure — does not mutate the catalog. Mirrors
 * `pickFish()` so the two modules feel like siblings.
 */
export function pickGem(rng: () => number): GemKey {
  const total = GEM_KEYS.reduce((s, k) => s + GEMS[k].weight, 0);
  let r = rng() * total;
  for (const k of GEM_KEYS) {
    r -= GEMS[k].weight;
    if (r <= 0) return k;
  }
  return GEM_KEYS[GEM_KEYS.length - 1];
}

/**
 * Inventory key under which a mined gem is stored. The leading `gem-`
 * prefix keeps it disjoint from harvest / seed / fish / dish keys so the
 * existing well / inn sell loops never touch it accidentally.
 */
export function gemInventoryKey(key: GemKey): string {
  return `gem-${key}`;
}

/**
 * Coarse rarity bucket derived from spawn weight. Used by tooltips and
 * the upcoming codex / collection UI so we don't have to hand-curate a
 * second column in the catalog. Thresholds chosen so the current table
 * sorts cleanly into common (copper), uncommon (iron), rare (silver),
 * epic (gold), legendary (ruby).
 */
export type GemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export function gemRarity(key: GemKey): GemRarity {
  const w = GEMS[key].weight;
  if (w >= 40) return 'common';
  if (w >= 20) return 'uncommon';
  if (w >= 10) return 'rare';
  if (w >= 5)  return 'epic';
  return 'legendary';
}
