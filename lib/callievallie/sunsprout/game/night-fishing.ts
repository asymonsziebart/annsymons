// Late-night fishing perk — between 22:00 and 04:00 the bite pool
// biases toward rare fish. Layered on top of the existing rod-tier
// bias so a gold-rod player casting at midnight gets the compound
// benefit of both upgrades.
//
// Design intent: night-fishing is a deliberate trade-off. The player
// has to give up sleep / stamina rest to fish in the small hours;
// the payoff is meaningfully better odds of trout / pike. The bias is
// also a small DOWN-weight on the minnow so the night pool is
// objectively more lucrative, not just larger.
//
// Pure module: just the time-window predicate, the bias table, and a
// wrapper around weightedFishPick that combines both biases.

import type { Player } from '../world/world';
import type { TimeOfDay } from './time';
import { FISH, FISH_KEYS, type FishKey } from './fish';
import { ROD_FISH_BIAS, rodTier } from './rod-upgrades';

/** Hours during which the late-night bias applies (inclusive start, exclusive end). */
export const NIGHT_WINDOW_START = 22; // 22:00
export const NIGHT_WINDOW_END = 4;   // 04:00 (wraps past midnight)

/**
 * Per-fish multiplier applied on TOP of the rod-tier bias when the
 * player casts inside the late-night window. Strongly down-weights the
 * minnow; meaningfully lifts trout + pike.
 */
export const NIGHT_FISH_BIAS: Record<FishKey, number> = {
  minnow: 0.4,
  carp: 0.85,
  bass: 1.25,
  trout: 1.75,
  pike: 2.25,
};

/** True iff `hour` is inside [22:00, 04:00) (wraps midnight). */
export function isLateNightHour(hour: number): boolean {
  return hour >= NIGHT_WINDOW_START || hour < NIGHT_WINDOW_END;
}

/** Convenience: read the hour off TimeOfDay and apply the predicate. */
export function isLateNightFishing(time: TimeOfDay): boolean {
  return isLateNightHour(time.hour);
}

/**
 * Weighted fish pick that combines the rod-tier bias with the
 * late-night bias when active. Pass the in-game `time` so the
 * function can decide whether to apply the window bias. Pure; rng
 * defaults to Math.random.
 */
export function nightAwareFishPick(
  player: Player,
  time: TimeOfDay,
  rng: () => number = Math.random,
): FishKey {
  const rod = rodTier(player);
  const rodBias = ROD_FISH_BIAS[rod];
  const night = isLateNightFishing(time);
  let total = 0;
  for (const k of FISH_KEYS) {
    const nightMul = night ? NIGHT_FISH_BIAS[k] : 1;
    total += FISH[k].weight * rodBias[k] * nightMul;
  }
  let r = rng() * total;
  for (const k of FISH_KEYS) {
    const nightMul = night ? NIGHT_FISH_BIAS[k] : 1;
    r -= FISH[k].weight * rodBias[k] * nightMul;
    if (r <= 0) return k;
  }
  return FISH_KEYS[FISH_KEYS.length - 1];
}

/** One-line HUD flavour shown when the player casts during the window. */
export function nightFlavorLine(): string {
  return 'Late night cast — rare fish are moving.';
}
