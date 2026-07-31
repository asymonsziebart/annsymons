// Fishing rod upgrades — wood / copper / iron / gold tiers.
//
// Mirrors pickaxe-upgrades.ts and tools.ts: Vallie's shop sells
// incremental rod upgrades that tune two dials at once:
//
//   1. Bite window scale — how long the player has to hit `F` once a
//      fish bites. The wood rod uses the catalog default; each tier
//      stretches that window so escapes become rarer.
//   2. Fish-pool bias — a per-tier multiplier on each fish's catalog
//      weight. Higher tiers down-weight the common minnow and lift the
//      pike / trout slots so rare catches actually arrive.
//
// Cost table:
//
//   wood   -> copper  (250g)   +20% bite window, gentle rare bias
//   copper -> iron    (700g)   +40% bite window, stronger bias
//   iron   -> gold   (1800g)   +60% bite window, heavy bias
//
// The hooks `rodBiteWindowFor(player)` and `weightedFishPick(player)`
// are what fishing.ts / game.ts call — the upgrade takes effect on the
// next cast. Pure module: no IO, no canvas, no engine coupling.

import type { Player } from '../world/world';
import { FISH, FISH_KEYS, type FishKey } from './fish';
import { FISHING } from './fishing';

/** Tier identifiers, ascending. */
export type RodTier = 'wood' | 'copper' | 'iron' | 'gold';

export const ROD_TIERS: RodTier[] = ['wood', 'copper', 'iron', 'gold'];

/** Gold cost FROM the lower tier TO this tier. wood is free. */
export const ROD_UPGRADE_COST: Record<RodTier, number> = {
  wood: 0,
  copper: 250,
  iron: 700,
  gold: 1800,
};

/** Bite-window multiplier per tier — applied to FISHING.biteWindowMs. */
export const ROD_BITE_WINDOW_SCALE: Record<RodTier, number> = {
  wood: 1.0,
  copper: 1.2,
  iron: 1.4,
  gold: 1.6,
};

/**
 * Per-tier multiplier applied to each fish's catalog weight before the
 * weighted roll. Higher tiers down-weight the common minnow and lift
 * the rarer slots.
 */
export const ROD_FISH_BIAS: Record<RodTier, Record<FishKey, number>> = {
  wood:   { minnow: 1.0, carp: 1.0, bass: 1.0, trout: 1.0, pike: 1.0 },
  copper: { minnow: 0.85, carp: 1.1, bass: 1.25, trout: 1.4, pike: 1.5 },
  iron:   { minnow: 0.65, carp: 1.2, bass: 1.5, trout: 1.8, pike: 2.0 },
  gold:   { minnow: 0.4, carp: 1.1, bass: 1.8, trout: 2.4, pike: 3.2 },
};

/** Lazy reader — defaults to wood when unset. */
export function rodTier(player: Player): RodTier {
  const t = (player as Player & { rodTier?: RodTier }).rodTier;
  return t ?? 'wood';
}

/** Returns the next tier above `tier`, or null if maxed. */
export function rodNextTier(tier: RodTier): RodTier | null {
  const i = ROD_TIERS.indexOf(tier);
  if (i === -1 || i === ROD_TIERS.length - 1) return null;
  return ROD_TIERS[i + 1];
}

/** Cost from the player's current tier to the next, or null if maxed. */
export function rodUpgradeCost(player: Player): number | null {
  const next = rodNextTier(rodTier(player));
  if (!next) return null;
  return ROD_UPGRADE_COST[next];
}

export type RodUpgradeOutcome =
  | { kind: 'upgraded'; from: RodTier; to: RodTier; cost: number }
  | { kind: 'max-tier'; tier: RodTier }
  | { kind: 'not-enough-gold'; need: number; have: number };

/** Spend gold to bump the rod tier by one. */
export function upgradeRod(player: Player): RodUpgradeOutcome {
  const cur = rodTier(player);
  const next = rodNextTier(cur);
  if (!next) return { kind: 'max-tier', tier: cur };
  const need = ROD_UPGRADE_COST[next];
  if (player.gold < need) return { kind: 'not-enough-gold', need, have: player.gold };
  player.gold -= need;
  (player as Player & { rodTier?: RodTier }).rodTier = next;
  return { kind: 'upgraded', from: cur, to: next, cost: need };
}

/** Bite-window in ms for the player's current rod tier. */
export function rodBiteWindowFor(player: Player): number {
  return Math.floor(FISHING.biteWindowMs * ROD_BITE_WINDOW_SCALE[rodTier(player)]);
}

/**
 * Weighted fish pick using the player's current rod tier's bias on top
 * of the catalog weights. `rng()` returns a number in [0, 1). Defaults
 * to Math.random.
 */
export function weightedFishPick(player: Player, rng: () => number = Math.random): FishKey {
  const bias = ROD_FISH_BIAS[rodTier(player)];
  let total = 0;
  for (const k of FISH_KEYS) total += FISH[k].weight * bias[k];
  let r = rng() * total;
  for (const k of FISH_KEYS) {
    r -= FISH[k].weight * bias[k];
    if (r <= 0) return k;
  }
  return FISH_KEYS[FISH_KEYS.length - 1];
}

/** Pretty label for the upgrade toast / shop HUD. */
export function rodTierLabel(tier: RodTier): string {
  switch (tier) {
    case 'wood': return 'Wood Rod';
    case 'copper': return 'Copper Rod';
    case 'iron': return 'Iron Rod';
    case 'gold': return 'Gold Rod';
  }
}
