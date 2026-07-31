// Fish catalog — small static table of catchable fish.
//
// Kept separate from `fishing.ts` so the state-machine module stays
// focused on flow. Each fish has a sell price (for the future cooking
// pot / well-side selling), a relative `weight` for the bite roll, and
// a label used by HUD toasts.

/** Identifier keys for every catchable fish. */
export type FishKey = 'minnow' | 'carp' | 'bass' | 'trout' | 'pike';

/** Static metadata per fish. */
export interface FishDef {
  name: string;
  /** Gold earned when sold raw. */
  sellPrice: number;
  /** Relative spawn weight in the bite-pool. Higher = more common. */
  weight: number;
}

export const FISH: Record<FishKey, FishDef> = {
  minnow: { name: 'Silver Minnow', sellPrice: 5, weight: 45 },
  carp:   { name: 'River Carp',    sellPrice: 12, weight: 25 },
  bass:   { name: 'Striped Bass',  sellPrice: 22, weight: 15 },
  trout:  { name: 'Speckled Trout',sellPrice: 30, weight: 10 },
  pike:   { name: 'Old Pike',      sellPrice: 60, weight: 5 },
};

/** All fish keys, listed in catalog declaration order. */
export const FISH_KEYS: FishKey[] = Object.keys(FISH) as FishKey[];

/**
 * Picks a fish key weighted by `weight`. Accepts any rng returning
 * a number in [0, 1). Pure — does not mutate the catalog.
 */
export function pickFish(rng: () => number): FishKey {
  const total = FISH_KEYS.reduce((s, k) => s + FISH[k].weight, 0);
  let r = rng() * total;
  for (const k of FISH_KEYS) {
    r -= FISH[k].weight;
    if (r <= 0) return k;
  }
  return FISH_KEYS[FISH_KEYS.length - 1];
}
