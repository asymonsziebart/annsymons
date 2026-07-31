// Cooking — recipe catalog + the pure `cook()` function.
//
// This is slice 1 of the v0.3.0 cooking pot. We keep it self-contained,
// like fishing.ts did before its world wiring: the module owns the
// recipe data and a single mutation entry point (`cook`) that consumes
// ingredients from the player's inventory and grants a dish.
//
// Dishes are stored on the player as `dish-<key>` inventory entries so
// they don't collide with the existing `<crop>_harvest` / `fish-<key>`
// namespaces. The inn UI (next tick) will surface them; the well sell
// loop in economy.ts already only touches `_harvest` keys, so dishes
// stay safely "inn-only" currency until we explicitly hook them up.
//
// Pricing rule: every dish sells for STRICTLY MORE than the sum of its
// raw ingredient sell prices — that's the whole point of cooking. The
// markup is tuned per recipe so simple stews are reliably profitable
// without making the late-game pumpkin feast trivially OP.

import type { Player } from '../world/world';
import { CROPS } from './crops';
import { FISH, type FishKey } from './fish';
import { FORAGE } from './forage';
import { EGG_SELL_PRICE, BREEDER_EGG_INVENTORY_KEY, FANCY_EGG_SELL_PRICE } from './coop';

/** Identifier keys for every dish the player can produce. */
export type DishKey =
  | 'hearty-stew'
  | 'pumpkin-soup'
  | 'fish-chowder'
  | 'veggie-medley'
  | 'valley-feast'
  | 'farm-omelet'
  | 'pumpkin-custard'
  | 'mushroom-skillet'
  | 'berry-tart'
  | 'herb-tea'
  | 'hot-cocoa'
  | 'berry-tonic'
  | 'mushroom-broth'
  | 'sunflower-elixir';

/** One required ingredient line: an inventory key + how many to consume. */
export interface Ingredient {
  /** Inventory key the player must have (e.g. `wheat_harvest`, `fish-minnow`). */
  key: string;
  /** How many units to consume. */
  count: number;
}

/** Static recipe definition. */
export interface Recipe {
  /** Stable key — also doubles as `dish-<key>` in the player inventory. */
  key: DishKey;
  /** Human-readable name shown in the cooking menu / HUD toasts. */
  name: string;
  /** Short flavour line shown on the recipe card. */
  flavor: string;
  /** Required ingredients (all must be present in the player's inventory). */
  ingredients: Ingredient[];
  /** Gold earned when sold at the inn. */
  sellPrice: number;
}

/**
 * Catalog of starter recipes. Ordered roughly by complexity / unlock — the
 * inn UI will render them in this order. Numbers are tuned so each dish is
 * at least ~30% more valuable than the sum of its ingredients raw.
 */
export const RECIPES: Record<DishKey, Recipe> = {
  'hearty-stew': {
    key: 'hearty-stew',
    name: 'Hearty Stew',
    flavor: 'Wheat + tomato simmered low. The classic.',
    ingredients: [
      { key: 'wheat_harvest', count: 1 },
      { key: 'tomato_harvest', count: 1 },
    ],
    sellPrice: 50, // raw: 8 + 25 = 33 → +17 markup
  },
  'pumpkin-soup': {
    key: 'pumpkin-soup',
    name: 'Pumpkin Soup',
    flavor: 'A single ripe pumpkin, slow-roasted with cream.',
    ingredients: [{ key: 'pumpkin_harvest', count: 1 }],
    sellPrice: 110, // raw: 80 → +30 markup
  },
  'fish-chowder': {
    key: 'fish-chowder',
    name: 'River Chowder',
    flavor: 'Pond minnow + a heel of wheat bread.',
    ingredients: [
      { key: 'fish-minnow', count: 1 },
      { key: 'wheat_harvest', count: 1 },
    ],
    sellPrice: 25, // raw: 5 + 8 = 13 → +12 markup
  },
  'veggie-medley': {
    key: 'veggie-medley',
    name: 'Garden Medley',
    flavor: 'Everything from the field, tossed in butter.',
    ingredients: [
      { key: 'wheat_harvest', count: 1 },
      { key: 'tomato_harvest', count: 1 },
      { key: 'flower_harvest', count: 1 },
    ],
    sellPrice: 70, // raw: 8 + 25 + 15 = 48 → +22 markup
  },
  'valley-feast': {
    key: 'valley-feast',
    name: 'Valley Feast',
    flavor: 'One of everything from the farm. A celebration.',
    ingredients: [
      { key: 'wheat_harvest', count: 1 },
      { key: 'tomato_harvest', count: 1 },
      { key: 'pumpkin_harvest', count: 1 },
      { key: 'flower_harvest', count: 1 },
    ],
    sellPrice: 200, // raw: 128 → +72 markup
  },
  // ---- Egg + forage tier (post-coop, post-forage) ----
  'farm-omelet': {
    key: 'farm-omelet',
    name: 'Farm Omelet',
    flavor: 'Two fresh eggs folded over a ripe tomato.',
    ingredients: [
      { key: 'egg', count: 2 },
      { key: 'tomato_harvest', count: 1 },
    ],
    sellPrice: 80, // raw: 12*2 + 25 = 49 → +31 markup
  },
  'pumpkin-custard': {
    key: 'pumpkin-custard',
    name: 'Pumpkin Custard',
    flavor: 'Slow-baked pumpkin with three sweet eggs.',
    ingredients: [
      { key: 'egg', count: 3 },
      { key: 'pumpkin_harvest', count: 1 },
    ],
    sellPrice: 180, // raw: 12*3 + 80 = 116 → +64 markup
  },
  'mushroom-skillet': {
    key: 'mushroom-skillet',
    name: 'Mushroom Skillet',
    flavor: 'Forest mushrooms sizzled with two farm-fresh eggs.',
    ingredients: [
      { key: 'egg', count: 2 },
      { key: 'forage-mushroom', count: 2 },
    ],
    sellPrice: 75, // raw: 24 + 18 = 42 → +33 markup
  },
  'berry-tart': {
    key: 'berry-tart',
    name: 'Berry Tart',
    flavor: 'Wild berries on a wheat-flour crust. Glossy red.',
    ingredients: [
      { key: 'forage-berry', count: 3 },
      { key: 'wheat_harvest', count: 1 },
      { key: 'egg', count: 1 },
    ],
    sellPrice: 65, // raw: 18 + 8 + 12 = 38 → +27 markup
  },
  'herb-tea': {
    key: 'herb-tea',
    name: 'Sage Tea',
    flavor: 'Two sprigs steeped in well water. Quiet evenings.',
    ingredients: [{ key: 'forage-herb', count: 2 }],
    sellPrice: 22, // raw: 8 → +14 markup
  },
  // ---- Winter comfort tier ----
  'hot-cocoa': {
    key: 'hot-cocoa',
    name: 'Hot Cocoa',
    flavor: 'Two eggs whipped with milk and a wheat-flour crust. Winter staple.',
    ingredients: [
      { key: 'egg', count: 2 },
      { key: 'wheat_harvest', count: 1 },
    ],
    sellPrice: 55, // raw: 12*2 + 8 = 32 -> +23 markup
  },
  // ---- Stamina tea tier (restore-only drinks for the energy pool) ----
  'berry-tonic': {
    key: 'berry-tonic',
    name: 'Berry Tonic',
    flavor: 'Wild berries steeped with one sprig of sage. Sharp and bright.',
    ingredients: [
      { key: 'forage-berry', count: 3 },
      { key: 'forage-herb', count: 1 },
    ],
    sellPrice: 38, // raw: 6*3 + 4 = 22 -> +16 markup
  },
  'mushroom-broth': {
    key: 'mushroom-broth',
    name: 'Mushroom Broth',
    flavor: 'Three mushrooms simmered with a half tomato. Earthy + warming.',
    ingredients: [
      { key: 'forage-mushroom', count: 3 },
      { key: 'tomato_harvest', count: 1 },
    ],
    sellPrice: 70, // raw: 9*3 + 25 = 52 -> +18 markup
  },
  'sunflower-elixir': {
    key: 'sunflower-elixir',
    name: 'Sunflower Elixir',
    flavor: 'A flower, a pumpkin, an egg. The strongest pour at the bar.',
    ingredients: [
      { key: 'flower_harvest', count: 2 },
      { key: 'pumpkin_harvest', count: 1 },
      { key: 'egg', count: 1 },
    ],
    sellPrice: 175, // raw: 30 + 80 + 12 = 122 -> +53 markup
  },
};

/** All recipe keys in catalog order — useful for the future cooking menu. */
export const RECIPE_KEYS: DishKey[] = Object.keys(RECIPES) as DishKey[];

/**
 * Inventory key under which a finished dish is stored. The leading `dish-`
 * prefix keeps it disjoint from harvest / seed / fish keys.
 */
export function dishInventoryKey(key: DishKey): string {
  return `dish-${key}`;
}

/**
 * Sums up the raw sell value of a recipe's ingredients — using CROPS for
 * `_harvest` keys and FISH for `fish-<key>` entries. Anything we don't
 * recognise is treated as zero, on the principle that future recipes can
 * include items (eggs, milk) without breaking the math.
 */
export function ingredientsValue(recipe: Recipe): number {
  let total = 0;
  for (const ing of recipe.ingredients) {
    total += rawSellValue(ing.key) * ing.count;
  }
  return total;
}

/** Best-effort raw sell value lookup for a single inventory key. */
export function rawSellValue(key: string): number {
  if (key.endsWith('_harvest')) {
    const cropKey = key.slice(0, -'_harvest'.length);
    return CROPS[cropKey]?.sellPrice ?? 0;
  }
  if (key.startsWith('fish-')) {
    const fishKey = key.slice('fish-'.length) as FishKey;
    return FISH[fishKey]?.sellPrice ?? 0;
  }
  if (key.startsWith('forage-')) {
    const kind = key.slice('forage-'.length) as keyof typeof FORAGE;
    return FORAGE[kind]?.sellPrice ?? 0;
  }
  if (key === 'egg') return EGG_SELL_PRICE;
  return 0;
}

/** Whether the player has every ingredient a recipe requires. */
export function canCook(player: Player, recipeKey: DishKey): boolean {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return false;
  for (const ing of recipe.ingredients) {
    if ((player.inventory[ing.key] ?? 0) < ing.count) return false;
  }
  return true;
}

/**
 * Attempts to cook `recipeKey`. On success consumes every ingredient and
 * increments `dish-<recipeKey>` in the player's inventory by 1, returning
 * true. On failure (missing ingredients, unknown key) the player state is
 * left untouched and the function returns false.
 *
 * The function is intentionally side-effect-only on the Player so the
 * future inn-cooking UI can drive it straight from a keystroke without
 * threading extra context.
 */
export function cook(player: Player, recipeKey: DishKey): boolean {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return false;
  if (!canCook(player, recipeKey)) return false;
  for (const ing of recipe.ingredients) {
    player.inventory[ing.key] = (player.inventory[ing.key] ?? 0) - ing.count;
  }
  const dishKey = dishInventoryKey(recipeKey);
  player.inventory[dishKey] = (player.inventory[dishKey] ?? 0) + 1;
  return true;
}

/** Convenience: total gold value of every dish in the inventory. */
export function dishesValue(player: Player): number {
  let total = 0;
  for (const recipeKey of RECIPE_KEYS) {
    const have = player.inventory[dishInventoryKey(recipeKey)] ?? 0;
    total += have * RECIPES[recipeKey].sellPrice;
  }
  return total;
}

/**
 * Sells every dish in the player's inventory, mirroring `sellAllHarvest`
 * but for the inn rather than the well. Adds the total to `player.gold`,
 * zeros every `dish-<key>` entry, and returns the total gold earned so
 * the caller can surface it in a toast.
 *
 * Returns 0 when the player has no dishes — the caller is responsible
 * for showing a "nothing to sell" message in that case.
 */
export function sellAllDishes(player: Player): number {
  let earned = 0;
  for (const recipeKey of RECIPE_KEYS) {
    const key = dishInventoryKey(recipeKey);
    const have = player.inventory[key] ?? 0;
    if (have > 0) {
      earned += have * RECIPES[recipeKey].sellPrice;
      player.inventory[key] = 0;
    }
    // The premium variant lives in a parallel key per recipe — walk
    // it separately so a stock of premium dishes (with no regular
    // dishes for the same recipe) still gets sold.
    const premKey = premiumDishInventoryKey(recipeKey);
    const havePrem = player.inventory[premKey] ?? 0;
    if (havePrem > 0) {
      earned += havePrem * premiumSellPrice(recipeKey);
      player.inventory[premKey] = 0;
    }
  }
  player.gold += earned;
  return earned;
}

// ---------------------------------------------------------------------
// Premium cooking — breeder eggs can stand in for a regular egg in any
// egg-bearing recipe, producing a premium variant that sells for
// PREMIUM_SELL_MULTIPLIER × the base dish.
//
// Mechanics:
//   - one breeder egg replaces exactly ONE regular egg requirement in
//     the recipe; the rest of the ingredients still get consumed.
//   - the premium dish lives at `dish-<key>-premium` so it doesn't
//     collide with the regular variant; existing fixtures that read
//     `dish-<key>` aren't affected.
//   - cookPremium refuses on recipes that don't list an egg ingredient
//     so the player can't accidentally "premiumise" a Sage Tea.
//
// Why this design instead of a parallel recipe table: breeder eggs
// hadn't found a meaningful cooking outlet beyond the cart trade-in.
// Carrying a Brass-Barometer-tier per-recipe parallel catalog would
// have doubled the codex; reusing the existing recipe with a single-
// ingredient swap keeps the cookbook compact and gives heritage
// breeding a fancier reason to exist.
// ---------------------------------------------------------------------

/**
 * Sell-price multiplier for a premium dish. Conservative — the
 * breeder egg already costs more to produce than a regular fancy egg,
 * so the markup tops out at 1.5× to keep the cook-and-sell loop
 * grounded.
 */
export const PREMIUM_SELL_MULTIPLIER = 1.5;

/**
 * Inventory key under which a premium dish is stored. The trailing
 * `-premium` suffix keeps it disjoint from the regular dish key.
 */
export function premiumDishInventoryKey(key: DishKey): string {
  return `dish-${key}-premium`;
}

/** Premium sell-price for `key` — round-half-up of base * multiplier. */
export function premiumSellPrice(key: DishKey): number {
  return Math.round(RECIPES[key].sellPrice * PREMIUM_SELL_MULTIPLIER);
}

/**
 * True iff `recipe` carries at least one regular-egg ingredient. We
 * use the `egg` key as the substitution target because breeder eggs
 * are themselves a fancier kind of egg.
 */
export function recipeHasEgg(recipe: Recipe): boolean {
  return recipe.ingredients.some((ing) => ing.key === 'egg' && ing.count >= 1);
}

/** True iff the player can cook the premium variant of `recipeKey`. */
export function canCookPremium(player: Player, recipeKey: DishKey): boolean {
  const recipe = RECIPES[recipeKey];
  if (!recipe || !recipeHasEgg(recipe)) return false;
  const haveBreeder = player.inventory[BREEDER_EGG_INVENTORY_KEY] ?? 0;
  if (haveBreeder <= 0) return false;
  for (const ing of recipe.ingredients) {
    if (ing.key === 'egg') {
      // Need one breeder egg + (count-1) regular eggs.
      const haveReg = player.inventory.egg ?? 0;
      if (haveReg < ing.count - 1) return false;
    } else {
      if ((player.inventory[ing.key] ?? 0) < ing.count) return false;
    }
  }
  return true;
}

/**
 * Cook the premium variant of `recipeKey`. Consumes 1 breeder egg +
 * (egg.count - 1) regular eggs + every other ingredient at full count,
 * then increments `dish-<recipeKey>-premium`. Returns false (no
 * mutation) when the recipe doesn't list an egg, the player lacks a
 * breeder egg, or any other ingredient is missing.
 */
export function cookPremium(player: Player, recipeKey: DishKey): boolean {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return false;
  if (!recipeHasEgg(recipe)) return false;
  if (!canCookPremium(player, recipeKey)) return false;
  for (const ing of recipe.ingredients) {
    if (ing.key === 'egg') {
      player.inventory[BREEDER_EGG_INVENTORY_KEY] =
        (player.inventory[BREEDER_EGG_INVENTORY_KEY] ?? 0) - 1;
      player.inventory.egg = (player.inventory.egg ?? 0) - (ing.count - 1);
    } else {
      player.inventory[ing.key] = (player.inventory[ing.key] ?? 0) - ing.count;
    }
  }
  const premKey = premiumDishInventoryKey(recipeKey);
  player.inventory[premKey] = (player.inventory[premKey] ?? 0) + 1;
  return true;
}

/** Total gold value of every premium dish in the inventory. */
export function premiumDishesValue(player: Player): number {
  let total = 0;
  for (const recipeKey of RECIPE_KEYS) {
    const have = player.inventory[premiumDishInventoryKey(recipeKey)] ?? 0;
    total += have * premiumSellPrice(recipeKey);
  }
  return total;
}

/**
 * Pretty markup line for the codex panel — "Premium: +Ng if you cook
 * with a breeder egg". Returns the empty string for recipes that
 * don't accept the swap. Pure formatter so the codex panel can stitch
 * it under the regular ingredient line.
 */
export function premiumCookLine(recipeKey: DishKey): string {
  const recipe = RECIPES[recipeKey];
  if (!recipe || !recipeHasEgg(recipe)) return '';
  const delta = premiumSellPrice(recipeKey) - recipe.sellPrice;
  return `Premium (breeder egg swap): ${premiumSellPrice(recipeKey)}g (+${delta}g)`;
}

/** Constant re-export so test fixtures pulling from cooking.ts can find it. */
export { FANCY_EGG_SELL_PRICE };

// ---------------------------------------------------------------------
// Stamina-tea double-batch — at the inn the player can pour a
// double-batch of any stamina-restoring tea by spending 2x the
// ingredients to produce 3x finished dishes. The "third dish" is the
// inn's discount-for-bulk reward; mechanically it gives a player who
// has saved up forage a satisfying way to convert it into a deep
// stamina reserve without per-recipe wiring.
//
// Why this design:
//   - we don't introduce a parallel dish key — the bonus yield piles
//     into the same `dish-<key>` slot as a regular cook so the
//     existing drinkBest path picks them up unchanged.
//   - only the five existing stamina-restoring teas are eligible
//     (herb-tea / hot-cocoa / berry-tonic / mushroom-broth /
//     sunflower-elixir). Restricting it to those keeps the cookbook
//     focused on the energy loop and prevents a player from
//     "double-batching" pumpkin custard to print valley-feasts.
//   - we expose canCookDoubleBatch + cookDoubleBatch separately so
//     a future inn UI can toggle the batch path without re-wiring
//     the cook() function.
// ---------------------------------------------------------------------

/** Multiplier applied to each ingredient when double-batching. */
export const DOUBLE_BATCH_INGREDIENT_MULT = 2;

/** Yield bonus — 3 dishes per batch instead of the regular 1. */
export const DOUBLE_BATCH_DISH_YIELD = 3;

/** Canonical set of stamina-tea dish keys — mirrors stamina.ts entries. */
export const STAMINA_TEA_KEYS: ReadonlySet<DishKey> = new Set<DishKey>([
  'herb-tea',
  'hot-cocoa',
  'berry-tonic',
  'mushroom-broth',
  'sunflower-elixir',
]);

/**
 * True iff `recipeKey` resolves to a dish that restores stamina —
 * the only recipes eligible for the double-batch path. The eligible
 * set mirrors stamina.ts entries; tests assert the two stay in sync.
 */
export function isStaminaTea(recipeKey: DishKey): boolean {
  return STAMINA_TEA_KEYS.has(recipeKey);
}

/** True iff the player can cook a double-batch of `recipeKey`. */
export function canCookDoubleBatch(player: Player, recipeKey: DishKey): boolean {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return false;
  if (!isStaminaTea(recipeKey)) return false;
  for (const ing of recipe.ingredients) {
    if ((player.inventory[ing.key] ?? 0) < ing.count * DOUBLE_BATCH_INGREDIENT_MULT) {
      return false;
    }
  }
  return true;
}

/**
 * Cook a double-batch of `recipeKey` — consumes 2x ingredients and
 * mints 3 dishes into `dish-<recipeKey>`. The bonus dish piles into
 * the existing slot so the drinkBest path picks it up without any
 * extra wiring.
 *
 * Returns false (no mutation) when the recipe isn't a stamina tea or
 * the player lacks the doubled ingredients.
 */
export function cookDoubleBatch(player: Player, recipeKey: DishKey): boolean {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return false;
  if (!isStaminaTea(recipeKey)) return false;
  if (!canCookDoubleBatch(player, recipeKey)) return false;
  for (const ing of recipe.ingredients) {
    player.inventory[ing.key] =
      (player.inventory[ing.key] ?? 0) - ing.count * DOUBLE_BATCH_INGREDIENT_MULT;
  }
  const dishKey = dishInventoryKey(recipeKey);
  player.inventory[dishKey] = (player.inventory[dishKey] ?? 0) + DOUBLE_BATCH_DISH_YIELD;
  return true;
}

/**
 * Pretty status line for the codex panel — surfaces the discounted
 * yield when the recipe is eligible. Returns the empty string for
 * non-tea recipes so the codex doesn't surface noise.
 *
 * Wording: "Double batch: 2x ingredients -> 3 dishes (saves Yg per dish)."
 */
export function doubleBatchLine(recipeKey: DishKey): string {
  if (!isStaminaTea(recipeKey)) return '';
  const recipe = RECIPES[recipeKey];
  if (!recipe) return '';
  // The "savings" is the per-dish ingredient-cost reduction: a regular
  // cook spends ingredientsValue() per dish; a double batch spends
  // 2x ingredientsValue() over 3 dishes -> 2/3 per dish. The dish-side
  // savings are dish-key-keyed; we surface the per-dish ingredient
  // savings instead because that's what the player feels.
  const perDishRaw = ingredientsValue(recipe);
  const perDishBatch = Math.round((perDishRaw * DOUBLE_BATCH_INGREDIENT_MULT) /
    DOUBLE_BATCH_DISH_YIELD);
  const saved = Math.max(0, perDishRaw - perDishBatch);
  return `Double batch: ${DOUBLE_BATCH_INGREDIENT_MULT}x ingredients -> ${DOUBLE_BATCH_DISH_YIELD} dishes (saves ${saved}g/dish in raw cost).`;
}
