// Gifting — slice 3 of v0.5.0 marriage candidates.
//
// Bridges the Player's inventory and the HeartsState. The player presses
// `G` while facing a candidate NPC and we automatically pick the best
// available gift from their inventory:
//
//   1. Prefer a `loved` item (biggest heart gain).
//   2. Otherwise a `liked` item.
//   3. Otherwise a `neutral` item.
//   4. Never auto-gift a `disliked` item — that would feel mean.
//
// This keeps the controls cozy (one button, no submenu) while still
// rewarding players who hoard the right items. A future slice will add
// a proper "choose gift" submenu when the player wants fine control.

import type { Player } from '../world/world';
import {
  BOUQUET_KEY,
  CANDIDATES,
  PERFUMED_SOAP_GIFT_KEY,
  giveGift,
  tasteOf,
  type GiftResult,
  type GiftTaste,
} from './hearts';
import type { TimeOfDay } from './time';
import { giftMultiplier } from './birthdays';

/** Outcome of an auto-gift attempt — drives the toast string in game.ts. */
export type GiftOutcome =
  | { kind: 'gifted'; itemKey: string; result: GiftResult }
  | { kind: 'no-items' }
  | { kind: 'already-today' }
  | { kind: 'not-candidate' };

/** Taste ordering — higher value = better auto-pick. */
const TASTE_RANK: Record<GiftTaste, number> = {
  loved: 3,
  liked: 2,
  neutral: 1,
  disliked: 0,
};

/**
 * Finds the best giftable inventory key for the given candidate. Returns
 * null if the player has nothing acceptable (we never auto-gift items
 * the candidate dislikes). Pure — does not mutate.
 *
 * Two universal "loved" tokens — BOUQUET_KEY and PERFUMED_SOAP_GIFT_KEY —
 * are recognised across every candidate so callers don't have to push
 * them into every CANDIDATES.loved list. Anything else falls back to
 * the per-candidate taste tables.
 */
export function pickBestGift(
  inventory: Record<string, number>,
  npcId: string,
): string | null {
  const def = CANDIDATES[npcId];
  if (!def) return null;
  let bestKey: string | null = null;
  let bestRank = 0;
  for (const [key, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    // Skip non-giftable utility items.
    if (key === 'watering-can') continue;
    let taste: GiftTaste;
    if (key === BOUQUET_KEY || key === PERFUMED_SOAP_GIFT_KEY) taste = 'loved';
    else if (def.loved.includes(key)) taste = 'loved';
    else if (def.liked.includes(key)) taste = 'liked';
    else if (def.disliked.includes(key)) continue; // never auto-gift disliked
    else taste = 'neutral';
    const rank = TASTE_RANK[taste];
    if (rank > bestRank) {
      bestRank = rank;
      bestKey = key;
      if (rank === TASTE_RANK.loved) break; // can't do better
    }
  }
  return bestKey;
}

/**
 * Glanceable gift-readiness for the relationships panel. Answers, for a
 * single candidate, "do I have something good to hand them right now,
 * and have I not already gifted them today?" — the two questions the
 * `G` press resolves, surfaced ahead of time so the player can see at a
 * glance who they can court without walking over and mashing the key.
 *
 * `ready` is true only when BOTH hold: the per-day gift gate is open
 * (no gift logged for `day`) AND pickBestGift finds an acceptable item
 * (never a disliked one). `taste` carries the tier of that best item so
 * the panel can tint the chip (loved > liked > neutral); `itemKey` is
 * the raw inventory key the `G` press would spend. Pure — never mutates.
 */
export interface GiftReadiness {
  ready: boolean;
  taste: GiftTaste | null;
  itemKey: string | null;
}

export function giftReadiness(
  player: Player,
  npcId: string,
  day: number,
): GiftReadiness {
  const none: GiftReadiness = { ready: false, taste: null, itemKey: null };
  if (!CANDIDATES[npcId]) return none;
  // Per-day gate: already gifted today -> not ready (even with a full bag).
  const row = player.hearts?.[npcId];
  if (row && row.lastGiftDay === day) return none;
  const key = pickBestGift(player.inventory, npcId);
  if (!key) return none;
  return { ready: true, taste: tasteOf(npcId, key), itemKey: key };
}

/**
 * Attempt an auto-gift to a candidate. Decrements the chosen item from
 * the player's inventory on success. The caller is responsible for the
 * toast / dialogue feedback.
 *
 * Pass `time` to apply the birthday multiplier (8x on the candidate's
 * birthday). When omitted, the gift carries no bonus.
 *
 * Pass `extraMultiplier` to layer an additional caller-supplied bonus
 * on top of the birthday multiplier (e.g. the owl-post letter-chain
 * stacks a 1.1x / 1.2x / 1.3x multiplier on consecutive-day sends).
 * The two multipliers compose: a birthday gift sent inside a chain
 * earns birthday * chain. Defaults to 1 so existing callers behave
 * exactly as before.
 */
export function attemptAutoGift(
  player: Player,
  npcId: string,
  day: number,
  time?: TimeOfDay,
  extraMultiplier: number = 1,
): GiftOutcome {
  if (!CANDIDATES[npcId]) return { kind: 'not-candidate' };
  if (!player.hearts) return { kind: 'not-candidate' };
  // Per-day gate first so an empty inventory after-hours still tells the
  // player the right thing.
  if (player.hearts[npcId] && player.hearts[npcId].lastGiftDay === day) {
    return { kind: 'already-today' };
  }
  const key = pickBestGift(player.inventory, npcId);
  if (!key) return { kind: 'no-items' };
  const birthdayMult = time ? giftMultiplier(npcId, time) : 1;
  const mult = birthdayMult * extraMultiplier;
  const result = giveGift(player.hearts, npcId, key, day, mult);
  if (!result.accepted) {
    // Shouldn't happen because we gated above, but stay safe.
    return { kind: 'already-today' };
  }
  player.inventory[key] = Math.max(0, (player.inventory[key] ?? 0) - 1);
  return { kind: 'gifted', itemKey: key, result };
}
