// Player economy — gold, seed/harvest inventory keys, and shop transactions.
//
// Inventory keys we care about:
//   wheat / tomato / pumpkin / flower  → seed counts (per crops.ts CROPS keys)
//   <crop>_harvest                      → harvested produce ready to sell
//   watering-can / hoe                  → tools the player always carries
//
// Functions are intentionally tiny and side-effect-only on the Player.
// They return a boolean so quests / UI can react to success/failure.

import type { Player } from '../world/world';
import { CROPS } from './crops';
import { GEMS, GEM_KEYS, gemInventoryKey } from './gems';
import { BOUQUET_KEY, BOUQUET_PRICE } from './hearts';
import { SPRINKLERS, SPRINKLER_KEYS, sprinklerInventoryKey } from './sprinklers';
import { FORAGE, FORAGE_KEYS, forageInventoryKey, sellAllForage } from './forage';
import {
  COOP_PRICE,
  COOP_INVENTORY_KEY,
  EGG_INVENTORY_KEY,
  EGG_SELL_PRICE,
  CHICKEN_PRICE,
  sellAllEggs,
} from './coop';
import { DOG_PRICE, DOG_TICKET_KEY } from './farm-dog';
import { CAT_PRICE, CAT_TICKET_KEY } from './farm-cat';
import { GREENHOUSE_INVENTORY_KEY, GREENHOUSE_PRICE } from './greenhouse';
import { CHEST_INVENTORY_KEY, CHEST_PRICE } from './chest';
import { AUTO_RESTOCK_KEY, AUTO_RESTOCK_PRICE } from './auto-restock';
import { EXTRACTOR_INVENTORY_KEY, EXTRACTOR_PRICE } from './seed-extractor';
import { COMPOST_BIN_INVENTORY_KEY, COMPOST_BIN_PRICE } from './compost';
import { parseHarvestKey, QUALITY_MULTIPLIER } from './crop-quality';
export { sellAllForage, sellAllEggs };

/** A row in the village shop. Either a seed (buy) or a harvest (sell). */
export interface ShopItem {
  key: string;
  label: string;
  buyPrice: number | null;
  sellPrice: number | null;
}

/** All seeds in the catalog become buyable. Their harvests become sellable. */
export const SHOP_ITEMS: ShopItem[] = (() => {
  const items: ShopItem[] = [];
  for (const key of Object.keys(CROPS)) {
    const crop = CROPS[key];
    items.push({
      key,
      label: `${crop.name} seed`,
      buyPrice: crop.seedPrice,
      sellPrice: null,
    });
    items.push({
      key: `${key}_harvest`,
      label: crop.name,
      buyPrice: null,
      sellPrice: crop.sellPrice,
    });
    // Star tiers — same crop, premium prices. Listed so the shop UI
    // and any quest-y "what does this sell for" lookup can find them.
    items.push({
      key: `${key}_harvest_silver`,
      label: `${crop.name} (silver)`,
      buyPrice: null,
      sellPrice: Math.floor(crop.sellPrice * 1.5),
    });
    items.push({
      key: `${key}_harvest_gold`,
      label: `${crop.name} (gold)`,
      buyPrice: null,
      sellPrice: crop.sellPrice * 2,
    });
  }
  // Courtship bouquet — buyable token of affection (v0.5.0).
  items.push({
    key: BOUQUET_KEY,
    label: 'Bouquet',
    buyPrice: BOUQUET_PRICE,
    sellPrice: null,
  });
  // Sprinklers — placeable irrigation, automates morning watering.
  for (const k of SPRINKLER_KEYS) {
    const def = SPRINKLERS[k];
    items.push({
      key: sprinklerInventoryKey(k),
      label: def.name,
      buyPrice: def.buyPrice,
      sellPrice: null,
    });
  }
  // Forage — also surfaced in the shop so the player can sell-back at
  // the catalog price when they don't want to walk to the well.
  for (const k of FORAGE_KEYS) {
    const def = FORAGE[k];
    items.push({
      key: forageInventoryKey(k),
      label: def.name,
      buyPrice: null,
      sellPrice: def.sellPrice,
    });
  }
  // Coop kit + chickens + eggs — animal economy.
  items.push({
    key: COOP_INVENTORY_KEY,
    label: 'Chicken Coop',
    buyPrice: COOP_PRICE,
    sellPrice: null,
  });
  items.push({
    key: 'chicken',
    label: 'Chicken',
    buyPrice: CHICKEN_PRICE,
    sellPrice: null,
  });
  items.push({
    key: EGG_INVENTORY_KEY,
    label: 'Egg',
    buyPrice: null,
    sellPrice: EGG_SELL_PRICE,
  });
  // Farm dog ticket — redeem at the farmhouse via the J keybind.
  items.push({
    key: DOG_TICKET_KEY,
    label: 'Farm Dog Ticket',
    buyPrice: DOG_PRICE,
    sellPrice: null,
  });
  // Kitten ticket — redeem at the farmhouse via the - keybind.
  items.push({
    key: CAT_TICKET_KEY,
    label: 'Kitten Ticket',
    buyPrice: CAT_PRICE,
    sellPrice: null,
  });
  // Greenhouse kit — place onto a 3x3 grass footprint via the U keybind.
  items.push({
    key: GREENHOUSE_INVENTORY_KEY,
    label: 'Greenhouse Kit',
    buyPrice: GREENHOUSE_PRICE,
    sellPrice: null,
  });
  // Chest kit — place an extra cellar chest with the X keybind.
  items.push({
    key: CHEST_INVENTORY_KEY,
    label: 'Chest Kit',
    buyPrice: CHEST_PRICE,
    sellPrice: null,
  });
  // Auto-restock kit — Vallie keeps your last-planted seed topped up at dawn.
  items.push({
    key: AUTO_RESTOCK_KEY,
    label: 'Auto-Restock Kit',
    buyPrice: AUTO_RESTOCK_PRICE,
    sellPrice: null,
  });
  items.push({
    key: EXTRACTOR_INVENTORY_KEY,
    label: 'Seed Extractor',
    buyPrice: EXTRACTOR_PRICE,
    sellPrice: null,
  });
  // Compost bin — recycle normal-tier harvests into fertilizer bags.
  items.push({
    key: COMPOST_BIN_INVENTORY_KEY,
    label: 'Compost Bin',
    buyPrice: COMPOST_BIN_PRICE,
    sellPrice: null,
  });
  return items;
})();

/** Increases inventory[key] by `amount` (default 1). */
export function addItem(
  player: Player,
  key: string,
  amount: number = 1,
): void {
  player.inventory[key] = (player.inventory[key] ?? 0) + amount;
}

/** Removes up to `amount` of item; returns the count actually removed. */
export function removeItem(
  player: Player,
  key: string,
  amount: number = 1,
): number {
  const have = player.inventory[key] ?? 0;
  const taken = Math.min(have, amount);
  player.inventory[key] = have - taken;
  return taken;
}

/** Player has at least `amount` of item. */
export function hasItem(
  player: Player,
  key: string,
  amount: number = 1,
): boolean {
  return (player.inventory[key] ?? 0) >= amount;
}

/**
 * Tries to spend `price` gold and grant one of `itemKey`. Returns true on
 * success, false on insufficient gold (gold + inventory both unchanged).
 */
export function buyItem(
  player: Player,
  itemKey: string,
  price: number,
): boolean {
  if (player.gold < price) return false;
  player.gold -= price;
  addItem(player, itemKey, 1);
  return true;
}

/**
 * Sells one of `itemKey` for `price` gold. Returns true on success
 * (item removed, gold added), false if the player doesn't have one.
 */
export function sellItem(
  player: Player,
  itemKey: string,
  price: number,
): boolean {
  const have = player.inventory[itemKey] ?? 0;
  if (have <= 0) return false;
  player.inventory[itemKey] = have - 1;
  player.gold += price;
  return true;
}

/**
 * Sells every unit of every harvest bucket the player has (normal,
 * silver, and gold tiers). Each tier multiplies the base sell price
 * per QUALITY_MULTIPLIER. An optional `priceMultiplier` (default 1)
 * lets festival-day callers stack a global boost on top — Fall's
 * Harvest Festival passes 1.5 to lift every crop. Returns the total
 * gold earned.
 */
export function sellAllHarvest(player: Player, priceMultiplier: number = 1): number {
  let earned = 0;
  for (const key of Object.keys(player.inventory)) {
    const parsed = parseHarvestKey(key);
    if (!parsed) continue;
    const base = CROPS[parsed.cropKey]?.sellPrice ?? 0;
    const mult = QUALITY_MULTIPLIER[parsed.quality];
    const have = player.inventory[key] ?? 0;
    earned += Math.floor(have * base * mult * priceMultiplier);
    player.inventory[key] = 0;
  }
  player.gold += earned;
  return earned;
}

/**
 * Sells every mined gem in the player's inventory at its catalog price.
 * The well doubles as the village's raw-materials buyer for the v0.4.0
 * mining loop — gems trade at GEMS[key].sellPrice each. Returns total
 * gold earned (0 if the pouch is empty).
 */
export function sellAllGems(player: Player): number {
  let earned = 0;
  for (const k of GEM_KEYS) {
    const invKey = gemInventoryKey(k);
    const have = player.inventory[invKey] ?? 0;
    if (have <= 0) continue;
    earned += have * GEMS[k].sellPrice;
    player.inventory[invKey] = 0;
  }
  player.gold += earned;
  return earned;
}
