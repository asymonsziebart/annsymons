// Panel empty-states — one shared vocabulary for "there's nothing here yet"
// across the game's info panels.
//
// Several panels could render zero rows (a filtered lore list, a fresh
// save's money log / quest board) but handled it inconsistently: the
// money log + quest log each hard-coded a bare one-liner with no hint at
// how to fill the list, and the lore panel drew NOTHING at all when a
// Rumors filter matched no entries — an empty void that reads as broken.
//
// This module owns a small registry of calm two-part empty states (a
// message + a "here's how to populate it" hint) so every panel speaks the
// same reassuring language, and a couple of pure resolvers for the panels
// whose empty state depends on context (the lore Rumors tab + its filter).
// The thin widget (ui/empty-state.ts) centres the two lines in a panel.
//
// Pure: type-only imports, no canvas, no engine state.

import type { LoreCategory, RumorFilter } from './lore';
import type { BagCategory } from './bag';

/** A calm empty state: what's missing + a nudge toward filling it. */
export interface EmptyState {
  /** The "nothing here yet" line. */
  message: string;
  /** A short hint at how to populate the list (may be ''). */
  hint: string;
}

/** Named, reusable empty states keyed by a stable panel id. */
export const PANEL_EMPTY_STATES = {
  moneyLog: {
    message: 'No coin movement yet.',
    hint: 'Sell crops at the well or cook at the inn.',
  },
  questLog: {
    message: 'No quests on the board.',
    hint: 'Read the village notice board by the well.',
  },
} as const satisfies Record<string, EmptyState>;

/**
 * Per-category empty states for the inventory bag's seven tabs. The bag
 * panel used to hand-roll a one-line switch (`emptyLineFor`) that spoke a
 * different dialect from the money / quest / lore panels — a bare sentence
 * with the "how to fill it" nudge crammed in after an em dash. Routing it
 * through the shared two-part EmptyState shape lets every panel speak ONE
 * calm "nothing here yet + here's how" language, and the bag inherits the
 * same centred two-line widget the other panels already use.
 *
 * Each tab points the player at the verb that fills it (buy seeds, cast a
 * line, mine, forage, cook), so an empty tab teaches rather than dead-ends.
 */
export const BAG_EMPTY_STATES: Record<BagCategory, EmptyState> = {
  Seeds: { message: 'No seeds yet.', hint: 'Buy some from Vallie to start a field.' },
  Crops: { message: 'No harvest in the bag.', hint: 'Plant a seed and tend it to ripeness.' },
  Fish: { message: 'No fish in the bag.', hint: 'Cast a line at the water (F).' },
  Gems: { message: 'No gems in the bag.', hint: 'Mine the stone outcrop (M).' },
  Forage: { message: 'No forage gathered.', hint: 'Wander the grass at dawn (Y).' },
  Kitchen: { message: 'No eggs or dishes.', hint: 'Collect eggs or cook at the inn (C).' },
  Supplies: { message: 'Nothing stowed here.', hint: 'Kits and tickets you buy land here.' },
};

/**
 * Resolve the calm empty state for a bag tab. Total over BagCategory, so
 * the panel never has to special-case a missing key. Pure.
 */
export function bagEmptyState(category: BagCategory): EmptyState {
  return BAG_EMPTY_STATES[category];
}

/**
 * Format the "press f for <next>" call-to-action a filterable panel shows
 * when its active filter has hidden every row. The panel family's filters
 * all share the same shape — a `cycleXFilter(current)` that advances the
 * cycle and an `xFilterLabel(filter)` that names each mode — so this one
 * generic helper names where the NEXT `f` press will land (e.g. "press f
 * for cooked") instead of the vaguer "press f to change the filter". That
 * tells the player where the cycle goes before they press, closing the
 * loop on the filtered-empty notes across the codex / quest-log / money-
 * log / achievements panels. Pure: just composes the two callbacks.
 */
export function nextFilterHint<F>(
  current: F,
  cycle: (f: F) => F,
  label: (f: F) => string,
): string {
  return `press f for ${label(cycle(current))}`;
}

/**
 * Empty state for the lore panel's Rumors tab, which is the only lore tab
 * that can render zero rows (the catalogued tabs always show locked ???
 * rows). Wording depends on the active filter so a player who filtered to
 * "bought" with nothing bought sees why the list is empty, not a void.
 * Returns null for tabs/filters that can never be empty so the caller only
 * draws the empty state when it's meaningful.
 */
export function loreEmptyState(
  tab: LoreCategory,
  filter: RumorFilter,
  rowCount: number,
): EmptyState | null {
  if (rowCount > 0) return null;
  if (tab !== 'Rumors') {
    // Non-Rumors tabs always carry catalog rows; defensively give a calm
    // line anyway so a future empty tab never renders blank.
    return { message: 'Nothing discovered here yet.', hint: 'Explore the village to fill this page.' };
  }
  switch (filter) {
    case 'bought':
      return {
        message: 'No headliners bought yet.',
        hint: "Buy what Pip teases to grow this list.",
      };
    case 'skipped':
      return {
        message: 'No skipped headliners.',
        hint: "Every rumor you've seen got bought.",
      };
    case 'all':
    default:
      return {
        message: 'No rumors heard yet.',
        hint: "Wait for Pip's cart to roll into the square.",
      };
  }
}
