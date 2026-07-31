// Controls catalog — the single source of truth for the in-game help
// overlay (`?`). The game has grown to ~40 keybinds across farming,
// gathering, animals, building, village interactions and info panels,
// but until now there was NO in-game reference: a new player had to
// guess or read the source. This module enumerates every binding,
// grouped into readable categories, so the HelpOverlay can render a
// clean two-column cheat sheet that stays in sync with the game.
//
// Pure data + a couple of helpers. No canvas, no engine imports — the
// overlay (and tests) consume CONTROL_GROUPS directly. When a future
// tick adds a keybind, add one row here and it shows up in the overlay
// automatically.

/** A single key -> action row. `keys` is the display glyph(s). */
export interface ControlBinding {
  /** Display string for the key(s), e.g. "E", "WASD / Arrows", "1-5". */
  keys: string;
  /** Short imperative description of what the key does. */
  label: string;
}

/** A titled cluster of related bindings. */
export interface ControlGroup {
  title: string;
  bindings: ControlBinding[];
}

/**
 * Every binding the game listens for, grouped for the cheat sheet.
 * Order is chosen so the most-used clusters (move, farm, gather) lead.
 */
export const CONTROL_GROUPS: ControlGroup[] = [
  {
    title: 'Move & interact',
    bindings: [
      { keys: 'WASD / Arrows', label: 'Walk around the village' },
      { keys: 'E', label: 'Talk, harvest, open menus' },
      { keys: '1-5', label: 'Pick a seed / the watering can' },
      { keys: 'Esc', label: 'Close the open panel or menu' },
    ],
  },
  {
    title: 'Farm',
    bindings: [
      { keys: 'T', label: 'Till the soil in front' },
      { keys: 'W', label: 'Water the crop in front' },
      { keys: '1-5', label: 'Plant the selected seed' },
      { keys: 'O', label: 'Place / pick up a sprinkler' },
      { keys: 'U', label: 'Place a greenhouse kit' },
      { keys: '{', label: 'Plant a scarecrow' },
    ],
  },
  {
    title: 'Gather',
    bindings: [
      { keys: 'F', label: 'Fish (face water)' },
      { keys: 'M', label: 'Mine (face stone)' },
      { keys: 'Y', label: 'Pick wild forage' },
      { keys: 'L', label: 'Run the seed extractor' },
      { keys: '>', label: 'Stock / collect the farm pond' },
    ],
  },
  {
    title: 'Animals & friends',
    bindings: [
      { keys: 'N', label: 'Place a chicken coop' },
      { keys: 'I', label: 'Add a chicken to the coop' },
      { keys: 'J', label: 'Adopt / pet the farm dog' },
      { keys: '-', label: 'Adopt / pet the farm cat' },
      { keys: '6', label: 'Hatchery: place / load / claim' },
      { keys: 'G', label: 'Give a gift to whoever you face' },
      { keys: 'P', label: 'Propose / hold the wedding' },
    ],
  },
  {
    title: 'Upgrade at Vallie\u2019s',
    bindings: [
      { keys: ',', label: 'Upgrade the hoe' },
      { keys: '.', label: 'Upgrade the watering can' },
      { keys: '/', label: 'Upgrade the pickaxe' },
      { keys: '=', label: 'Upgrade the fishing rod' },
    ],
  },
  {
    title: 'Home & village',
    bindings: [
      { keys: 'B', label: 'Sleep until dawn (near home)' },
      { keys: 'C', label: 'Cook (near the inn)' },
      { keys: 'Z', label: 'Sip the best drink for stamina' },
      { keys: '7', label: 'Compost: place / deposit / apply' },
      { keys: '8', label: 'Place a storm shelter' },
      { keys: 'X', label: 'Place a storage chest' },
      { keys: ']', label: 'Open a storage chest' },
      { keys: '[', label: 'Read the next letter (near home)' },
      { keys: '~', label: 'Send an owl (near home)' },
      { keys: 'K', label: 'Save the game' },
    ],
  },
  {
    title: 'Panels',
    bindings: [
      { keys: '?', label: 'This controls overlay' },
      { keys: 'Tab', label: 'Inventory / bag (f to sort)' },
      { keys: '9', label: 'Village minimap' },
      { keys: '0', label: 'Almanac of upcoming days (f to filter)' },
      { keys: 'H', label: 'Hearts / relationships' },
      { keys: 'R', label: 'Recipe codex' },
      { keys: ';', label: 'Crop journal' },
      { keys: 'V', label: 'Achievements' },
      { keys: 'Q', label: 'Money log' },
      { keys: '\u2019', label: 'Quest log' },
      { keys: '`', label: 'Lore / bestiary' },
      { keys: '\\', label: 'Settings' },
    ],
  },
];

/** Flattened count of every binding across all groups. */
export function totalBindingCount(): number {
  return CONTROL_GROUPS.reduce((n, g) => n + g.bindings.length, 0);
}

/**
 * Does a single binding match the (already-lowercased) filter string? A
 * match is a case-insensitive substring hit on either the key glyph or
 * the action label, so typing "f" lights up "Fish (face water)" and "F",
 * and typing "panel" surfaces nothing at the binding level (the title
 * carries that — see groupMatchesFilter). Empty filter matches everything.
 */
export function bindingMatchesFilter(b: ControlBinding, filter: string): boolean {
  if (filter.length === 0) return true;
  const f = filter.toLowerCase();
  return b.keys.toLowerCase().includes(f) || b.label.toLowerCase().includes(f);
}

/**
 * Does a group match the filter? True when the group's title matches OR
 * any of its bindings match. So a typed "panel" lights the whole Panels
 * group, and a typed "water" lights Farm (via the watering binding).
 * Empty filter matches every group. Pure.
 */
export function groupMatchesFilter(g: ControlGroup, filter: string): boolean {
  if (filter.length === 0) return true;
  const f = filter.toLowerCase();
  if (g.title.toLowerCase().includes(f)) return true;
  return g.bindings.some((b) => bindingMatchesFilter(b, filter));
}

/**
 * Indices of the groups (within `groups`) that match the filter. Empty
 * filter -> every index. Used by the overlay to dim the non-matching
 * groups while keeping the layout stable (nothing is removed, only
 * dimmed). Pure.
 */
export function matchingGroupIndices(
  filter: string,
  groups: ControlGroup[] = CONTROL_GROUPS,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    if (groupMatchesFilter(groups[i], filter)) out.push(i);
  }
  return out;
}

/**
 * How many individual bindings match the filter, across every group. The
 * overlay surfaces this as a "N of M keys" readout so the player knows the
 * filter is doing something even when whole groups stay lit. Pure.
 */
export function matchingBindingCount(
  filter: string,
  groups: ControlGroup[] = CONTROL_GROUPS,
): number {
  let n = 0;
  for (const g of groups) {
    for (const b of g.bindings) {
      if (bindingMatchesFilter(b, filter)) n++;
    }
  }
  return n;
}

/**
 * Split the groups into two balanced columns for the overlay. Greedy
 * fill: walk the groups in order, keep adding to the left column until
 * it holds at least half the total *rows* (counting a title as one row),
 * then the rest go right. Returns [left, right] group arrays.
 */
export function splitControlColumns(
  groups: ControlGroup[] = CONTROL_GROUPS,
): [ControlGroup[], ControlGroup[]] {
  const rowsOf = (g: ControlGroup) => g.bindings.length + 1; // +1 for the title
  const total = groups.reduce((n, g) => n + rowsOf(g), 0);
  const half = total / 2;
  const left: ControlGroup[] = [];
  const right: ControlGroup[] = [];
  let acc = 0;
  for (const g of groups) {
    if (acc < half) {
      left.push(g);
      acc += rowsOf(g);
    } else {
      right.push(g);
    }
  }
  // Guard: never let one side be empty if there's more than one group.
  if (groups.length > 1 && (left.length === 0 || right.length === 0)) {
    const mid = Math.ceil(groups.length / 2);
    return [groups.slice(0, mid), groups.slice(mid)];
  }
  return [left, right];
}
