// Inn forage trade-in — barter 3 surplus forage items for 1 stamina
// tea on the house. Mirrors the cart-tea trade-in shape from the
// other direction:
//
//   cart side:  3 cheap teas  ->  1 Hot Cocoa            (premium drink up)
//   inn side:   3 surplus forage  ->  1 Sage Tea         (raw forage -> drink up)
//
// Why a trade-in at all: late-game players accrue heavy stockpiles
// of forage (berries + herbs) from the morning loop, but the
// cookbook drinks at the inn (Berry Tonic / Sage Tea) need both
// forage AND a free hand at the inn UI. The trade-in is a one-shot
// convenience: "I've got forage, give me a drink without me thinking".
//
// Mechanics:
//   - eligible forage = berries + herbs (mushroom is intentionally
//     excluded — it powers Mushroom Skillet / Mushroom Broth which
//     are mid-tier dishes, not the cheap-tea tier);
//   - 3 forage (any mix of berry + herb) trades for 1 Sage Tea;
//   - cheapest-first consumption: berries (6g) before herbs (8g) so
//     the player keeps the slightly-more-valuable herbs;
//   - auto-fires when the cooking menu opens at the inn so the
//     player doesn't learn a new keybind — mirrors the cart-open
//     auto-trade stack (tradeBreederEggs -> tradeStaminaTeas ->
//     recordRumorVisit) but at the inn instead of the cart.
//
// Pure module: no IO, no canvas. Engine wires the trade onto the
// cooking-menu open path; the cooking menu UI doesn't need to know.

import type { Player } from '../world/world';
import { forageInventoryKey, type ForageKind } from './forage';
import { dishInventoryKey, type DishKey } from './cooking';

/** Forage kinds eligible for the inn trade-in, cheapest sell first. */
export const INN_FORAGE_TRADEIN_KEYS: readonly ForageKind[] = [
  'berry',   // 6g
  'herb',    // 8g
] as const;

/** How many forage items the inn requires per tea. */
export const INN_FORAGE_TRADEIN_COST = 3;

/** Dish key minted by the inn trade-in. */
export const INN_FORAGE_TRADEIN_REWARD_KEY: DishKey = 'herb-tea';

/** Outcome of a forage trade-in attempt. */
export type InnForageTradeInOutcome =
  | { kind: 'traded'; forageUsed: number; teasMinted: number; remainingTea: number }
  | { kind: 'none'; have: number; need: number }
  | { kind: 'too-far' };

/** Sum of eligible forage items the player is currently carrying. */
export function innForageTradeInBalance(player: Player): number {
  let n = 0;
  for (const kind of INN_FORAGE_TRADEIN_KEYS) {
    n += player.inventory[forageInventoryKey(kind)] ?? 0;
  }
  return n;
}

/** True iff the player has at least INN_FORAGE_TRADEIN_COST eligible forage. */
export function canTradeForageForTea(player: Player): boolean {
  return innForageTradeInBalance(player) >= INN_FORAGE_TRADEIN_COST;
}

/**
 * Try to swap INN_FORAGE_TRADEIN_COST cheapest forage items for one
 * Sage Tea. The `near` flag lets the caller pass an "is the player
 * actually at the inn" check from their own world-coords math
 * without coupling this module to building shapes. Refuses cleanly
 * (no mutation) on a low balance OR a too-far position.
 *
 * Walks INN_FORAGE_TRADEIN_KEYS in cheapest-first order so the
 * player burns the least valuable forage first; sweeps each key
 * dry before moving to the next.
 *
 * The minted tea lands in `dish-herb-tea` so the existing
 * drinkBest (Z) path picks it up without any extra wiring, AND
 * the cart-tea trade-in eligibility stack still recognises the
 * tea as a cheap-tier item the player can later convert into
 * Hot Cocoa at Pip's cart — a tiny long-distance pipeline:
 *
 *   forage (inn) -> Sage Tea (drink or stash)
 *   3 Sage Tea (cart) -> 1 Hot Cocoa (premium drink)
 */
export function tradeForageForTea(
  player: Player,
  near: boolean,
): InnForageTradeInOutcome {
  if (!near) return { kind: 'too-far' };
  const balance = innForageTradeInBalance(player);
  if (balance < INN_FORAGE_TRADEIN_COST) {
    return { kind: 'none', have: balance, need: INN_FORAGE_TRADEIN_COST };
  }
  let remaining = INN_FORAGE_TRADEIN_COST;
  for (const kind of INN_FORAGE_TRADEIN_KEYS) {
    if (remaining <= 0) break;
    const k = forageInventoryKey(kind);
    const have = player.inventory[k] ?? 0;
    if (have <= 0) continue;
    const consume = Math.min(have, remaining);
    player.inventory[k] = have - consume;
    remaining -= consume;
  }
  const teaKey = dishInventoryKey(INN_FORAGE_TRADEIN_REWARD_KEY);
  player.inventory[teaKey] = (player.inventory[teaKey] ?? 0) + 1;
  return {
    kind: 'traded',
    forageUsed: INN_FORAGE_TRADEIN_COST,
    teasMinted: 1,
    remainingTea: player.inventory[teaKey],
  };
}

/** Pretty toast for the trade-in confirmation. */
export function innForageTradeToastLine(
  out: Extract<InnForageTradeInOutcome, { kind: 'traded' }>,
): string {
  return `The innkeeper trades ${out.forageUsed} forage for ${out.teasMinted} Sage Tea. (${out.remainingTea} on hand)`;
}

/**
 * Pretty footer chip for the cooking menu — surfaces a "trade ready"
 * / "n more forage to trade" nudge so the player can see at a glance
 * whether the auto-trade-on-open path will fire and how many forage
 * items it would consume. Returns the empty string when the player
 * has zero eligible forage so a fresh-game bag stays uncluttered.
 *
 * Wording mirrors the cart-side staminaTeaTradeInLine bucket shape:
 *   - balance >= COST     "trade ready: 3 forage -> Sage Tea."
 *   - 0 < balance < COST  "2 forage - need 1 more for a Sage Tea trade."
 *   - balance == 0        "" (empty)
 */
export function innForageTradeInLine(player: Player): string {
  const balance = innForageTradeInBalance(player);
  if (balance <= 0) return '';
  if (balance < INN_FORAGE_TRADEIN_COST) {
    const need = INN_FORAGE_TRADEIN_COST - balance;
    return `${balance} forage - need ${need} more for a Sage Tea trade.`;
  }
  return `trade ready: ${INN_FORAGE_TRADEIN_COST} forage -> Sage Tea.`;
}
