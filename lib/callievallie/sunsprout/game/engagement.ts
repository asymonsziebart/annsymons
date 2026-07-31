// Engagement — slice toward v0.5.0 marriage capstone.
//
// Once a candidate hits MAX_HEARTS (10), the player can offer a
// `bouquet` as a proposal token. Accepting one proposal locks all other
// candidates out: you can only be engaged to one villager at a time.
//
// Pure state module: no input wiring, no UI, no world coupling. A later
// tick will hook the `P` key to propose() and add a tiny dialogue line.

import type { Player } from '../world/world';
import { BOUQUET_KEY, CANDIDATES, MAX_HEARTS, getHearts } from './hearts';

/** Engagement record stored on the Player. */
export interface Engagement {
  /** NPC id of the fiancé. */
  npcId: string;
  /** Day (TimeOfDay.day) the proposal was accepted. */
  day: number;
}

/** Outcome of a propose() attempt — drives the toast string in game.ts. */
export type ProposalOutcome =
  | { kind: 'accepted'; npcId: string }
  | { kind: 'not-candidate' }
  | { kind: 'no-bouquet' }
  | { kind: 'too-few-hearts'; have: number; need: number }
  | { kind: 'already-engaged'; toNpcId: string };

/** Hearts required before a proposal will be accepted. */
export const PROPOSAL_HEART_REQ = MAX_HEARTS;

/**
 * Attempt a marriage proposal. On 'accepted' the player's bouquet count
 * decrements by one and `player.engagement` is set. The caller (UI /
 * game loop) is responsible for surfacing the dialogue line.
 *
 * Pure-ish: mutates `player.engagement` and `player.inventory[BOUQUET_KEY]`
 * only on success.
 */
export function propose(player: Player, npcId: string, day: number): ProposalOutcome {
  if (!CANDIDATES[npcId]) return { kind: 'not-candidate' };
  if (player.engagement) {
    return { kind: 'already-engaged', toNpcId: player.engagement.npcId };
  }
  const have = player.hearts ? getHearts(player.hearts, npcId) : 0;
  if (have < PROPOSAL_HEART_REQ) {
    return { kind: 'too-few-hearts', have, need: PROPOSAL_HEART_REQ };
  }
  const bouquets = player.inventory[BOUQUET_KEY] ?? 0;
  if (bouquets < 1) return { kind: 'no-bouquet' };
  player.inventory[BOUQUET_KEY] = bouquets - 1;
  player.engagement = { npcId, day };
  return { kind: 'accepted', npcId };
}

/** Convenience: who is the player currently engaged to (or null)? */
export function fianceOf(player: Player): string | null {
  return player.engagement ? player.engagement.npcId : null;
}

/** True if the player has accepted a proposal with any candidate. */
export function isEngaged(player: Player): boolean {
  return !!player.engagement;
}

/** Days since the proposal was accepted (0 on the same day). Null when not engaged. */
export function daysEngaged(player: Player, today: number): number | null {
  if (!player.engagement) return null;
  return Math.max(0, today - player.engagement.day);
}
