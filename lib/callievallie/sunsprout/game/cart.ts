// Travelling merchant cart — Pip the Peddler.
//
// Once per in-game season Pip rolls his cart into the village square and
// sets up shop for a single day. He sells items the regular Vallie shop
// never carries: rare seeds the player can't normally grow, exotic
// cosmetics (placeable lanterns), and a small refill of premium drinks
// the cookbook can't easily produce.
//
// Schedule rule: Pip arrives on day 3 of every season (Spring d3,
// Summer d3, Fall d3, Winter d3). He parks on a fixed tile near the
// village well and stays from 09:00 until 18:00, then leaves at dusk.
//
// All Pip's items are flagged "premium" with a sell price 1.5x what a
// normal vendor charges — the convenience is in availability, not
// discount. Money log entries are tagged so the player can audit how
// much they've spent at the cart.
//
// Pure module: no IO, no canvas. The Game places the cart in render(),
// shows a "Pip is here today" toast at dawn, and opens a small menu
// when the player walks onto an adjacent tile and presses E.

import type { Player } from '../world/world';
import type { TimeOfDay } from './time';
import { DECOR_CATALOG, buyDecor, ownsDecor, type DecorBuyOutcome } from './decor';
import {
  SPA_PASS_INVENTORY_KEY,
  SPA_PASS_PRICE,
  SPA_PASS_PUNCHES,
  SPA_PASS_REFILL_PRICE,
  getBath,
  getSpaPass,
} from './bath-house';
import { BAROMETER_INVENTORY_KEY, BAROMETER_PRICE } from './barometer';
import { BREEDER_EGG_INVENTORY_KEY, FANCY_EGG_SELL_PRICE } from './coop';
import { POND_MAX_PENDING_RIM, POND_RIM_INVENTORY_KEY, POND_RIM_PRICE } from './fish-pond';
/** Synthetic CART_CATALOG key for the spa-pass refill row. Not stored
 *  in the player's inventory — purchasing it credits punches directly
 *  via SPA_PASS_PUNCHES on the spa-pass pool. */
export const SPA_PASS_REFILL_KEY = 'spa-pass-refill';

/** Cart parking tile (just west of the well so it doesn't block paths). */
export const CART_X = 16;
export const CART_Y = 9;

/** Day of every season Pip visits. */
export const CART_VISIT_DAY = 3;

/** Hours the cart is open. */
export const CART_OPEN_HOUR = 9;
export const CART_CLOSE_HOUR = 18;

/** Approach radius — Chebyshev distance. */
export const CART_INTERACT_RADIUS = 1;

/** A single row in Pip's catalog. */
export interface CartItem {
  /** Inventory key the player receives on purchase. */
  key: string;
  /** Display label in the menu. */
  label: string;
  /** Gold cost. */
  buyPrice: number;
  /** One-line flavour shown under the row. */
  flavor: string;
}

/** Catalog of premium goods. Stable order — keep additions at the end. */
export const CART_CATALOG: CartItem[] = [
  {
    key: 'pumpkin',
    label: 'Pumpkin Seed (rare)',
    buyPrice: 220,
    flavor: 'A Fall heirloom. Big payoff, longer grow.',
  },
  {
    key: 'flower',
    label: 'Flower Seed (premium bouquet quality)',
    buyPrice: 90,
    flavor: 'These bloom a richer red. Hearts give double points.',
  },
  {
    key: 'dish-hot-cocoa',
    label: 'Hot Cocoa (ready-to-drink)',
    buyPrice: 80,
    flavor: 'A flask of cocoa, +35 stamina anytime you press Z.',
  },
  {
    key: 'dish-herb-tea',
    label: 'Sage Tea (ready-to-drink)',
    buyPrice: 35,
    flavor: 'A small flask. +20 stamina, quiet evenings.',
  },
  {
    key: 'cart-lantern',
    label: 'Brass Lantern (cosmetic)',
    buyPrice: 350,
    flavor: 'A trinket for the farmhouse mantle. Counts toward decorator.',
  },
  {
    key: SPA_PASS_INVENTORY_KEY,
    label: 'Spa Pass (punch card)',
    buyPrice: SPA_PASS_PRICE,
    flavor: `${SPA_PASS_PUNCHES} free soaks at the bath house. Auto-redeems on first use.`,
  },
  {
    key: SPA_PASS_REFILL_KEY,
    label: 'Spa Pass Refill',
    buyPrice: SPA_PASS_REFILL_PRICE,
    flavor: `${SPA_PASS_PUNCHES} more punches on your spa pass. Cheaper than a fresh card — only sells once your pass is empty.`,
  },
  {
    key: BAROMETER_INVENTORY_KEY,
    label: 'Brass Barometer',
    buyPrice: BAROMETER_PRICE,
    flavor: 'Mount on the porch. Forecast strip reaches two days ahead.',
  },
  {
    key: POND_RIM_INVENTORY_KEY,
    label: 'Stone-Rim Pond Kit',
    buyPrice: POND_RIM_PRICE,
    flavor: `Lay stones around the pond. Pending fish cap rises to ${POND_MAX_PENDING_RIM}.`,
  },
  // Decor pieces — buyable wallpaper + floor packs that retint the
  // farmhouse exterior. Each row mirrors a DECOR_CATALOG entry so the
  // cart UI lists them alongside Pip's other premium goods.
  ...DECOR_CATALOG.map((d) => ({
    key: `decor-${d.key}`,
    label: `${d.label} (decor)`,
    buyPrice: d.price,
    flavor: d.flavor,
  })),
];

/** Returns true on the in-game day Pip rolls into town. */
export function cartVisitToday(time: TimeOfDay): boolean {
  return time.day === CART_VISIT_DAY;
}

/** True iff the cart is parked + open right now. */
export function cartOpen(time: TimeOfDay): boolean {
  if (!cartVisitToday(time)) return false;
  return time.hour >= CART_OPEN_HOUR && time.hour < CART_CLOSE_HOUR;
}

/** True when the player is close enough to interact. */
export function nearCart(px: number, py: number): boolean {
  return (
    Math.abs(px - CART_X) <= CART_INTERACT_RADIUS &&
    Math.abs(py - CART_Y) <= CART_INTERACT_RADIUS
  );
}

/** Outcome of an attempted purchase. */
export type CartBuyOutcome =
  | { kind: 'bought'; item: CartItem; remainingGold: number }
  | { kind: 'refilled'; item: CartItem; remainingGold: number; punches: number }
  | { kind: 'refill-not-eligible'; reason: 'no-pass' | 'still-has-punches' }
  | { kind: 'already-owned'; item: CartItem }
  | { kind: 'closed' }
  | { kind: 'too-far' }
  | { kind: 'unknown-item' }
  | { kind: 'not-enough-gold'; need: number; have: number };

/**
 * True iff the player has redeemed a spa pass before AND is currently
 * out of punches. The refill is intentionally gated by these BOTH so:
 *   - a fresh-game player can't skip the loyalty-card price by buying
 *     the cheaper refill straight off the bat;
 *   - a player who still has punches can't double-stack and end up
 *     with >SPA_PASS_PUNCHES uncommitted soaks (the punches pool
 *     would tolerate it, but visually a fresh refill on top of an
 *     unused card reads as accidental over-spend).
 *
 * "Has redeemed a pass before" is detected by checking the bath
 * state's totalSoaks AND that the player has no unredeemed pass in
 * the bag — equivalent to "has actually used the bath house and the
 * bag is bare". A bath state with at least one paid-with-pass soak
 * is the stronger signal but more fragile across reload, so we use
 * the looser "has soaked at all" check.
 */
export function canRefillSpaPass(player: Player): boolean {
  const bag = player.inventory[SPA_PASS_INVENTORY_KEY] ?? 0;
  if (bag > 0) return false;
  if (getSpaPass(player).punchesLeft > 0) return false;
  const bath = getBath(player);
  return (bath.totalSoaks ?? 0) > 0;
}

/**
 * Attempt to buy a cart item by key. Validates that Pip is open and
 * the player can afford it, then deducts gold and grants the item.
 *
 * Items whose key starts with `decor-` are routed through the decor
 * module instead of the bag — they unlock a piece of farmhouse
 * cosmetics and auto-apply it.
 */
export function buyFromCart(
  player: Player,
  px: number,
  py: number,
  time: TimeOfDay,
  itemKey: string,
): CartBuyOutcome {
  if (!cartOpen(time)) return { kind: 'closed' };
  if (!nearCart(px, py)) return { kind: 'too-far' };
  const item = CART_CATALOG.find((i) => i.key === itemKey);
  if (!item) return { kind: 'unknown-item' };
  if (player.gold < item.buyPrice) {
    return { kind: 'not-enough-gold', need: item.buyPrice, have: player.gold };
  }
  // Barometer is a singleton — short-circuit a re-buy.
  if (itemKey === BAROMETER_INVENTORY_KEY && (player.inventory[BAROMETER_INVENTORY_KEY] ?? 0) > 0) {
    return { kind: 'already-owned', item };
  }
  // Stone-rim pond kit is a singleton — short-circuit a re-buy.
  if (itemKey === POND_RIM_INVENTORY_KEY && (player.inventory[POND_RIM_INVENTORY_KEY] ?? 0) > 0) {
    return { kind: 'already-owned', item };
  }
  // Spa pass refill — special-case path. Credits punches directly
  // into the spa-pass pool (no inventory key), gated by canRefillSpaPass
  // so a fresh-game player can't shortcut the full loyalty-card price.
  if (itemKey === SPA_PASS_REFILL_KEY) {
    const bag = player.inventory[SPA_PASS_INVENTORY_KEY] ?? 0;
    const pool = getSpaPass(player);
    const bath = getBath(player);
    if (bag > 0 || pool.punchesLeft > 0) {
      return { kind: 'refill-not-eligible', reason: 'still-has-punches' };
    }
    if ((bath.totalSoaks ?? 0) <= 0) {
      return { kind: 'refill-not-eligible', reason: 'no-pass' };
    }
    player.gold -= item.buyPrice;
    pool.punchesLeft += SPA_PASS_PUNCHES;
    return {
      kind: 'refilled',
      item,
      remainingGold: player.gold,
      punches: pool.punchesLeft,
    };
  }
  if (itemKey.startsWith('decor-')) {
    const decorKey = itemKey.slice('decor-'.length);
    // Already owned -> short-circuit so the player doesn't accidentally
    // double-spend on the same wallpaper.
    if (ownsDecor(player, decorKey)) {
      return { kind: 'already-owned', item };
    }
    const out: DecorBuyOutcome = buyDecor(player, decorKey);
    if (out.kind === 'bought') {
      return { kind: 'bought', item, remainingGold: out.remainingGold };
    }
    if (out.kind === 'not-enough-gold') {
      return { kind: 'not-enough-gold', need: out.need, have: out.have };
    }
    return { kind: 'unknown-item' };
  }
  player.gold -= item.buyPrice;
  player.inventory[item.key] = (player.inventory[item.key] ?? 0) + 1;
  return { kind: 'bought', item, remainingGold: player.gold };
}

/** Pretty label for the dawn arrival toast. */
export function cartArrivalLine(): string {
  return 'Pip the Peddler is in town today (09-18 by the well).';
}

// ---------------------------------------------------------------------
// Breeder egg trade-in — Pip pays double the fancy-egg sell price for
// any breeder eggs the player walks up to the cart with. Triggers
// automatically on cart-menu open so the player never has to learn a
// new keybind, and it stays revertible by paying out 0 + a no-op toast
// when no eggs are on hand.
// ---------------------------------------------------------------------

/**
 * Multiplier on FANCY_EGG_SELL_PRICE Pip pays per breeder egg.
 *
 * Sets the cart trade-in to 2x the well's fancy-egg sell price. Tuned
 * to feel rewarding without dwarfing the hatchery path (a breeder
 * hatches a guaranteed heritage chick — that's still a stronger
 * long-run play than the gold).
 */
export const BREEDER_TRADEIN_MULTIPLIER = 2;

/** Per-egg gold Pip pays at the cart trade-in. */
export const BREEDER_TRADEIN_PRICE = FANCY_EGG_SELL_PRICE * BREEDER_TRADEIN_MULTIPLIER;

/** Outcome of a trade-in attempt. */
export type BreederTradeInOutcome =
  | { kind: 'traded'; eggs: number; gold: number; remainingGold: number }
  | { kind: 'none' }
  | { kind: 'closed' }
  | { kind: 'too-far' };

/**
 * Try to trade every breeder egg in the player's bag to Pip for
 * BREEDER_TRADEIN_PRICE gold each. Gated by cart-open + adjacency
 * exactly like buyFromCart so the trade can't happen off-hours or
 * from across the village.
 *
 * Returns 'none' when the bag is empty — the cart-menu open hook
 * checks this first so a no-op trade doesn't toast.
 */
export function tradeBreederEggs(
  player: Player,
  px: number,
  py: number,
  time: TimeOfDay,
): BreederTradeInOutcome {
  if (!cartOpen(time)) return { kind: 'closed' };
  if (!nearCart(px, py)) return { kind: 'too-far' };
  const have = player.inventory[BREEDER_EGG_INVENTORY_KEY] ?? 0;
  if (have <= 0) return { kind: 'none' };
  const gold = have * BREEDER_TRADEIN_PRICE;
  player.inventory[BREEDER_EGG_INVENTORY_KEY] = 0;
  player.gold += gold;
  return { kind: 'traded', eggs: have, gold, remainingGold: player.gold };
}

/** Pretty toast for the trade-in confirmation. */
export function breederTradeInLine(out: Extract<BreederTradeInOutcome, { kind: 'traded' }>): string {
  return `Pip eyes the breeder egg${out.eggs === 1 ? '' : 's'} — pays you ${out.gold}g for ${out.eggs}.`;
}

// ---------------------------------------------------------------------
// Stamina-tea trade-in — exchange three cheap stamina teas (herb-tea
// or berry-tonic) for one Hot Cocoa. Mirrors the breeder-egg trade-in
// shape: auto-fires on cart-menu open so the player doesn't learn a
// new keybind, returns 'none' silently when the bag doesn't carry
// enough teas, and credits the new dish directly into the
// `dish-hot-cocoa` inventory key the existing drinkBest path already
// honors.
//
// Why teas-for-cocoa and not the other direction: a cocoa restores
// 35 stamina, a herb-tea restores 20 — three teas total 60 stamina,
// the cocoa is 35. The trade is a CONVENIENCE: one cocoa hotkey
// (Z) drinks 35 in one press instead of three taps. The lost
// stamina is paid for the keybind ergonomics + bag space.
//
// Why limit to cheap teas (herb-tea + berry-tonic): the player can
// already make Berry Tonic and Mushroom Broth at the inn; the trade-
// in shouldn't let the player dump high-restore teas (mushroom-broth
// / sunflower-elixir) at a 3:1 ratio because that's a stamina loss.
// The eligible set stays cheapest-first so the player auto-burns the
// least valuable teas.
// ---------------------------------------------------------------------

import { dishInventoryKey, type DishKey } from './cooking';
import { INN_FORAGE_TRADEIN_COST, innForageTradeInBalance } from './inn-trade';

/** Teas eligible for the trade-in, cheapest restore first. */
export const TEA_TRADEIN_KEYS: readonly DishKey[] = [
  'herb-tea',     // 20 restore
  'berry-tonic',  // 25 restore
] as const;

/** Number of teas required per cocoa. */
export const TEA_TRADEIN_COST = 3;

/** Dish key minted by the trade-in. */
export const TEA_TRADEIN_REWARD_KEY: DishKey = 'hot-cocoa';

/** Outcome of a tea trade-in attempt. */
export type TeaTradeInOutcome =
  | { kind: 'traded'; teasUsed: number; cocoasMinted: number; remainingCocoa: number }
  | { kind: 'none'; have: number; need: number }
  | { kind: 'closed' }
  | { kind: 'too-far' };

/** Sum of eligible teas the player is currently carrying. */
export function teaTradeInBalance(player: Player): number {
  let n = 0;
  for (const key of TEA_TRADEIN_KEYS) {
    n += player.inventory[dishInventoryKey(key)] ?? 0;
  }
  return n;
}

/** True iff the player has at least TEA_TRADEIN_COST eligible teas. */
export function canTradeStaminaTeas(player: Player): boolean {
  return teaTradeInBalance(player) >= TEA_TRADEIN_COST;
}

/**
 * Try to swap TEA_TRADEIN_COST cheapest teas for one Hot Cocoa.
 * Honours the same gate as buyFromCart (cart open + adjacency). Walks
 * TEA_TRADEIN_KEYS in cheapest-first order so the player burns the
 * least valuable teas first; sweeps each key dry before moving to
 * the next, ensuring a 5-tea bag carrying 4 herb-tea + 1 berry-tonic
 * cleanly consumes 3 herb-teas.
 *
 * The minted cocoa lands in `dish-hot-cocoa` so the existing
 * drinkBest (Z) path picks it up without any extra wiring.
 */
export function tradeStaminaTeas(
  player: Player,
  px: number,
  py: number,
  time: TimeOfDay,
): TeaTradeInOutcome {
  if (!cartOpen(time)) return { kind: 'closed' };
  if (!nearCart(px, py)) return { kind: 'too-far' };
  const balance = teaTradeInBalance(player);
  if (balance < TEA_TRADEIN_COST) {
    return { kind: 'none', have: balance, need: TEA_TRADEIN_COST };
  }
  let remaining = TEA_TRADEIN_COST;
  for (const key of TEA_TRADEIN_KEYS) {
    if (remaining <= 0) break;
    const dishKey = dishInventoryKey(key);
    const have = player.inventory[dishKey] ?? 0;
    if (have <= 0) continue;
    const consume = Math.min(have, remaining);
    player.inventory[dishKey] = have - consume;
    remaining -= consume;
  }
  const cocoaKey = dishInventoryKey(TEA_TRADEIN_REWARD_KEY);
  player.inventory[cocoaKey] = (player.inventory[cocoaKey] ?? 0) + 1;
  return {
    kind: 'traded',
    teasUsed: TEA_TRADEIN_COST,
    cocoasMinted: 1,
    remainingCocoa: player.inventory[cocoaKey],
  };
}

/** Pretty toast for the trade-in confirmation. */
export function teaTradeInLine(out: Extract<TeaTradeInOutcome, { kind: 'traded' }>): string {
  return `Pip swaps ${out.teasUsed} stamina teas for ${out.cocoasMinted} Hot Cocoa. (${out.remainingCocoa} on hand)`;
}

/**
 * Pretty footer chip for the cart menu — surfaces a "trade ready" /
 * "n more teas to trade" nudge so the player can see at a glance
 * whether the auto-trade-on-open path will fire and how many teas it
 * would consume. Returns the empty string when the player has zero
 * eligible teas so a fresh-game bag stays uncluttered.
 *
 * Wording covers three buckets:
 *   - balance >= COST           "trade ready: 3 teas -> Hot Cocoa."
 *   - 0 < balance < COST        "1 tea — need 2 more for a Hot Cocoa trade."
 *   - balance == 0              "" (empty so the panel renders nothing)
 *
 * Pure formatter so the cart-menu UI doesn't grow new logic — just a
 * draw call. The auto-trade itself fires inside the cart E-press
 * path (game.ts) right after tradeBreederEggs, so the chip is just
 * a heads-up before the player opens the menu.
 *
 * Cross-system nudge (long-pipeline pointer): when the player is
 * SHORT on teas (under the COST gate) but is carrying enough cheap
 * forage at the inn to mint at least one Sage Tea, the chip appends
 * a " - or trade N forage at the inn for Sage Tea" tail so the player
 * who only sees the cart-side gate also learns about the inn route.
 * Suppressed when:
 *   - the player can already trade at the cart (no need to point
 *     them at the longer pipeline), or
 *   - the player has zero forage to convert (the tail would just be
 *     noise).
 * Lives on the cart side because that's where the \"I need more
 * teas, how do I get them?\" question is most natural — at the
 * inn, the chip already tells the same player the forage path will
 * fire on open.
 */
export function staminaTeaTradeInLine(player: Player): string {
  const balance = teaTradeInBalance(player);
  const innForageBalance = innForageTradeInBalance(player);
  const innTail = staminaTeaTradeInInnHint(balance, innForageBalance);
  if (balance <= 0) {
    // Even with an empty tea bag, surface the inn hint when the
    // player is sitting on enough forage to mint a Sage Tea — the
    // long pipeline only matters when there's a concrete next step.
    return innTail;
  }
  if (balance < TEA_TRADEIN_COST) {
    const need = TEA_TRADEIN_COST - balance;
    return `${balance} tea${balance === 1 ? '' : 's'} - need ${need} more for a Hot Cocoa trade.${innTail}`;
  }
  // balance >= COST: at least one trade can fire on open. The inn
  // hint is suppressed at this branch on purpose — the player has
  // already cleared the immediate trade gate and doesn't need a
  // pointer at the longer pipeline.
  return `trade ready: ${TEA_TRADEIN_COST} teas -> Hot Cocoa.`;
}

/**
 * Pure helper for the cart-side inn hint tail. Returns the empty
 * string when the player can already trade at the cart, when the
 * forage bag is empty (nothing to trade), or when there isn't
 * enough forage to mint a single Sage Tea at the inn.
 *
 * Wording:
 *   - " - or trade 3 forage at the inn for Sage Tea"  (1 tea minted)
 *   - " - or trade 6 forage at the inn for 2 Sage Tea"  (>=2 teas)
 *
 * Pulled out as its own helper so the cart-side chip can stay a
 * single composable string and the inn-tail can be pinned in unit
 * tests independently of the cart-side balance buckets.
 */
function staminaTeaTradeInInnHint(teaBalance: number, forageBalance: number): string {
  // Player can already trade at the cart -> suppress the inn hint.
  if (teaBalance >= TEA_TRADEIN_COST) return '';
  // No forage to convert -> nothing to point at.
  if (forageBalance < INN_FORAGE_TRADEIN_COST) return '';
  // Number of Sage Tea the inn would mint with the player's current
  // forage bag (one tea per COST forage, integer floor).
  const teasMinted = Math.floor(forageBalance / INN_FORAGE_TRADEIN_COST);
  const forageUsed = teasMinted * INN_FORAGE_TRADEIN_COST;
  if (teasMinted === 1) {
    return ` - or trade ${forageUsed} forage at the inn for Sage Tea`;
  }
  return ` - or trade ${forageUsed} forage at the inn for ${teasMinted} Sage Tea`;
}
