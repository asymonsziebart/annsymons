// Bag model — categorize the player's flat inventory into a readable,
// tabbed "what do I own" view.
//
// The player's inventory is a single Record<string, number> that mixes
// everything: seeds (`wheat`), harvests (`wheat_harvest`, `_silver`,
// `_gold`), fish (`fish-pike`), gems (`gem-ruby`), forage (`forage-berry`),
// cooked dishes (`dish-herb-tea`, `dish-..-premium`), eggs (`egg`,
// `egg-fancy`, `egg-breeder`), fertilizer bags, and a long tail of tools /
// kits / tickets / cosmetics. The game had panels for the *meta* (recipes,
// crops, money, lore) but no single screen that answers the plainest
// question — "what's actually in my bag right now?". This module is the
// pure half of that bag panel: it walks the inventory once and sorts every
// non-zero stack into a small set of glanceable categories with a human
// label and a best-effort gold value, so the UI is a thin renderer.
//
// Pure: reads player.inventory + the catalogs, returns plain data. No
// canvas, no mutation. The UI (ui/bag-panel.ts) owns the draw + the tabs.

import type { Player } from '../world/world';
import { CROPS } from './crops';
import { parseHarvestKey, QUALITY_MULTIPLIER, QUALITY_LABEL } from './crop-quality';
import { FISH, type FishKey } from './fish';
import { GEMS, type GemKey } from './gems';
import { FORAGE, type ForageKind } from './forage';
import { RECIPES, premiumSellPrice, type DishKey } from './cooking';
import {
  EGG_INVENTORY_KEY,
  EGG_SELL_PRICE,
  FANCY_EGG_INVENTORY_KEY,
  FANCY_EGG_SELL_PRICE,
  BREEDER_EGG_INVENTORY_KEY,
} from './coop';

/** Bag tab categories, in display order. */
export const BAG_CATEGORIES = [
  'Seeds',
  'Crops',
  'Fish',
  'Gems',
  'Forage',
  'Kitchen',
  'Supplies',
] as const;
export type BagCategory = (typeof BAG_CATEGORIES)[number];

/**
 * Within-category sort modes the player can cycle while the bag is open.
 * - `count`: fullest stacks first (the historical default).
 * - `value`: richest stacks first, by total worth (count * unitValue), so
 *   the player can find where their money is sitting.
 * - `name`: A-Z by label, for hunting a specific item.
 * The category grouping never changes — only the order inside each tab.
 */
export const BAG_SORT_MODES = ['count', 'value', 'name'] as const;
export type BagSortMode = (typeof BAG_SORT_MODES)[number];

/** Short human label for the sort chip, e.g. "by value". */
export function bagSortLabel(mode: BagSortMode): string {
  switch (mode) {
    case 'count':
      return 'by count';
    case 'value':
      return 'by value';
    case 'name':
      return 'A-Z';
  }
}

/** Advance to the next sort mode, wrapping count -> value -> name -> count. */
export function cycleBagSort(mode: BagSortMode): BagSortMode {
  const i = BAG_SORT_MODES.indexOf(mode);
  return BAG_SORT_MODES[(i + 1) % BAG_SORT_MODES.length];
}

/**
 * Which way a sort mode orders rows, so the chip can show a direction
 * indicator (an arrow / A-Z glyph) instead of leaving the ordering implicit:
 *   - `desc`: count + value both put the BIGGEST stack/worth first (high ->
 *     low), so a down-arrow reads "descending".
 *   - `az`:   name sorts the labels A -> Z (ascending alphabetical).
 * Mirrors sortBagItems's comparators exactly (count/value use `b - a`, name
 * uses localeCompare), so the indicator can never claim the wrong order.
 * Pure.
 */
export type BagSortDirection = 'desc' | 'az';

export function bagSortDirection(mode: BagSortMode): BagSortDirection {
  return mode === 'name' ? 'az' : 'desc';
}

/** A single rolled-up bag row. */
export interface BagItem {
  /** Raw inventory key. */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Stack size (always > 0 — zero stacks are filtered out). */
  count: number;
  /** Best-effort gold value of one unit (0 when not sellable / unknown). */
  unitValue: number;
  /** Which tab this row lives under. */
  category: BagCategory;
}

/** Keys that are tools / placeables / cosmetics, surfaced under Supplies. */
const SUPPLY_LABELS: Record<string, string> = {
  hoe: 'Hoe',
  'watering-can': 'Watering Can',
  bouquet: 'Bouquet',
  fertilizer: 'Fertilizer Bag',
  'fertilizer-rare': 'Rare Fertilizer Bag',
  'perfumed-soap': 'Perfumed Soap',
  chicken: 'Chicken',
};

/** Prettify a hyphen/underscore key into Title Case words. */
function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Resolve a dish key (possibly a `-premium` variant) to a label + value. */
function dishRow(key: string, count: number): BagItem | null {
  const isPremium = key.endsWith('-premium');
  const base = isPremium ? key.slice('dish-'.length, -'-premium'.length) : key.slice('dish-'.length);
  const recipe = RECIPES[base as DishKey];
  if (!recipe) {
    // Unknown dish key — still surface it generically so nothing vanishes.
    return { key, label: titleCase(base), count, unitValue: 0, category: 'Kitchen' };
  }
  const value = isPremium ? premiumSellPrice(base as DishKey) : recipe.sellPrice;
  const label = isPremium ? `${recipe.name} (premium)` : recipe.name;
  return { key, label, count, unitValue: value, category: 'Kitchen' };
}

/** Resolve one (key, count) inventory entry into a categorized row, or null. */
export function classifyBagKey(key: string, count: number): BagItem | null {
  if (count <= 0) return null;

  // Seeds — a bare crop key with no suffix.
  if (CROPS[key]) {
    return {
      key,
      label: `${CROPS[key].name} Seeds`,
      count,
      unitValue: 0, // seeds aren't sold back
      category: 'Seeds',
    };
  }

  // Harvested crops (normal / silver / gold buckets).
  const harvest = parseHarvestKey(key);
  if (harvest && CROPS[harvest.cropKey]) {
    const crop = CROPS[harvest.cropKey];
    const value = Math.round(crop.sellPrice * QUALITY_MULTIPLIER[harvest.quality]);
    const star = QUALITY_LABEL[harvest.quality];
    const label = star ? `${crop.name} (${star})` : crop.name;
    return { key, label, count, unitValue: value, category: 'Crops' };
  }

  // Fish.
  if (key.startsWith('fish-')) {
    const fk = key.slice('fish-'.length) as FishKey;
    const def = FISH[fk];
    if (def) return { key, label: def.name, count, unitValue: def.sellPrice, category: 'Fish' };
  }

  // Gems.
  if (key.startsWith('gem-')) {
    const gk = key.slice('gem-'.length) as GemKey;
    const def = GEMS[gk];
    if (def) return { key, label: def.name, count, unitValue: def.sellPrice, category: 'Gems' };
  }

  // Forage.
  if (key.startsWith('forage-')) {
    const fk = key.slice('forage-'.length) as ForageKind;
    const def = FORAGE[fk];
    if (def) return { key, label: def.name, count, unitValue: def.sellPrice, category: 'Forage' };
  }

  // Eggs — kitchen-adjacent produce.
  if (key === EGG_INVENTORY_KEY) {
    return { key, label: 'Egg', count, unitValue: EGG_SELL_PRICE, category: 'Kitchen' };
  }
  if (key === FANCY_EGG_INVENTORY_KEY) {
    return { key, label: 'Fancy Egg', count, unitValue: FANCY_EGG_SELL_PRICE, category: 'Kitchen' };
  }
  if (key === BREEDER_EGG_INVENTORY_KEY) {
    return { key, label: 'Breeder Egg', count, unitValue: 0, category: 'Kitchen' };
  }

  // Cooked dishes.
  if (key.startsWith('dish-')) {
    return dishRow(key, count);
  }

  // Known supplies (tools / placeables / cosmetics) with friendly labels.
  if (SUPPLY_LABELS[key]) {
    return { key, label: SUPPLY_LABELS[key], count, unitValue: 0, category: 'Supplies' };
  }

  // Everything else (kits, tickets, crafted items, sprinklers, ...) lands
  // in Supplies with a title-cased label so nothing the player owns is
  // ever invisible — the bag is a complete mirror of the inventory.
  return { key, label: titleCase(key), count, unitValue: 0, category: 'Supplies' };
}

/**
 * Build the full bag: every non-zero inventory stack as a categorized row.
 * Rows are always grouped by category in the canonical order; within a
 * category the `sort` mode decides the order:
 *   - `count` (default): descending count, ties by label — the fullest
 *     stacks lead and ties read alphabetically. Back-compat default so
 *     every existing caller / test keeps its order.
 *   - `value`: descending total worth (count * unitValue), ties by label,
 *     so the richest stacks surface first.
 *   - `name`: A-Z by label.
 * Pure.
 */
export function buildBag(player: Player, sort: BagSortMode = 'count'): BagItem[] {
  const inv = player.inventory ?? {};
  const rows: BagItem[] = [];
  for (const key of Object.keys(inv)) {
    const row = classifyBagKey(key, inv[key] ?? 0);
    if (row) rows.push(row);
  }
  const order: Record<BagCategory, number> = {
    Seeds: 0,
    Crops: 1,
    Fish: 2,
    Gems: 3,
    Forage: 4,
    Kitchen: 5,
    Supplies: 6,
  };
  rows.sort((a, b) => {
    if (a.category !== b.category) return order[a.category] - order[b.category];
    if (sort === 'name') return a.label.localeCompare(b.label);
    if (sort === 'value') {
      const wa = a.count * a.unitValue;
      const wb = b.count * b.unitValue;
      if (wa !== wb) return wb - wa;
      return a.label.localeCompare(b.label);
    }
    // 'count' (default).
    if (a.count !== b.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
  return rows;
}

/** Rows belonging to a single category, in their sorted order. Pure. */
export function bagItemsForCategory(
  player: Player,
  category: BagCategory,
  sort: BagSortMode = 'count',
): BagItem[] {
  return buildBag(player, sort).filter((r) => r.category === category);
}

/**
 * Cross-tab search: every bag row whose label contains the query as a
 * case-insensitive substring, in the same category-then-sort order
 * buildBag produces (so results read top-down like the normal list, just
 * filtered). An empty / whitespace-only query returns [] — the caller
 * treats that as "no active search" and shows a prompt instead of the
 * whole bag. Matching on the human LABEL (not the raw key) so a player
 * typing "ruby" or "premium" finds what they'd read on screen. Pure.
 */
export function bagSearchResults(
  player: Player,
  query: string,
  sort: BagSortMode = 'count',
): BagItem[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  return buildBag(player, sort).filter((r) => r.label.toLowerCase().includes(q));
}

/** How many bag rows match the search query across all tabs. Pure. */
export function bagSearchMatchCount(player: Player, query: string): number {
  return bagSearchResults(player, query).length;
}

/**
 * Per-category counts of the cross-tab search MATCHES, so the bag's tab
 * strip can swap its idle stack-count sub-labels for the match
 * distribution while `/` search is active (e.g. the player typing "ruby"
 * sees the hits concentrated under Gems). Counts every category — zero
 * for tabs with no match — so the panel can show a uniform "Cat N" sub.
 * An empty / whitespace query yields all-zero counts (no active search).
 * Pure.
 */
export function bagSearchCategoryCounts(
  player: Player,
  query: string,
): Record<BagCategory, number> {
  const counts: Record<BagCategory, number> = {
    Seeds: 0,
    Crops: 0,
    Fish: 0,
    Gems: 0,
    Forage: 0,
    Kitchen: 0,
    Supplies: 0,
  };
  for (const row of bagSearchResults(player, query)) counts[row.category] += 1;
  return counts;
}

/** Per-category non-zero stack counts, for the tab-strip sub-labels. Pure. */
export function bagCategoryCounts(player: Player): Record<BagCategory, number> {
  const counts: Record<BagCategory, number> = {
    Seeds: 0,
    Crops: 0,
    Fish: 0,
    Gems: 0,
    Forage: 0,
    Kitchen: 0,
    Supplies: 0,
  };
  for (const row of buildBag(player)) counts[row.category] += 1;
  return counts;
}

/** Total number of distinct non-zero stacks across the whole bag. Pure. */
export function bagTotalStacks(player: Player): number {
  return buildBag(player).length;
}

/**
 * Total sellable worth of a single category — sum of count * unitValue
 * over the rows in that tab. Lets the panel show "Gems: 412g" so the
 * player can see where their money is sitting without doing the sum in
 * their head. Pure.
 */
export function bagCategoryValue(player: Player, category: BagCategory): number {
  return bagItemsForCategory(player, category).reduce(
    (sum, r) => sum + r.count * r.unitValue,
    0,
  );
}

/**
 * Where-to-sell hint for a category, or null when the tab isn't a sell
 * loop (Seeds + Supplies aren't sold back). Closes the gap between seeing
 * a stack's worth and realising it: the bag shows value but no action, so
 * a one-line footer points the player at the right counter. Accurate to
 * the engine's actual sell verbs:
 *   - Crops / Gems / Forage / eggs sell at the well (E).
 *   - Dishes sell at the inn (Rose pays for cooked food).
 *   - Fish are cooking ingredients — they don't sell raw, so the hint
 *     nudges the player to cook them at the inn instead.
 * Pure formatter; no economy change.
 */
export function bagSellHint(category: BagCategory): string | null {
  switch (category) {
    case 'Crops':
      return 'Sell crops at the well (stand in front, press E).';
    case 'Gems':
      return 'Sell gems at the well (stand in front, press E).';
    case 'Forage':
      return 'Sell forage at the well, or trade it at the inn.';
    case 'Fish':
      return 'Fish are cooking stock — cook them into dishes at the inn (C).';
    case 'Kitchen':
      return 'Eggs sell at the well; cooked dishes sell at the inn.';
    case 'Seeds':
    case 'Supplies':
      return null;
  }
}

/**
 * Total sellable worth of the whole bag — sum of count * unitValue across
 * every row that carries a value. A glanceable "your bag is worth ~Ng"
 * figure for the panel header. Pure.
 */
export function bagTotalValue(player: Player): number {
  return buildBag(player).reduce((sum, r) => sum + r.count * r.unitValue, 0);
}

/**
 * Total worth of a single bag row — count * unitValue. The per-row figure
 * the value sort actually orders by, so the panel can surface it as a
 * right-column number when sorting by value (otherwise the ordering looks
 * arbitrary next to the per-unit "Ng ea" price). 0 for valueless rows
 * (seeds, supplies, breeder eggs). Pure.
 */
export function bagItemWorth(item: BagItem): number {
  return item.count * item.unitValue;
}

/**
 * The largest stack `count` across a list of bag rows — the denominator for
 * the per-row count bar, so every row's fill reads on one shared scale (the
 * fullest stack fills the track). 0 for an empty list (the panel then draws
 * no bars). Pure — reads only the rows handed in, so the panel can pass the
 * CURRENTLY visible slice (active tab, or the cross-tab search matches) and
 * the bars scale to what's on screen rather than the whole bag.
 */
export function maxBagRowCount(rows: readonly BagItem[]): number {
  let max = 0;
  for (const r of rows) {
    if (r.count > max) max = r.count;
  }
  return max;
}

/**
 * Pixel width of a row's count bar: `count / maxCount` of `fullWidth`, so a
 * stack of 30 against a fullest-stack of 60 fills half the track. The
 * fullest stack fills it completely; any non-zero stack is guaranteed at
 * least 1px so a lone item still shows a sliver rather than a blank track.
 * Returns 0 when there's nothing to scale against (maxCount <= 0), the row
 * is empty (count <= 0), or fullWidth is non-positive — the panel then skips
 * the bar. Clamped so a count somehow exceeding the max can't overflow the
 * track. Pure — no canvas. Mirrors the crop-journal harvest mini-bar's
 * shared-scale approach so the two bars read the same way.
 */
export function bagCountBarWidth(
  count: number,
  maxCount: number,
  fullWidth: number,
): number {
  if (maxCount <= 0 || count <= 0 || fullWidth <= 0) return 0;
  const frac = Math.min(1, count / maxCount);
  return Math.max(1, Math.round(frac * fullWidth));
}

/** One category's slice of the whole-bag worth, for the share bar. */
export interface BagWorthSegment {
  category: BagCategory;
  /** Sellable worth of this category (count * unitValue summed). */
  worth: number;
  /** Pixel width of this category's segment in the stacked bar. */
  width: number;
}

/**
 * Lay out a stacked "where's my money" bar: one segment per category,
 * each sized to its SHARE of the whole-bag worth, in the canonical
 * category order. The widths use the same largest-remainder allocation as
 * the crop-journal harvest mini-bar so they always sum exactly to
 * `fullWidth`, and any category with a non-zero worth is guaranteed at
 * least 1px (borrowed from the widest segment) so a small-but-real slice
 * never vanishes. Categories with zero worth get a zero-width segment and
 * are dropped, so the returned list only carries the bars worth drawing.
 *
 * Returns an empty list when the bag has no sellable worth or fullWidth is
 * non-positive (the panel then draws nothing). Pure — no canvas.
 */
export function bagWorthShares(
  player: Player,
  fullWidth: number,
): BagWorthSegment[] {
  const worths = BAG_CATEGORIES.map((category) => ({
    category,
    worth: bagCategoryValue(player, category),
  }));
  const total = worths.reduce((s, w) => s + w.worth, 0);
  if (total <= 0 || fullWidth <= 0) return [];
  // Largest-remainder allocation of fullWidth across the categories by
  // worth, so the segments always sum exactly to fullWidth.
  const ideal = worths.map((w) => (w.worth / total) * fullWidth);
  const widths = ideal.map((v) => Math.floor(v));
  let used = widths.reduce((s, v) => s + v, 0);
  const order = worths
    .map((_, i) => i)
    .sort((a, b) => (ideal[b] - widths[b]) - (ideal[a] - widths[a]));
  let k = 0;
  while (used < fullWidth) {
    widths[order[k % widths.length]] += 1;
    used += 1;
    k += 1;
  }
  // Guarantee a non-zero-worth category is at least 1px, borrowing from
  // the widest segment so the total stays exact.
  for (let i = 0; i < widths.length; i++) {
    if (worths[i].worth > 0 && widths[i] === 0) {
      const widest = widths.indexOf(Math.max(...widths));
      if (widths[widest] > 1) {
        widths[widest] -= 1;
        widths[i] += 1;
      }
    }
  }
  return worths
    .map((w, i) => ({ category: w.category, worth: w.worth, width: widths[i] }))
    .filter((s) => s.worth > 0);
}

/**
 * Name where the bag's money sits in one short caption, so a colour-blind
 * player reads the worth-share bar's hues as words: the top one or two
 * categories by worth, e.g. "most worth in Gems, then Crops" or just "most
 * worth in Crops" when a single category dominates. Returns '' when the bag
 * has no sellable worth (the bar isn't drawn either). The two-category form
 * only appears when the runner-up carries a meaningful slice (>= ~15% of the
 * whole) so a sliver doesn't earn a mention. Pure — derives from the same
 * share figures the bar uses, so the caption can never disagree with it.
 */
export function bagWorthCaption(player: Player): string {
  const total = bagTotalValue(player);
  if (total <= 0) return '';
  const sorted = BAG_CATEGORIES.map((category) => ({
    category,
    worth: bagCategoryValue(player, category),
  }))
    .filter((w) => w.worth > 0)
    .sort((a, b) => b.worth - a.worth);
  if (sorted.length === 0) return '';
  const top = sorted[0];
  // Mention the runner-up only when it's a real share, not a rounding crumb.
  if (sorted.length >= 2 && sorted[1].worth >= total * 0.15) {
    return `most worth in ${top.category}, then ${sorted[1].category}`;
  }
  return `most worth in ${top.category}`;
}
