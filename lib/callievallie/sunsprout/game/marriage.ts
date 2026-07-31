// Marriage — the v0.5.0 capstone.
//
// Once the player has been engaged for at least WEDDING_WAIT_DAYS, they
// can hold the wedding and become married. Marriage is the terminal
// relationship state: you can't propose, gift-romance, or re-marry once
// hitched. A future tick will surface a "Hold Wedding" prompt at the
// village well and a Newlywed quest reward.
//
// Pure state module: no input wiring, no UI, no world coupling. Mutates
// only `player.marriage` on success.

import type { Player } from '../world/world';
import { CANDIDATES } from './hearts';

/** Wedding bell — calendar gating between engagement and marriage. */
export const WEDDING_WAIT_DAYS = 3;

export interface Marriage {
  /** NPC id of the spouse. */
  npcId: string;
  /** Day (TimeOfDay.day) the wedding was held. */
  day: number;
}

export type WeddingOutcome =
  | { kind: 'married'; npcId: string }
  | { kind: 'not-engaged' }
  | { kind: 'already-married'; toNpcId: string }
  | { kind: 'too-soon'; daysLeft: number };

/**
 * Hold the wedding. Requires an active engagement that's at least
 * WEDDING_WAIT_DAYS old. On 'married' we clear the engagement and set
 * `player.marriage`.
 */
export function holdWedding(player: Player, today: number): WeddingOutcome {
  if (player.marriage) {
    return { kind: 'already-married', toNpcId: player.marriage.npcId };
  }
  if (!player.engagement) return { kind: 'not-engaged' };
  const elapsed = Math.max(0, today - player.engagement.day);
  if (elapsed < WEDDING_WAIT_DAYS) {
    return { kind: 'too-soon', daysLeft: WEDDING_WAIT_DAYS - elapsed };
  }
  const npcId = player.engagement.npcId;
  player.marriage = { npcId, day: today };
  player.engagement = undefined;
  return { kind: 'married', npcId };
}

/** True once the player has held the wedding. */
export function isMarried(player: Player): boolean {
  return !!player.marriage;
}

/** Convenience: spouse NPC id, or null. */
export function spouseOf(player: Player): string | null {
  return player.marriage ? player.marriage.npcId : null;
}

/** Spouse's pretty name from CANDIDATES, or null. */
export function spouseName(player: Player): string | null {
  const id = spouseOf(player);
  if (!id) return null;
  return CANDIDATES[id]?.name ?? null;
}

/** Days since the wedding (0 on the same day). Null when not married. */
export function daysMarried(player: Player, today: number): number | null {
  if (!player.marriage) return null;
  return Math.max(0, today - player.marriage.day);
}
