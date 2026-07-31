// Hatchery — incubate a fancy egg into a new chicken.
//
// The fancy egg is currently a high-priced sell (3x base) and an
// ingredient for the cookbook. This module gives the player a third
// option: drop one into a hatchery alongside a coop and, five in-game
// days later, a fresh chicken hatches and walks itself into that
// coop. It turns the per-day fancy egg roll into the long-form path
// for filling out a deluxe coop without paying Vallie 200g a head.
//
// Design intent:
//   - Light-weight placement: one tile, on grass, next to a coop. We
//     reuse the bench's "craft + place" pattern so the existing crafting
//     flow keeps paying off (a Hatchery Kit slots into BENCH_RECIPES).
//   - Costs a fancy egg per cycle; uses the existing FANCY_EGG_INVENTORY_KEY
//     loop so we don't add a new currency.
//   - Caps at one egg in incubation per hatchery at a time. When the
//     egg hatches we look for the closest coop that still has slots.
//     If every coop is full the hatched chicken hangs out in the
//     hatchery and the player gets a "no room — clear a coop" toast.
//   - Deterministic: hatch_day is set at start; tick simply compares
//     today against hatch_day. Persistence is a flat list on the world.
//
// Pure module: no DOM, no canvas (we do ship a small sprite helper for
// the renderer). The Game wires the placement hook + the per-day tick.

import type { World, Tile } from '../world/world';
import { addChicken, getCoops, MAX_CHICKENS_PER_COOP, BREEDER_EGG_INVENTORY_KEY, type PlacedCoop } from './coop';

/** Crafted-kit inventory key (unplaced hatchery). */
export const HATCHERY_INVENTORY_KEY = 'craft-hatchery';

/** Inventory key consumed when a fancy egg is set to incubate. */
export const FANCY_EGG_INVENTORY_KEY = 'egg-fancy';

/** How many in-game days a fancy egg takes to hatch. */
export const HATCH_DAYS = 5;

/**
 * Probability that a hatch produces a heritage chicken instead of a
 * regular one. Heritage chickens lay fancy eggs at a meaningfully
 * higher rate (see HERITAGE_FANCY_BONUS in coop.ts). Tuned at 18% so
 * the player typically sees one in 5-6 hatches — a satisfying surprise
 * without flooding the coop with heritage breeds.
 */
export const HERITAGE_HATCH_RATE = 0.18;

/** One placed hatchery in the world. */
export interface PlacedHatchery {
  /** Tile-space coordinates. Footprint is 1x1. */
  tx: number;
  ty: number;
  /** When set, the day index the current egg will hatch on. -1 = empty. */
  hatchOnDay: number;
  /** Last hatch outcome we couldn't place into a coop; held until next pickup. */
  pendingChicken?: boolean;
  /** True when the pending or finished chick is a heritage breed. */
  pendingHeritage?: boolean;
  /**
   * Heritage roll snapshot for the in-progress incubation. Set at
   * loadEgg() time so the outcome stays deterministic per egg-load
   * even if HERITAGE_HATCH_RATE changes between loadEgg and the dawn
   * hatch tick.
   */
  incubatingHeritage?: boolean;
}

export interface WorldWithHatcheries {
  hatcheries?: PlacedHatchery[];
}

/** Lazy reader on the world. */
export function getHatcheries(world: World): PlacedHatchery[] {
  const w = world as World & WorldWithHatcheries;
  if (!w.hatcheries) w.hatcheries = [];
  return w.hatcheries;
}

/** True iff (tx,ty) is a clear grass tile orthogonally adjacent to a coop. */
export function canPlaceHatchery(world: World, tx: number, ty: number): boolean {
  if (!world.inBounds(tx, ty)) return false;
  const tile: Tile = world.tiles[ty][tx];
  if (tile.type !== 'grass') return false;
  // Don't overlap a building.
  for (const b of world.buildings) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return false;
  }
  // Must sit next to (Chebyshev radius 1 of) an existing coop. The
  // hatched chicken walks itself a short distance into the coop.
  if (!isAdjacentToAnyCoop(world, tx, ty)) return false;
  // No double-stack.
  for (const h of getHatcheries(world)) {
    if (h.tx === tx && h.ty === ty) return false;
  }
  return true;
}

function isAdjacentToAnyCoop(world: World, tx: number, ty: number): boolean {
  for (const c of getCoops(world)) {
    if (
      tx >= c.tx - 1 &&
      tx <= c.tx + 1 + 1 && // coop is 2 wide; range +1 inclusive
      ty >= c.ty - 1 &&
      ty <= c.ty + 1 + 1
    ) {
      // Inside-the-coop tiles don't count — adjacency only.
      const inside = tx >= c.tx && tx < c.tx + 2 && ty >= c.ty && ty < c.ty + 2;
      if (!inside) return true;
    }
  }
  return false;
}

/** Place a hatchery at (tx,ty). Returns the PlacedHatchery or null. */
export function placeHatchery(world: World, tx: number, ty: number): PlacedHatchery | null {
  if (!canPlaceHatchery(world, tx, ty)) return null;
  const h: PlacedHatchery = { tx, ty, hatchOnDay: -1 };
  getHatcheries(world).push(h);
  return h;
}

/** Returns the hatchery at (tx,ty) or undefined. */
export function hatcheryAt(world: World, tx: number, ty: number): PlacedHatchery | undefined {
  return getHatcheries(world).find((h) => h.tx === tx && h.ty === ty);
}

/** Returns the closest hatchery to (tx,ty) within Chebyshev radius 1. */
export function adjacentHatchery(
  world: World,
  tx: number,
  ty: number,
): PlacedHatchery | undefined {
  for (const h of getHatcheries(world)) {
    if (Math.abs(h.tx - tx) <= 1 && Math.abs(h.ty - ty) <= 1 && !(h.tx === tx && h.ty === ty)) {
      return h;
    }
  }
  // Also accept standing ON the hatchery tile.
  return hatcheryAt(world, tx, ty);
}

/** Outcome of a load-egg attempt. */
export type LoadOutcome =
  | { kind: 'loaded'; hatchOnDay: number }
  | { kind: 'no-egg' }
  | { kind: 'busy'; daysLeft: number }
  | { kind: 'pending'; }
  | { kind: 'no-hatchery' };

/**
 * Drop a fancy egg from the player's bag into the hatchery. Sets the
 * hatch countdown to (today + HATCH_DAYS). Returns 'busy' when the
 * hatchery already has an incubating egg, 'pending' when a hatched
 * chicken hasn't been moved out yet, 'no-egg' when the bag is empty.
 *
 * Prefers a BREEDER egg from the bag when one is present — breeder
 * eggs always hatch heritage (incubatingHeritage = true), bypassing
 * the regular HERITAGE_HATCH_RATE roll. Falls back to a regular fancy
 * egg + the deterministic per-(tx,ty,day) heritage roll otherwise.
 *
 * Snapshots the heritage roll for THIS egg at load time — the same
 * (hatchery position, today) always rolls the same heritage flag so
 * reload-scumming is harmless.
 */
export function loadEgg(
  hatchery: PlacedHatchery,
  player: { inventory: Record<string, number> },
  today: number,
): LoadOutcome {
  if (hatchery.pendingChicken) {
    return { kind: 'pending' };
  }
  if (hatchery.hatchOnDay >= today) {
    return { kind: 'busy', daysLeft: hatchery.hatchOnDay - today + 1 };
  }
  const haveBreeder = player.inventory[BREEDER_EGG_INVENTORY_KEY] ?? 0;
  const haveFancy = player.inventory[FANCY_EGG_INVENTORY_KEY] ?? 0;
  if (haveBreeder > 0) {
    player.inventory[BREEDER_EGG_INVENTORY_KEY] = haveBreeder - 1;
    hatchery.hatchOnDay = today + HATCH_DAYS - 1;
    hatchery.incubatingHeritage = true;
    return { kind: 'loaded', hatchOnDay: hatchery.hatchOnDay };
  }
  if (haveFancy <= 0) return { kind: 'no-egg' };
  player.inventory[FANCY_EGG_INVENTORY_KEY] = haveFancy - 1;
  hatchery.hatchOnDay = today + HATCH_DAYS - 1;
  hatchery.incubatingHeritage = rollHeritage(hatchery.tx, hatchery.ty, today);
  return { kind: 'loaded', hatchOnDay: hatchery.hatchOnDay };
}

/**
 * Deterministic heritage roll for an egg loaded at (tx, ty) on `day`.
 * Same inputs always return the same boolean — keeps reload-scumming
 * harmless and lets tests assert by computing the same hash.
 */
export function rollHeritage(tx: number, ty: number, day: number): boolean {
  // Cheap 32-bit avalanche over (tx, ty, day). Distinct multiplier from
  // pseudoRoll in coop.ts so the two streams don't correlate.
  let h = (tx | 0) * 1597334677 + (ty | 0) * 2147483647;
  h = (h ^ (h >>> 13)) * 374761393;
  h = (h ^ ((day | 0) * 668265263));
  h ^= h >>> 16;
  const r = (h >>> 0) / 4294967296;
  return r < HERITAGE_HATCH_RATE;
}

/** True if the hatchery has an egg currently in incubation on `today`. */
export function isIncubating(hatchery: PlacedHatchery, today: number): boolean {
  return hatchery.hatchOnDay >= today;
}

/** Days remaining until the egg hatches. -1 when empty/expired. */
export function daysUntilHatch(hatchery: PlacedHatchery, today: number): number {
  if (hatchery.hatchOnDay < today) return -1;
  return hatchery.hatchOnDay - today + 1;
}

/** Outcome bag per hatchery on a dawn tick. */
export type HatchOutcome =
  | { kind: 'none' }
  | { kind: 'hatched-into-coop'; coop: PlacedCoop; heritage: boolean }
  | { kind: 'hatched-no-room'; heritage: boolean };

/**
 * Day-rollover hook. Walk every hatchery; for any whose hatchOnDay is
 * less than today AND that still has an active egg (hatchOnDay >= 0),
 * fire a hatch:
 *   - find the closest coop with a free chicken slot;
 *   - on success: addChicken(coop, heritage), reset hatchOnDay to -1;
 *   - on failure: leave hatchOnDay at -1 but flag pendingChicken so the
 *     player has to clear a coop before another egg can incubate. The
 *     heritage flag is preserved on pendingHeritage so claim time still
 *     hands the right breed into the coop.
 *
 * Returns the array of outcomes (one per hatchery, in stored order).
 */
export function hatcheryTick(world: World, today: number): HatchOutcome[] {
  const outcomes: HatchOutcome[] = [];
  for (const h of getHatcheries(world)) {
    if (h.hatchOnDay < 0) {
      outcomes.push({ kind: 'none' });
      continue;
    }
    if (h.hatchOnDay >= today) {
      // Still incubating.
      outcomes.push({ kind: 'none' });
      continue;
    }
    // Hatch fired today.
    const heritage = Boolean(h.incubatingHeritage);
    const coop = closestFreeCoop(world, h.tx, h.ty);
    if (coop) {
      addChicken(coop, heritage);
      h.hatchOnDay = -1;
      h.pendingChicken = false;
      h.pendingHeritage = false;
      h.incubatingHeritage = false;
      outcomes.push({ kind: 'hatched-into-coop', coop, heritage });
    } else {
      h.hatchOnDay = -1;
      h.pendingChicken = true;
      h.pendingHeritage = heritage;
      h.incubatingHeritage = false;
      outcomes.push({ kind: 'hatched-no-room', heritage });
    }
  }
  return outcomes;
}

/**
 * Move the pending chicken from the hatchery into the closest coop
 * with a free slot. Used when the player frees up a coop and walks back
 * to the hatchery. Returns the coop or null when still full.
 */
export function claimPendingChicken(
  world: World,
  hatchery: PlacedHatchery,
): PlacedCoop | null {
  if (!hatchery.pendingChicken) return null;
  const coop = closestFreeCoop(world, hatchery.tx, hatchery.ty);
  if (!coop) return null;
  addChicken(coop, Boolean(hatchery.pendingHeritage));
  hatchery.pendingChicken = false;
  hatchery.pendingHeritage = false;
  return coop;
}

function closestFreeCoop(
  world: World,
  tx: number,
  ty: number,
): PlacedCoop | undefined {
  let best: PlacedCoop | undefined;
  let bestDist = Infinity;
  for (const c of getCoops(world)) {
    if (c.chickens >= MAX_CHICKENS_PER_COOP) continue;
    const cx = c.tx + 1;
    const cy = c.ty + 1;
    const d = Math.hypot(cx - tx, cy - ty);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/** Status line for the HUD toast when the player walks up to the hatchery. */
export function hatcheryStatusLine(h: PlacedHatchery, today: number): string {
  if (h.pendingChicken) {
    const breed = h.pendingHeritage ? 'heritage chick' : 'chick';
    return `A ${breed} is waiting here — clear a coop slot first.`;
  }
  if (h.hatchOnDay < 0) {
    return `Hatchery is empty. Load a fancy egg to start a ${HATCH_DAYS}-day cycle.`;
  }
  const left = daysUntilHatch(h, today);
  const breedHint = h.incubatingHeritage ? ' (heritage)' : '';
  return `Hatchery: ${left} day${left === 1 ? '' : 's'} until hatch${breedHint}.`;
}

// ---------------------------------------------------------------------
// Procedural sprite
// ---------------------------------------------------------------------

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, w), Math.max(1, h));
}

/**
 * Draw a 1-tile hatchery sprite centered at (cx, cy). A small woven
 * basket with a warm-glow inside and a tiny egg silhouette when the
 * basket holds an egg. A chick silhouette appears when a hatched
 * chicken is waiting to be moved into a coop.
 */
export function drawHatcherySprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hatchery: PlacedHatchery,
  today: number,
  tileSize: number,
): void {
  const w = tileSize;
  const h = tileSize;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 3, y + h - 3, w - 6, 3);
  // Basket bowl — chunky woven base.
  px(ctx, x + 3, y + h * 0.5, w - 6, h * 0.4, '#8E5A30');
  // Weave stripes.
  for (let i = 0; i < 3; i++) {
    px(ctx, x + 3, y + h * 0.55 + i * 4, w - 6, 1, '#5A3818');
  }
  // Warm interior glow.
  px(ctx, x + 5, y + h * 0.46, w - 10, 4, '#F8C97A');
  // Egg or chick on top.
  const incubating = hatchery.hatchOnDay >= today;
  if (hatchery.pendingChicken) {
    // Small chick — peeking from the basket.
    px(ctx, x + w / 2 - 3, y + h * 0.38, 6, 5, '#FFE8A0');
    px(ctx, x + w / 2 + 1, y + h * 0.42, 1, 1, '#1A1426');
    px(ctx, x + w / 2 - 4, y + h * 0.43, 1, 1, '#F0A828');
  } else if (incubating) {
    // Egg silhouette — pale white oval.
    px(ctx, x + w / 2 - 2, y + h * 0.42, 4, 5, '#F5E9D4');
    px(ctx, x + w / 2 - 1, y + h * 0.40, 2, 1, '#F5E9D4');
  }
}
