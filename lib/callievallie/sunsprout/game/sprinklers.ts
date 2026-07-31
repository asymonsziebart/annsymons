// Sprinklers — placeable automation that waters the four neighbouring
// tiles at day rollover, lifting the morning watering chore off the
// player's hands once they earn enough to buy one.
//
// Module design mirrors fishing.ts / mining.ts / hearts.ts: a static
// catalog (SPRINKLERS), a pure state list living on the World, plus
// small mutators (placeSprinkler / removeSprinkler / sprinklerTick).
// Wiring later: a hotbar slot to place from, an `O` keybind to drop one
// on the tile in front of the player, and a procedural pixel sprite
// drawn by the renderer.
//
// A sprinkler occupies a single tilled tile (so it lives on a farm row,
// not in the grass). It waters the four orthogonal neighbours every
// time the world rolls to a new day — same as the player walking by
// with a watering can. Multiple sprinklers stack their footprints; a
// 2x2 lattice covers 12 tiles from 4 sprinklers, plenty for a small
// farm setup.

import type { World, Tile } from '../world/world';
import type { FarmCrop } from './farming';
import { cropAt } from './farming';

/** Identifier keys for the placeable irrigation items. */
export type SprinklerKey = 'basic';

export interface SprinklerDef {
  key: SprinklerKey;
  /** Human-readable label for the shop / HUD. */
  name: string;
  /** Gold to purchase one. */
  buyPrice: number;
  /** Hex colour of the procedural sprite head. */
  color: string;
  /** Orthogonal radius of the watered cross (1 = 4 neighbours). */
  radius: number;
}

/** Catalog. Easy to add 'pressure' / 'iridium' tiers later. */
export const SPRINKLERS: Record<SprinklerKey, SprinklerDef> = {
  basic: {
    key: 'basic',
    name: 'Sprinkler',
    buyPrice: 350,
    color: '#5A8FD8',
    radius: 1,
  },
};

/** All keys in catalog order. */
export const SPRINKLER_KEYS: SprinklerKey[] = Object.keys(SPRINKLERS) as SprinklerKey[];

/** One placed sprinkler in the world. */
export interface PlacedSprinkler {
  /** Tile-space coordinates. */
  tx: number;
  ty: number;
  /** Which catalog key was placed. */
  kind: SprinklerKey;
}

/** Inventory key for a UNPLACED sprinkler in the player's bag. */
export function sprinklerInventoryKey(key: SprinklerKey): string {
  return `sprinkler-${key}`;
}

/** Augment the World shape — we attach `sprinklers` lazily. */
export interface WorldWithSprinklers {
  sprinklers?: PlacedSprinkler[];
}

/** Reads the world's sprinkler list, creating it on first access. */
export function getSprinklers(world: World): PlacedSprinkler[] {
  const w = world as World & WorldWithSprinklers;
  if (!w.sprinklers) w.sprinklers = [];
  return w.sprinklers;
}

/**
 * Place a sprinkler at (tx, ty). Requires the tile to be tilled, no
 * crop on it, and no sprinkler already at the same spot. Returns true
 * on success.
 */
export function placeSprinkler(
  world: World,
  tx: number,
  ty: number,
  kind: SprinklerKey,
): boolean {
  if (!world.inBounds(tx, ty)) return false;
  const tile: Tile = world.tiles[ty][tx];
  if (tile.type !== 'tilled') return false;
  // Don't drop on top of a crop — sprinkler head would crush it.
  if (cropAt(world, tx, ty)) return false;
  const list = getSprinklers(world);
  if (list.some((s) => s.tx === tx && s.ty === ty)) return false;
  list.push({ tx, ty, kind });
  return true;
}

/** Returns true if a sprinkler sits on (tx, ty). */
export function sprinklerAt(world: World, tx: number, ty: number): PlacedSprinkler | undefined {
  return getSprinklers(world).find((s) => s.tx === tx && s.ty === ty);
}

/** Removes the sprinkler at (tx, ty). Returns true if one was there. */
export function removeSprinkler(world: World, tx: number, ty: number): boolean {
  const list = getSprinklers(world);
  const idx = list.findIndex((s) => s.tx === tx && s.ty === ty);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

/** Cardinal neighbours of (tx, ty) within bounds. */
function neighborhood(
  world: World,
  cx: number,
  cy: number,
  radius: number,
): Array<{ tx: number; ty: number }> {
  const out: Array<{ tx: number; ty: number }> = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      // Cross shape (orthogonal only) so a basic sprinkler waters 4 tiles
      // rather than 8 — keeps the catalog progression meaningful.
      if (dx !== 0 && dy !== 0) continue;
      const tx = cx + dx;
      const ty = cy + dy;
      if (!world.inBounds(tx, ty)) continue;
      out.push({ tx, ty });
    }
  }
  return out;
}

/**
 * Per-day rollover: every sprinkler waters its neighbouring crops. Call
 * BEFORE advanceDay() (the same hook as applyRain) so the watering
 * counts toward the growth tick that's about to fire.
 *
 * Returns the number of crops actually watered (useful for HUD toasts).
 */
export function sprinklerTick(world: World): number {
  let watered = 0;
  const list = getSprinklers(world);
  for (const s of list) {
    const def = SPRINKLERS[s.kind];
    for (const n of neighborhood(world, s.tx, s.ty, def.radius)) {
      const c = cropAt(world, n.tx, n.ty);
      if (!c) continue;
      const farmCrop = c as unknown as FarmCrop;
      if (!farmCrop.watered) {
        farmCrop.watered = true;
        farmCrop.daysSinceWater = 0;
        watered++;
      }
    }
  }
  return watered;
}

// ---------------------------------------------------------------------
// Procedural sprite
// ---------------------------------------------------------------------

/**
 * Draws a single sprinkler at (x, y), where (x, y) is the CENTRE of the
 * sprite (matching drawCropSprite's centre-bottom convention adjusted by
 * the caller). A small post + a colored head + four blue droplet pixels
 * showing the spray pattern. ~14x14 px on screen.
 */
export function drawSprinklerSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: SprinklerKey,
): void {
  const def = SPRINKLERS[kind];
  const post = '#5A4030';
  const droplet = '#7BB3DA';
  // Post.
  px(ctx, x, y - 1, 2, 5, post);
  // Head.
  px(ctx, x - 3, y - 4, 8, 3, def.color);
  // Cap.
  px(ctx, x - 1, y - 6, 4, 2, '#1A1426');
  // Spray droplets — four diagonal pixels.
  px(ctx, x - 6, y - 3, 1, 1, droplet);
  px(ctx, x + 6, y - 3, 1, 1, droplet);
  px(ctx, x, y - 9, 1, 1, droplet);
  px(ctx, x, y + 4, 1, 1, droplet);
}

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
