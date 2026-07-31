// Carpenter's Bench — buy-from-Maple-style craft menu that converts
// gold + mined gems into placeables. Lives as a fixed village fixture
// just south of Vallie's shop so the village walk has another anchor.
//
// Each recipe lists its gold cost and a gem cost (key + count). The
// player must have enough of both, the bench deducts both, and the
// crafted item lands in inventory under a `craft-*` key. Placement
// keybinds for those crafted items are owned by their respective
// feature modules (e.g. scarecrow.ts wires the placement hook for
// craft-scarecrow).
//
// Pure module: no IO, no canvas. The UI lives in ../ui/bench-menu.ts.

import type { Player } from '../world/world';
import { GEMS, type GemKey, gemInventoryKey } from './gems';

/** Tile-space coordinates of the bench in the village square. */
export const BENCH_X = 22;
export const BENCH_Y = 9;
/** Chebyshev approach radius. */
export const BENCH_INTERACT_RADIUS = 1;

/** A single craft recipe. */
export interface BenchRecipe {
  /** Inventory key the player receives on craft. */
  key: string;
  /** Display label in the menu. */
  label: string;
  /** Gold cost. */
  gold: number;
  /** Gem requirement — key + count. */
  gem: { key: GemKey; count: number };
  /** One-line flavor under the row. */
  flavor: string;
}

/** Catalog of bench recipes. Stable order — additions go at the end.
 *
 * Pricing intent: each recipe costs roughly half a small day's gold
 * plus one low-to-mid tier gem so a mining run translates directly
 * into craft fuel. Scarecrow stays the centerpiece (boosts crops);
 * lantern + fence post are cosmetic anchors that prove the loop.
 */
export const BENCH_RECIPES: BenchRecipe[] = [
  {
    key: 'craft-scarecrow',
    label: 'Scarecrow',
    gold: 300,
    gem: { key: 'iron', count: 1 },
    flavor: 'Plant in your field. Nearby crops harvest at a higher tier.',
  },
  {
    key: 'craft-coop-deluxe',
    label: 'Coop Deluxe Upgrade Kit',
    gold: 700,
    gem: { key: 'iron', count: 2 },
    flavor: 'Apply at a coop ( } key ) to more than double fancy egg odds.',
  },
  {
    key: 'craft-lantern',
    label: 'Brass Lantern',
    gold: 180,
    gem: { key: 'copper', count: 1 },
    flavor: 'A warm post-light for the farmhouse path. Cosmetic.',
  },
  {
    key: 'craft-fence',
    label: 'Stone Fence Post',
    gold: 80,
    gem: { key: 'copper', count: 1 },
    flavor: 'Tidy stacked-stone post. Cosmetic edging for fields.',
  },
  {
    key: 'craft-hatchery',
    label: 'Hatchery Basket',
    gold: 220,
    gem: { key: 'copper', count: 2 },
    flavor: 'Place next to a coop. Incubates a fancy egg into a new chicken.',
  },
  {
    key: 'craft-shelter',
    label: 'Storm Shelter',
    gold: 400,
    gem: { key: 'iron', count: 1 },
    flavor: 'Place on grass. Keeps the 3x3 around it dry through the next storm.',
  },
];

/** True iff the player is within range to interact with the bench. */
export function nearBench(px: number, py: number): boolean {
  return (
    Math.abs(px - BENCH_X) <= BENCH_INTERACT_RADIUS &&
    Math.abs(py - BENCH_Y) <= BENCH_INTERACT_RADIUS
  );
}

/** Result of a craft attempt. */
export type BenchCraftOutcome =
  | { kind: 'crafted'; recipe: BenchRecipe; remainingGold: number }
  | { kind: 'not-enough-gold'; recipe: BenchRecipe; need: number; have: number }
  | { kind: 'not-enough-gems'; recipe: BenchRecipe; gemKey: GemKey; need: number; have: number }
  | { kind: 'unknown-recipe' };

/**
 * Read whether the player has enough of everything required. Used by
 * the UI to dim un-craftable rows without attempting the full craft.
 */
export function canCraft(player: Player, recipe: BenchRecipe): boolean {
  if (player.gold < recipe.gold) return false;
  const gemHave = player.inventory[gemInventoryKey(recipe.gem.key)] ?? 0;
  return gemHave >= recipe.gem.count;
}

/**
 * Per-recipe shopping-list line: what the player is missing right
 * now in plain language. Returns an empty string when the player
 * can already craft the recipe. Surfaces to the bench menu so the
 * "dimmed" rows tell the player exactly which gap to close instead
 * of forcing them to do the gold + gem math by eye.
 *
 * Lists gold first, then gem shortage. When BOTH are short the line
 * surfaces both gaps separated by ", " — early-game players rarely
 * have enough of either resource and seeing both gaps at once is
 * the whole point.
 */
export function recipeShoppingList(player: Player, recipe: BenchRecipe): string {
  const parts: string[] = [];
  if (player.gold < recipe.gold) {
    parts.push(`need ${recipe.gold - player.gold}g more`);
  }
  const gemInv = gemInventoryKey(recipe.gem.key);
  const gemHave = player.inventory[gemInv] ?? 0;
  if (gemHave < recipe.gem.count) {
    const shortBy = recipe.gem.count - gemHave;
    const gemName = GEMS[recipe.gem.key].name;
    const plural = shortBy === 1 ? '' : 's';
    parts.push(`need ${shortBy} more ${gemName}${plural}`);
  }
  return parts.join(', ');
}

/**
 * Spend gold + gems and grant one of `recipeKey`. Returns a detailed
 * outcome so the UI can post a precise toast.
 */
export function craftAtBench(
  player: Player,
  recipeKey: string,
): BenchCraftOutcome {
  const recipe = BENCH_RECIPES.find((r) => r.key === recipeKey);
  if (!recipe) return { kind: 'unknown-recipe' };
  if (player.gold < recipe.gold) {
    return { kind: 'not-enough-gold', recipe, need: recipe.gold, have: player.gold };
  }
  const gemInv = gemInventoryKey(recipe.gem.key);
  const gemHave = player.inventory[gemInv] ?? 0;
  if (gemHave < recipe.gem.count) {
    return {
      kind: 'not-enough-gems',
      recipe,
      gemKey: recipe.gem.key,
      need: recipe.gem.count,
      have: gemHave,
    };
  }
  // Deduct both — gold first so the gem balance is the second guard.
  player.gold -= recipe.gold;
  player.inventory[gemInv] = gemHave - recipe.gem.count;
  player.inventory[recipe.key] = (player.inventory[recipe.key] ?? 0) + 1;
  return { kind: 'crafted', recipe, remainingGold: player.gold };
}

/** Pretty per-row cost line ("180g + 1 Copper Nugget"). */
export function recipeCostLine(recipe: BenchRecipe): string {
  const gemName = GEMS[recipe.gem.key].name;
  const plural = recipe.gem.count === 1 ? '' : 's';
  return `${recipe.gold}g + ${recipe.gem.count} ${gemName}${plural}`;
}
