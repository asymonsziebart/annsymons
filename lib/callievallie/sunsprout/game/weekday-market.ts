// Weekday market discount — Vallie posts a "today only" sale on one
// SHOP_ITEMS row that rotates deterministically each in-game day.
//
// The whole village runs on weekly cycles (board quest, festivals,
// tournaments). This module fills the daily granularity gap: every
// day, the shop singles out one rotating buyable row and slashes its
// price by MARKET_DISCOUNT_PCT (default 20%). The pick is deterministic
// per (year, season, day) so a save reload always shows the same deal
// for the same in-game day.
//
// Catalog rule: only items with a buyPrice are eligible (sell-only
// rows like `<crop>_harvest` are skipped). Singletons that vanish from
// the menu once owned (coop, greenhouse, dog ticket, ...) are still
// eligible — owning one just means the deal is moot for that player.
//
// Pure module: no IO. The shop UI module reads `marketTodayKey()` to
// flag the discounted row + show a banner in the menu header.

import type { TimeOfDay } from './time';
import { SHOP_ITEMS } from './economy';

/** Percentage off the buyPrice for today's deal. */
export const MARKET_DISCOUNT_PCT = 20;

/** The discount as a multiplier — 0.8 = 20% off. */
export const MARKET_DISCOUNT_MULT = 1 - MARKET_DISCOUNT_PCT / 100;

/**
 * The list of catalog keys eligible for the daily deal — every
 * SHOP_ITEMS entry that has a buyPrice. Computed once at module load.
 */
export const MARKET_ELIGIBLE_KEYS: string[] = SHOP_ITEMS.filter(
  (i) => i.buyPrice != null,
).map((i) => i.key);

/**
 * Deterministic per-(year, season, day) hash. Computes a stable index
 * into MARKET_ELIGIBLE_KEYS so the same in-game day always returns
 * the same key, even across save reloads or year-wrap.
 */
function marketHash(season: number, day: number): number {
  // We don't carry a year counter on the clock; instead, hash
  // (season, day) directly. Wraparound at year-boundaries reuses
  // the same key by design — the shop's catalog isn't year-aware.
  let h = (season + 1) * 2654435761;
  h ^= day * 40503;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/**
 * The catalog key on sale for the in-game day. Returns null when the
 * eligible list is empty (defensive — should never happen with the
 * current catalog).
 */
export function marketTodayKey(time: TimeOfDay): string | null {
  if (MARKET_ELIGIBLE_KEYS.length === 0) return null;
  const idx = marketHash(time.season, time.day) % MARKET_ELIGIBLE_KEYS.length;
  return MARKET_ELIGIBLE_KEYS[idx];
}

/** True when `key` is the discounted row today. */
export function isMarketDealToday(time: TimeOfDay, key: string): boolean {
  return marketTodayKey(time) === key;
}

/**
 * Apply today's discount to a base price when `key` matches the
 * featured deal. Otherwise returns the base price unchanged. Rounded
 * up so the discount can never push a price below 1g.
 */
export function discountedPrice(time: TimeOfDay, key: string, basePrice: number): number {
  if (!isMarketDealToday(time, key)) return basePrice;
  return Math.max(1, Math.ceil(basePrice * MARKET_DISCOUNT_MULT));
}

/** Banner line for the shop menu header. */
export function marketBannerLine(time: TimeOfDay): string {
  const key = marketTodayKey(time);
  if (!key) return '';
  const row = SHOP_ITEMS.find((i) => i.key === key);
  if (!row || row.buyPrice == null) return '';
  const wasPrice = row.buyPrice;
  const now = discountedPrice(time, key, wasPrice);
  return `Today's deal: ${row.label} -${MARKET_DISCOUNT_PCT}% (${wasPrice}g -> ${now}g)`;
}
