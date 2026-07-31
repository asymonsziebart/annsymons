// Fish pond at the farm — stock one species, collect daily yield.
//
// The starter world already carves a small 4x4 pond on the west side
// (tiles x in [2,5], y in [18,21]). This module turns that pond into a
// real gameplay loop: the player can stock it with a caught fish, and
// from then on the pond produces 1-2 additional fish of the SAME
// species at each dawn rollover (cached in the pond state). Pressing
// `>` adjacent to the pond stocks it (when empty) or collects the
// pending yield (when stocked).
//
// Design intent: small-scale "passive" income that doesn't replace the
// fishing minigame — the pond can only host one species at a time and
// caps at POND_MAX_PENDING uncollected fish, so the player still has
// to walk back and harvest. Stocking is permanent: once you've picked
// a species you can RESET the pond (consume + refresh) only by
// collecting the current yield first, then standing in front while
// adjacent and pressing `>` again with a different fish in the bag.
//
// Pure module: no IO, no canvas (besides a small per-tile glyph for
// the pond when stocked). The Game wires the `>` press and the dawn
// hook.

import type { World } from '../world/world';
import type { FishKey } from './fish';
import { FISH, FISH_KEYS } from './fish';

/** Daily fish produced per stocked species. Two for the rare, one for the rest. */
export const POND_YIELD_PER_DAY: Record<FishKey, number> = {
  minnow: 2,
  carp: 1,
  bass: 1,
  trout: 1,
  pike: 1,
};

/** Max uncollected fish that can sit in the pond. Base footprint. */
export const POND_MAX_PENDING = 6;

/** Inventory key for the stone-rim pond upgrade (singleton). */
export const POND_RIM_INVENTORY_KEY = 'pond-stone-rim';

/** Gold cost of the stone-rim upgrade at Pip's cart. */
export const POND_RIM_PRICE = 450;

/** Capacity once the stone rim is installed — raises 6 -> 10. */
export const POND_MAX_PENDING_RIM = 10;

/**
 * True iff the player owns the stone-rim upgrade. Quantity 1 = owned.
 * Pure read on player.inventory — no separate save schema.
 */
export function hasPondRim(player: { inventory: Record<string, number> }): boolean {
  return (player.inventory[POND_RIM_INVENTORY_KEY] ?? 0) > 0;
}

/**
 * Effective capacity for the pond given the (optional) player. Reads
 * the rim flag from inventory; falls back to POND_MAX_PENDING when no
 * player is provided so callers that don't care about the upgrade
 * (legacy tests, headless validation) still get the base capacity.
 */
export function pondMaxFor(player?: { inventory: Record<string, number> }): number {
  if (player && hasPondRim(player)) return POND_MAX_PENDING_RIM;
  return POND_MAX_PENDING;
}

/** Per-species lifetime ribbon — heaviest single-day yield ever pulled. */
export interface PondRibbon {
  /** Highest count collected in a single dawn for this species. */
  count: number;
  /** Calendar tag of the day the record was set. */
  season: number;
  day: number;
}

/** Persisted pond state on the world. */
export interface PondState {
  /** Which species the pond is currently stocked with, or null when empty. */
  species: FishKey | null;
  /** How many of that species are sitting in the pond, uncollected. */
  pending: number;
  /** Last day the dawn yield was applied (-1 = never). */
  lastYieldDay: number;
  /**
   * Heaviest single-day yield per species. Mirrors the crop ribbon
   * pattern in crop-journal.ts so a flexed pond loop reads as a real
   * achievement. Recorded at pondTick time — the moment the dawn
   * yield actually arrives, NOT at collect time, so a player who lets
   * pending fish stack up doesn't artificially inflate the ribbon.
   */
  ribbons?: Partial<Record<FishKey, PondRibbon>>;
}

/** Lazy reader on the World. */
export function getPond(world: World): PondState {
  const w = world as World & { pond?: PondState };
  if (!w.pond) w.pond = { species: null, pending: 0, lastYieldDay: -1 };
  return w.pond;
}

/**
 * Tile-space bounding box of the carved pond — read live from the
 * world's tiles so changes to the map shift this with it. We return
 * the first contiguous run of water tiles on the west side.
 */
export function pondBounds(world: World): { x0: number; y0: number; x1: number; y1: number } {
  // The world's pond lives at x:[2,6) y:[18,22). Encode that here so
  // callers don't have to walk the tile grid; if the world ever grows
  // multiple ponds this becomes the canonical "farm pond" set.
  return { x0: 2, y0: 18, x1: 5, y1: 21 };
}

/** True iff (tx,ty) is a water tile inside the farm pond footprint. */
export function isPondTile(world: World, tx: number, ty: number): boolean {
  const b = pondBounds(world);
  if (tx < b.x0 || tx > b.x1 || ty < b.y0 || ty > b.y1) return false;
  if (!world.inBounds(tx, ty)) return false;
  return world.tiles[ty][tx].type === 'water';
}

/** True when (px,py) is orthogonally or diagonally adjacent to ANY pond tile. */
export function nearPond(world: World, px: number, py: number): boolean {
  const b = pondBounds(world);
  // Cheap rectangle check first.
  if (px < b.x0 - 1 || px > b.x1 + 1 || py < b.y0 - 1 || py > b.y1 + 1) return false;
  // The player must be ON a non-water tile that touches a pond water tile.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (isPondTile(world, px + dx, py + dy)) return true;
    }
  }
  return false;
}

/** Outcome of an interaction attempt. */
export type PondOutcome =
  | { kind: 'stocked'; species: FishKey; label: string }
  | { kind: 'restocked'; from: FishKey; to: FishKey; fromLabel: string; toLabel: string }
  | { kind: 'collected'; species: FishKey; count: number; label: string }
  | { kind: 'too-far' }
  | { kind: 'empty-no-fish' }
  | { kind: 'nothing-pending'; species: FishKey };

/**
 * Stock an empty pond with the player's MOST-ABUNDANT caught fish.
 * Ties break by FISH_KEYS catalog order. Consumes one fish from the
 * bag to "seed" the pond. If the pond is already stocked, no-op.
 */
export function stockPond(
  world: World,
  player: { inventory: Record<string, number> },
): PondOutcome {
  const state = getPond(world);
  if (state.species !== null) {
    // Already stocked — caller should fall through to collect.
    return { kind: 'nothing-pending', species: state.species };
  }
  // Find the most-abundant fish in the bag.
  let best: FishKey | null = null;
  let bestCount = 0;
  for (const key of FISH_KEYS) {
    const have = player.inventory[`fish-${key}`] ?? 0;
    if (have > bestCount) {
      best = key;
      bestCount = have;
    }
  }
  if (!best || bestCount === 0) {
    return { kind: 'empty-no-fish' };
  }
  // Consume one seed fish. The pond memorises the species.
  player.inventory[`fish-${best}`] = bestCount - 1;
  state.species = best;
  state.pending = 0;
  return { kind: 'stocked', species: best, label: FISH[best].name };
}

/**
 * Reseed an already-stocked-but-empty pond with the player's
 * most-abundant DIFFERENT species from the bag. The pond must have
 * pending == 0 (else collect first) and the candidate species must
 * differ from the currently stocked one. Returns 'empty-no-fish' if no
 * other species is in the bag.
 *
 * Use case: the player has wrung out a season's worth of minnows from
 * the pond and now wants to flip it to pike before the boss night
 * fishing window.
 */
export function reseedPond(
  world: World,
  player: { inventory: Record<string, number> },
): PondOutcome {
  const state = getPond(world);
  if (state.species === null) {
    // Falls through to stockPond.
    return stockPond(world, player);
  }
  if (state.pending > 0) {
    // Pending fish would be stranded if we swapped species — caller
    // should collect first.
    return { kind: 'nothing-pending', species: state.species };
  }
  const current = state.species;
  // Find the most-abundant OTHER species.
  let best: FishKey | null = null;
  let bestCount = 0;
  for (const key of FISH_KEYS) {
    if (key === current) continue;
    const have = player.inventory[`fish-${key}`] ?? 0;
    if (have > bestCount) {
      best = key;
      bestCount = have;
    }
  }
  if (!best || bestCount === 0) {
    return { kind: 'empty-no-fish' };
  }
  player.inventory[`fish-${best}`] = bestCount - 1;
  const from = current;
  state.species = best;
  state.pending = 0;
  // lastYieldDay stays — the new species starts producing at the next
  // dawn rollover via pondTick, just like a fresh stock.
  return {
    kind: 'restocked',
    from,
    to: best,
    fromLabel: FISH[from].name,
    toLabel: FISH[best].name,
  };
}

/**
 * Collect every pending fish into the player's bag. Returns
 * 'nothing-pending' when the pond is stocked but has no waiting fish.
 */
export function collectPond(
  world: World,
  player: { inventory: Record<string, number> },
): PondOutcome {
  const state = getPond(world);
  if (state.species === null) return { kind: 'empty-no-fish' };
  if (state.pending <= 0) return { kind: 'nothing-pending', species: state.species };
  const species = state.species;
  const count = state.pending;
  player.inventory[`fish-${species}`] = (player.inventory[`fish-${species}`] ?? 0) + count;
  state.pending = 0;
  return { kind: 'collected', species, count, label: FISH[species].name };
}

/**
 * Combined "press `>` near the pond" entry-point. Stocks if empty,
 * collects when there's a pending yield, attempts a species swap when
 * the pond is stocked-but-empty AND the player carries a different
 * species, otherwise returns 'nothing-pending'.
 */
export function interactPond(
  world: World,
  player: { inventory: Record<string, number> },
  px: number,
  py: number,
): PondOutcome {
  if (!nearPond(world, px, py)) return { kind: 'too-far' };
  const state = getPond(world);
  if (state.species === null) return stockPond(world, player);
  if (state.pending > 0) return collectPond(world, player);
  // Stocked but empty -> try a reseed before falling through to the hint.
  const reseed = reseedPond(world, player);
  if (reseed.kind === 'restocked') return reseed;
  return { kind: 'nothing-pending', species: state.species };
}

/**
 * Day-rollover hook: if the pond is stocked, add today's yield to its
 * pending pool (capped at POND_MAX_PENDING, or POND_MAX_PENDING_RIM
 * when the stone-rim upgrade is owned). Idempotent per-day via
 * `lastYieldDay`. Returns the number of fish actually added.
 *
 * `player` is optional — old callers (tests, headless validation)
 * keep the original 6-fish cap; the live game.ts caller passes the
 * player so the rim upgrade matters.
 *
 * When `time` is supplied, the ribbon for the current species is
 * recomputed against today's pending total — a 7-pending minnow run
 * on Fall day 4 sets the minnow ribbon to {7, Fall, 4}. We use the
 * total pending (not the yield ADD this morning) so the ribbon
 * reflects the heaviest swarm the pond actually held at dawn, which
 * is what the player ends up flexing.
 */
export function pondTick(
  world: World,
  day: number,
  player?: { inventory: Record<string, number> },
  time?: { season: number; day: number },
): number {
  const state = getPond(world);
  if (state.species === null) return 0;
  if (state.lastYieldDay === day) return 0;
  state.lastYieldDay = day;
  const yieldToday = POND_YIELD_PER_DAY[state.species] ?? 1;
  const before = state.pending;
  const cap = pondMaxFor(player);
  state.pending = Math.min(cap, state.pending + yieldToday);
  if (time) recordPondRibbon(state, state.species, state.pending, time);
  return state.pending - before;
}

/**
 * Update the pond ribbon for `species` if `count` beats the prior
 * record (or no record exists). Pure mutation on `state.ribbons`.
 * Exposed so the dawn engine and the swap path can both record a
 * new high without duplicating the comparator.
 */
export function recordPondRibbon(
  state: PondState,
  species: FishKey,
  count: number,
  time: { season: number; day: number },
): void {
  if (count <= 0) return;
  if (!state.ribbons) state.ribbons = {};
  const prev = state.ribbons[species];
  if (!prev || count > prev.count) {
    state.ribbons[species] = { count, season: time.season, day: time.day };
  }
}

/** Returns the current ribbon for `species`, or undefined when unset. */
export function pondRibbonFor(state: PondState, species: FishKey): PondRibbon | undefined {
  return state.ribbons?.[species];
}

/** Season-index → human label used for ribbon tags. */
const POND_SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/** Format a pond ribbon as "ribbon: 7 in a day - Fall d4" or empty. */
export function pondRibbonLine(state: PondState, species: FishKey): string {
  const ribbon = pondRibbonFor(state, species);
  if (!ribbon) return '';
  const name = POND_SEASON_NAMES[Math.abs(ribbon.season) % 4] ?? 'Spring';
  return `ribbon: ${ribbon.count} in a day - ${name} d${ribbon.day}`;
}

/** Pretty status line for HUD / toasts. */
export function pondStatusLine(
  state: PondState,
  player?: { inventory: Record<string, number> },
): string {
  if (state.species === null) return 'Pond is empty. Stock with a caught fish.';
  const name = FISH[state.species].name;
  const cap = pondMaxFor(player);
  const rimTag = player && hasPondRim(player) ? ` (rim cap ${cap})` : '';
  const ribbon = pondRibbonLine(state, state.species);
  const ribbonTag = ribbon ? ` [${ribbon}]` : '';
  if (state.pending === 0)
    return `Pond stocked with ${name}${rimTag}. Come back tomorrow — or press > with a different fish to swap.${ribbonTag}`;
  return `Pond: ${state.pending} ${name}${state.pending === 1 ? '' : 's'} waiting${rimTag}.${ribbonTag}`;
}

/**
 * True iff tomorrow's pond yield would put `pending` over the cap, i.e.
 * at least one fish would be lost to overflow if the player doesn't
 * collect today. Pure read on the live pond state + the player's rim
 * status. Returns false for empty / already-overflowing / not-yet-stocked
 * ponds — the dawn-toast nag is meant to land BEFORE the loss, not after.
 *
 * Why "tomorrow" semantics: the dawn-toast tail fires AFTER pondTick has
 * already credited today's yield, so the player has the current pending
 * total. The nag is forward-looking — if pending + yieldToday would
 * exceed cap on the NEXT rollover, surface the warning.
 */
export function pondWouldOverflowTomorrow(
  state: PondState,
  player?: { inventory: Record<string, number> },
): boolean {
  if (state.species === null) return false;
  if (state.pending <= 0) return false;
  const cap = pondMaxFor(player);
  if (state.pending >= cap) return false;
  const yieldTomorrow = POND_YIELD_PER_DAY[state.species] ?? 1;
  return state.pending + yieldTomorrow > cap;
}

/**
 * Dawn-toast tail line nagging the player to collect from the pond
 * before tomorrow's yield wastes a fish. Empty when no nag is due.
 *
 * The wording calls out the exact loss so the player knows whether
 * a "I'll grab it tomorrow" plan is fine (loss of 1 minnow on the
 * way to a 7-pending stack is forgivable) or expensive (overflow of
 * a pike on a 10-cap rim is real gold gone).
 */
export function pondOverflowWarning(
  state: PondState,
  player?: { inventory: Record<string, number> },
): string {
  if (!pondWouldOverflowTomorrow(state, player)) return '';
  const species = state.species!;
  const name = FISH[species].name;
  const cap = pondMaxFor(player);
  const yieldTomorrow = POND_YIELD_PER_DAY[species] ?? 1;
  const lost = state.pending + yieldTomorrow - cap;
  return `Pond is brimming with ${name} (${state.pending}/${cap}) — collect by tomorrow or lose ${lost}.`;
}
