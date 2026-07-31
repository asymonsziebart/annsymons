// Pickaxe upgrades — copper / iron / gold / diamond tiers.
//
// The player starts with a wooden pickaxe and Vallie's shop sells
// incremental upgrades:
//
//   wood    -> copper   (200g)
//   copper  -> iron     (600g)
//   iron    -> gold     (1500g)
//   gold    -> diamond  (3500g)
//
// Each upgrade shifts the gem-roll distribution toward rarer drops by
// applying a per-tier weight MULTIPLIER on top of the gems.ts catalog
// weights. The wooden pickaxe rolls vanilla catalog weights (so old
// saves and the existing tests still pass). Higher tiers steadily
// down-weight copper / iron and up-weight silver / gold / ruby.
//
// This is the natural mirror of `tools.ts` for the hoe + watering can:
//
//   - PICKAXE_TIERS catalog
//   - PICKAXE_UPGRADE_COST cost table
//   - pickaxeTier(player) accessor
//   - pickaxeNextTier(tier) helper
//   - upgradePickaxe(player) — atomic spend-and-upgrade
//   - weightedGemPick(player) — what mining.ts strike() actually rolls
//
// Pure module: no IO, no canvas, no engine coupling. The Game wires
// `weightedGemPick` into the pickaxe strike() callback so the upgrade
// takes effect the next swing.

import type { Player } from '../world/world';
import { GEMS, GEM_KEYS, type GemKey } from './gems';

/** Tier identifiers, ascending. */
export type PickaxeTier = 'wood' | 'copper' | 'iron' | 'gold' | 'diamond';

export const PICKAXE_TIERS: PickaxeTier[] = ['wood', 'copper', 'iron', 'gold', 'diamond'];

/** Gold cost of an upgrade FROM the lower tier TO this tier. wood is free. */
export const PICKAXE_UPGRADE_COST: Record<PickaxeTier, number> = {
  wood: 0,
  copper: 200,
  iron: 600,
  gold: 1500,
  diamond: 3500,
};

/**
 * Per-tier multiplier applied to each gem's base catalog weight before
 * we run the weighted roll. The deeper your pickaxe digs, the more the
 * pool skews toward rare drops.
 *
 * Design: copper still feels common at the wooden tier, but the diamond
 * tier roughly inverts the curve — ruby becomes a 1-in-4 hit rather
 * than 1-in-25.
 */
export const PICKAXE_GEM_BIAS: Record<PickaxeTier, Record<GemKey, number>> = {
  wood:    { copper: 1.0, iron: 1.0, silver: 1.0, gold: 1.0, ruby: 1.0 },
  copper:  { copper: 0.8, iron: 1.2, silver: 1.4, gold: 1.5, ruby: 1.6 },
  iron:    { copper: 0.5, iron: 1.0, silver: 1.8, gold: 2.0, ruby: 2.2 },
  gold:    { copper: 0.3, iron: 0.7, silver: 2.0, gold: 2.8, ruby: 3.2 },
  diamond: { copper: 0.15, iron: 0.4, silver: 1.8, gold: 3.5, ruby: 5.0 },
};

/** Lazy reader — defaults to wood when unset. */
export function pickaxeTier(player: Player): PickaxeTier {
  const t = (player as Player & { pickaxeTier?: PickaxeTier }).pickaxeTier;
  return t ?? 'wood';
}

/** Returns the next tier above `tier`, or null if maxed. */
export function pickaxeNextTier(tier: PickaxeTier): PickaxeTier | null {
  const i = PICKAXE_TIERS.indexOf(tier);
  if (i === -1 || i === PICKAXE_TIERS.length - 1) return null;
  return PICKAXE_TIERS[i + 1];
}

/** Cost from the player's current tier to the next, or null if maxed. */
export function pickaxeUpgradeCost(player: Player): number | null {
  const next = pickaxeNextTier(pickaxeTier(player));
  if (!next) return null;
  return PICKAXE_UPGRADE_COST[next];
}

export type PickaxeUpgradeOutcome =
  | { kind: 'upgraded'; from: PickaxeTier; to: PickaxeTier; cost: number }
  | { kind: 'max-tier'; tier: PickaxeTier }
  | { kind: 'not-enough-gold'; need: number; have: number };

/** Spend gold to bump the pickaxe tier by one. */
export function upgradePickaxe(player: Player): PickaxeUpgradeOutcome {
  const cur = pickaxeTier(player);
  const next = pickaxeNextTier(cur);
  if (!next) return { kind: 'max-tier', tier: cur };
  const need = PICKAXE_UPGRADE_COST[next];
  if (player.gold < need) return { kind: 'not-enough-gold', need, have: player.gold };
  player.gold -= need;
  (player as Player & { pickaxeTier?: PickaxeTier }).pickaxeTier = next;
  return { kind: 'upgraded', from: cur, to: next, cost: need };
}

/**
 * Weighted gem pick using the player's current pickaxe tier's bias on
 * top of the catalog weights. `rng()` returns a number in [0, 1). When
 * called with the default (no rng arg), uses Math.random.
 */
export function weightedGemPick(player: Player, rng: () => number = Math.random): GemKey {
  const bias = PICKAXE_GEM_BIAS[pickaxeTier(player)];
  let total = 0;
  for (const k of GEM_KEYS) total += GEMS[k].weight * bias[k];
  let r = rng() * total;
  for (const k of GEM_KEYS) {
    r -= GEMS[k].weight * bias[k];
    if (r <= 0) return k;
  }
  return GEM_KEYS[GEM_KEYS.length - 1];
}

/** Pretty label for the upgrade toast / shop HUD. */
export function pickaxeTierLabel(tier: PickaxeTier): string {
  switch (tier) {
    case 'wood': return 'Wood Pickaxe';
    case 'copper': return 'Copper Pickaxe';
    case 'iron': return 'Iron Pickaxe';
    case 'gold': return 'Gold Pickaxe';
    case 'diamond': return 'Diamond Pickaxe';
  }
}
