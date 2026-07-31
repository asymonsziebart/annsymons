// Animal happiness — daily petting/care nudges fancy-egg odds + pet tips.
//
// Three small additions to the existing pet loops:
//
//   1. Coops carry a `happiness` 0..100 stat. Collecting eggs from the
//      coop once per day bumps it by COOP_HAPPINESS_COLLECT. Feeding
//      the coop (E adjacent, no eggs to collect) bumps it by
//      COOP_HAPPINESS_FEED. Happiness slowly decays one point per day.
//
//   2. The fancy-egg rate gets a happiness bonus on top of the tier
//      base: rate = FANCY_EGG_RATE[tier] + happiness/100 * MAX_BONUS.
//      A maxed-out happy coop pushes the deluxe rate to ~24%.
//
//   3. Dog + cat already track petStreak; we surface a small flat
//      "bonus" on top of the streak-driven daily tip. petStreak 8+
//      pays +1g, 12+ pays +2g, 14 (cap) pays +3g. Combined with the
//      streak math this means a fully maxed-out streak earns slightly
//      more than the pure linear payout — a small \"compounding\" reward.
//
// Pure module: read/write a few well-defined fields, no IO.

import type { PlacedCoop } from './coop';
import type { FarmDogState } from './farm-dog';
import type { FarmCatState } from './farm-cat';

/** Happiness boost when the player collects eggs from a coop today. */
export const COOP_HAPPINESS_COLLECT = 5;
/** Happiness boost when the player feeds an idle coop (no eggs to collect). */
export const COOP_HAPPINESS_FEED = 3;
/** Daily decay so happiness drifts back down without daily interaction. */
export const COOP_HAPPINESS_DECAY = 1;
/** Cap. Happiness never exceeds this. */
export const COOP_HAPPINESS_MAX = 100;
/** Max fancy-egg-rate bonus added on top of the tier base. */
export const FANCY_HAPPINESS_BONUS = 0.06;

/** Coop schema augment — happiness + last-care day. Both optional/lazy. */
export interface CoopHappinessFields {
  happiness?: number;
  /** Day of the last successful care bump (egg collect or feed). -1 sentinel. */
  lastCareDay?: number;
}

/** Reads the happiness field, defaulting to 0 for older saves. */
export function coopHappiness(coop: PlacedCoop & CoopHappinessFields): number {
  return Math.max(0, Math.min(COOP_HAPPINESS_MAX, coop.happiness ?? 0));
}

/** Apply happiness boost for collecting eggs today. Returns the new value. */
export function bumpCoopHappinessCollect(
  coop: PlacedCoop & CoopHappinessFields,
  day: number,
): number {
  return applyCoopBump(coop, day, COOP_HAPPINESS_COLLECT);
}

/** Apply happiness boost for feeding an idle coop today. Returns the new value. */
export function bumpCoopHappinessFeed(
  coop: PlacedCoop & CoopHappinessFields,
  day: number,
): number {
  return applyCoopBump(coop, day, COOP_HAPPINESS_FEED);
}

function applyCoopBump(
  coop: PlacedCoop & CoopHappinessFields,
  day: number,
  amount: number,
): number {
  if (coop.lastCareDay === day) {
    // Already cared for today — no further bump.
    return coopHappiness(coop);
  }
  coop.lastCareDay = day;
  coop.happiness = Math.min(COOP_HAPPINESS_MAX, coopHappiness(coop) + amount);
  return coop.happiness;
}

/**
 * Day-rollover decay. Walk every coop and drop happiness by
 * COOP_HAPPINESS_DECAY (floored at 0). Returns the count of coops
 * whose happiness actually dropped (for the day summary).
 */
export function decayCoopHappiness(coops: Array<PlacedCoop & CoopHappinessFields>): number {
  let n = 0;
  for (const c of coops) {
    const before = coopHappiness(c);
    if (before <= 0) continue;
    c.happiness = Math.max(0, before - COOP_HAPPINESS_DECAY);
    n += 1;
  }
  return n;
}

/**
 * Compute the fancy-egg rate for a coop, factoring in tier-base AND
 * happiness bonus. Pass the tier's base rate from FANCY_EGG_RATE; the
 * happiness adds up to FANCY_HAPPINESS_BONUS on top.
 */
export function coopFancyRate(
  coop: PlacedCoop & CoopHappinessFields,
  baseRate: number,
): number {
  const h = coopHappiness(coop) / COOP_HAPPINESS_MAX;
  return baseRate + h * FANCY_HAPPINESS_BONUS;
}

/**
 * Pet-streak driven bonus on top of the existing dog/cat tip. Returns
 * the flat extra gold paid: streak 8-11 -> +1, 12-13 -> +2, 14 -> +3.
 * Cumulative with the linear streak math the existing pet loops use.
 */
export function streakBonus(streak: number): number {
  if (streak >= 14) return 3;
  if (streak >= 12) return 2;
  if (streak >= 8) return 1;
  return 0;
}

/** Convenience: total bonus for a dog or cat with the given state. */
export function petTipBonus(state: FarmDogState | FarmCatState): number {
  return streakBonus(state.petStreak ?? 0);
}

/** Human-readable mood label for the HUD / journal — never empty. */
export function coopMoodLabel(h: number): string {
  if (h >= 80) return 'thriving';
  if (h >= 55) return 'content';
  if (h >= 25) return 'okay';
  if (h > 0) return 'restless';
  return 'cold';
}
