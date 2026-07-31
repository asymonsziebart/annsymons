// Vallie's General Goods — the village shop UI bridge.
//
// SHOP_ITEMS (economy.ts) lists every catalog row but, until this
// module landed, the player had no in-game way to spend gold at the
// shop beyond a handful of upgrade hotkeys (,/.=/'/' for tools, rod,
// pickaxe). Half the buyable items the game references — Coop Kit,
// Greenhouse Kit, Chest Kit, Auto-Restock Kit, Seed Extractor, Farm
// Dog Ticket, Kitten Ticket, Chickens, Bouquets, Sprinklers — could
// only land via the dev console.
//
// This module is the pure logic side of a Vallie shop modal. It walks
// SHOP_ITEMS, partitions it into player-facing categories, hides items
// the player already owns when they're singletons, and surfaces a
// buyShopItem() that the Game's E-press near Vallie's shop can call.
//
// The matching UI lives in ../ui/shop-menu.ts.

import type { Player } from '../world/world';
import { SHOP_ITEMS, addItem, buyItem } from './economy';
import { BOUQUET_KEY } from './hearts';
import { COOP_INVENTORY_KEY } from './coop';
import { DOG_TICKET_KEY } from './farm-dog';
import { CAT_TICKET_KEY } from './farm-cat';
import { GREENHOUSE_INVENTORY_KEY } from './greenhouse';
import { CHEST_INVENTORY_KEY } from './chest';
import { AUTO_RESTOCK_KEY } from './auto-restock';
import { EXTRACTOR_INVENTORY_KEY } from './seed-extractor';
import { COMPOST_BIN_INVENTORY_KEY } from './compost';
import { sprinklerInventoryKey } from './sprinklers';
import { CROPS } from './crops';
import type { TimeOfDay } from './time';
import { discountedPrice, isMarketDealToday } from './weekday-market';

/** A purchasable row exposed to the UI. */
export interface ShopRow {
  key: string;
  label: string;
  price: number;
  /** Base catalog price BEFORE any deal-of-the-day discount. */
  basePrice: number;
  /** True when this row is today's discounted deal. */
  isDeal: boolean;
  /** Player-facing category for the menu sectioning. */
  category: ShopCategory;
  /** A one-line description shown under the row. */
  flavor: string;
}

/** Tabs in the shop UI. Stable order — keep additions at the end. */
export type ShopCategory = 'seeds' | 'kits' | 'tickets' | 'misc';

export const SHOP_CATEGORIES: readonly ShopCategory[] = [
  'seeds',
  'kits',
  'tickets',
  'misc',
] as const;

export function shopCategoryLabel(c: ShopCategory): string {
  if (c === 'seeds') return 'Seeds';
  if (c === 'kits') return 'Kits';
  if (c === 'tickets') return 'Tickets';
  return 'Misc';
}

/** Singletons that vanish from the menu once the player owns one. */
const SINGLETON_KEYS = new Set<string>([
  COOP_INVENTORY_KEY,
  GREENHOUSE_INVENTORY_KEY,
  AUTO_RESTOCK_KEY,
  EXTRACTOR_INVENTORY_KEY,
  DOG_TICKET_KEY,
  CAT_TICKET_KEY,
]);

function categoryFor(key: string): ShopCategory {
  if (CROPS[key]) return 'seeds';
  if (
    key === COOP_INVENTORY_KEY ||
    key === GREENHOUSE_INVENTORY_KEY ||
    key === CHEST_INVENTORY_KEY ||
    key === AUTO_RESTOCK_KEY ||
    key === EXTRACTOR_INVENTORY_KEY ||
    key === COMPOST_BIN_INVENTORY_KEY ||
    key === sprinklerInventoryKey('basic')
  ) {
    return 'kits';
  }
  if (key === DOG_TICKET_KEY || key === CAT_TICKET_KEY || key === 'chicken') {
    return 'tickets';
  }
  return 'misc';
}

function flavorFor(key: string): string {
  if (CROPS[key]) {
    const c = CROPS[key];
    return `Grows in ${c.growthStages}d. Sells ${c.sellPrice}g.`;
  }
  if (key === COOP_INVENTORY_KEY) return 'Build a coop on grass to keep chickens. Press N to place.';
  if (key === GREENHOUSE_INVENTORY_KEY) return 'A 3x3 glass house. Crops inside grow faster, all year.';
  if (key === CHEST_INVENTORY_KEY) return 'A cellar chest you place with X. Press ] to manage.';
  if (key === AUTO_RESTOCK_KEY) return "Vallie keeps your last-planted seed topped up each dawn.";
  if (key === EXTRACTOR_INVENTORY_KEY) return 'Press L to mill one harvest stack into 1-2 seeds.';
  if (key === COMPOST_BIN_INVENTORY_KEY)
    return 'Place with X and deposit normal-tier crops with F. Yields fertilizer.';
  if (key === sprinklerInventoryKey('basic'))
    return 'Place on tilled soil with O. Waters its four neighbours at dawn.';
  if (key === DOG_TICKET_KEY) return 'Adopt the farm dog. Press J at the farmhouse.';
  if (key === CAT_TICKET_KEY) return 'Adopt the rooftop kitten. Press - at the farmhouse.';
  if (key === 'chicken') return 'Bring it home and press I beside the coop.';
  if (key === BOUQUET_KEY) return 'A courtship token. Hand it to a heart-2 candidate.';
  return '';
}

/**
 * Build the ordered list of purchasable rows for the menu. Items the
 * player already owns and which are singletons are dropped. Items with
 * no buyPrice (sell-only rows like harvests) are excluded. When
 * `time` is provided the daily market discount is applied to the
 * matching row's displayed price; the deal flag flows through so the
 * UI can flag it visually.
 */
export function buildShopRows(player: Player, time?: TimeOfDay): ShopRow[] {
  const rows: ShopRow[] = [];
  for (const item of SHOP_ITEMS) {
    if (item.buyPrice == null) continue;
    if (SINGLETON_KEYS.has(item.key) && (player.inventory[item.key] ?? 0) > 0) continue;
    const base = item.buyPrice;
    const isDeal = time ? isMarketDealToday(time, item.key) : false;
    const price = time ? discountedPrice(time, item.key, base) : base;
    rows.push({
      key: item.key,
      label: item.label,
      price,
      basePrice: base,
      isDeal,
      category: categoryFor(item.key),
      flavor: flavorFor(item.key),
    });
  }
  // Stable sort: by category order, then by (effective) price ascending.
  const catOrder = new Map<ShopCategory, number>();
  SHOP_CATEGORIES.forEach((c, i) => catOrder.set(c, i));
  rows.sort((a, b) => {
    const ca = catOrder.get(a.category) ?? 99;
    const cb = catOrder.get(b.category) ?? 99;
    if (ca !== cb) return ca - cb;
    return a.price - b.price;
  });
  return rows;
}

/**
 * Outcome of a buy attempt. The Game routes 'bought' into a toast and
 * money-log entry; the rest become hint toasts.
 */
export type ShopBuyOutcome =
  | { kind: 'bought'; row: ShopRow; remainingGold: number }
  | { kind: 'not-enough-gold'; row: ShopRow; need: number; have: number }
  | { kind: 'already-owned'; row: ShopRow }
  | { kind: 'unknown-item' };

/**
 * Buy one of the row identified by `key`. The caller has already
 * checked nearShop / cart-priority; we only own the gold + inventory
 * transition.
 */
export function buyShopItem(
  player: Player,
  rows: ShopRow[],
  key: string,
): ShopBuyOutcome {
  const row = rows.find((r) => r.key === key);
  if (!row) return { kind: 'unknown-item' };
  if (SINGLETON_KEYS.has(row.key) && (player.inventory[row.key] ?? 0) > 0) {
    return { kind: 'already-owned', row };
  }
  if (player.gold < row.price) {
    return { kind: 'not-enough-gold', row, need: row.price, have: player.gold };
  }
  const ok = buyItem(player, row.key, row.price);
  if (!ok) {
    // buyItem only fails on insufficient gold which we already guarded
    // against; included for completeness.
    return { kind: 'not-enough-gold', row, need: row.price, have: player.gold };
  }
  // buyItem already added the inventory entry. addItem export is
  // re-exported only so future grants (free bouquet, etc.) can stay in
  // this module.
  void addItem;
  return { kind: 'bought', row, remainingGold: player.gold };
}
