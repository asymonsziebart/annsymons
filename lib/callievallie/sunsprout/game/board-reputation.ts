// Town board reputation — every completed weekly turn-in adds one rep
// point. Cumulative rep unlocks tiered reward multipliers AND
// surfaces a small reputation strip in the board flavour.
//
// Tier table (cumulative completions -> rep tier -> reward mult):
//   0..2  : Newcomer     1.00x
//   3..6  : Regular      1.15x
//   7..14 : Trusted      1.30x
//   15..24: Pillar       1.50x
//   25+   : Cornerstone  1.75x
//
// The completedCount already exists on BoardState (board.ts). This
// module is the pure tiering math + a wrapper that combines the
// quest's gold reward with the active multiplier so callers (and the
// board sprite / flavour line) speak the same numbers. The Game's
// E-press handler routes the turn-in through `applyRepBonus` so the
// player actually receives the boosted gold.
//
// Pure module: no IO, no canvas. Tests cover boundaries + the bonus
// gold derivation.

import type { Player } from '../world/world';
import { BOARD_QUESTS, type WeeklyQuest } from './board';

/** Identifier for each rep tier. */
export type RepTier =
  | 'newcomer'
  | 'regular'
  | 'trusted'
  | 'pillar'
  | 'cornerstone';

/** Per-tier metadata: name, threshold (inclusive lower), reward multiplier. */
export interface RepTierDef {
  key: RepTier;
  label: string;
  /** Inclusive lower bound on completedCount for this tier. */
  minCount: number;
  /** Gold-reward multiplier applied to BoardQuest payouts at this tier. */
  multiplier: number;
}

/** Tier table — ascending order of minCount. */
export const REP_TIERS: RepTierDef[] = [
  { key: 'newcomer',    label: 'Newcomer',    minCount: 0,  multiplier: 1.0 },
  { key: 'regular',     label: 'Regular',     minCount: 3,  multiplier: 1.15 },
  { key: 'trusted',     label: 'Trusted',     minCount: 7,  multiplier: 1.3 },
  { key: 'pillar',      label: 'Pillar',      minCount: 15, multiplier: 1.5 },
  { key: 'cornerstone', label: 'Cornerstone', minCount: 25, multiplier: 1.75 },
];

/** Look up the tier definition matching a given completedCount. */
export function repTier(completedCount: number): RepTierDef {
  // Walk descending so we find the highest matching threshold.
  for (let i = REP_TIERS.length - 1; i >= 0; i--) {
    const t = REP_TIERS[i];
    if (completedCount >= t.minCount) return t;
  }
  // Defensive — REP_TIERS[0] minCount is 0, so this is unreachable.
  return REP_TIERS[0];
}

/** Convenience for callers that don't carry the raw count. */
export function playerRepTier(player: Player): RepTierDef {
  const board = (player as Player & { board?: { completedCount: number } }).board;
  return repTier(board?.completedCount ?? 0);
}

/** Returns the next tier the player will earn, or null if at the cap. */
export function nextRepTier(completedCount: number): RepTierDef | null {
  for (const t of REP_TIERS) {
    if (t.minCount > completedCount) return t;
  }
  return null;
}

/** How many more board completions until the next tier; -1 at cap. */
export function completionsToNextTier(completedCount: number): number {
  const next = nextRepTier(completedCount);
  if (!next) return -1;
  return next.minCount - completedCount;
}

/**
 * Apply the active reputation multiplier to a quest's base gold reward.
 * Rounds to the nearest integer. Returns the boosted amount AND the
 * bonus delta so callers can post a separate money-log entry for the
 * bonus portion (audit trail keeps the base reward + bonus distinct).
 */
export function applyRepBonus(
  player: Player,
  quest: WeeklyQuest,
): { boosted: number; baseGold: number; bonus: number; tier: RepTierDef } {
  const tier = playerRepTier(player);
  const boosted = Math.round(quest.rewardGold * tier.multiplier);
  return {
    boosted,
    baseGold: quest.rewardGold,
    bonus: boosted - quest.rewardGold,
    tier,
  };
}

/** Pretty status line for the board's E-press hint toast. */
export function repBannerLine(player: Player): string {
  const tier = playerRepTier(player);
  const count = (player as Player & { board?: { completedCount: number } }).board?.completedCount ?? 0;
  const next = nextRepTier(count);
  const multTag = tier.multiplier > 1 ? ` (${Math.round((tier.multiplier - 1) * 100)}% reward bonus)` : '';
  if (!next) {
    return `Rep: ${tier.label} (${count} turn-ins)${multTag}`;
  }
  const togo = next.minCount - count;
  return `Rep: ${tier.label} (${count} turn-ins)${multTag} - ${togo} to ${next.label}`;
}

/** Listing of every catalogued board quest, for the lore / quest panel. */
export const REP_QUEST_COUNT = BOARD_QUESTS.length;
