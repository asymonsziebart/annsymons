// Scarecrow — placeable that nudges crop quality up one tier at harvest.
//
// Built at the carpenter's bench (recipe `craft-scarecrow`, 300g + 1
// iron). Placed onto a grass tile next to the farm via the K-keybind
// (key was claimed by manual save once; we reuse `K` -> manual save
// AND `0` (digit-zero) -> place scarecrow because letter keys are
// gone). After review: keyboard is too crowded. We re-use `,`-style
// pattern? No — those are tool upgrades. We pick the `0` (digit zero)
// hotbar slot which is currently unused (hotbar selects via 1-9, 5
// reads as middle slot).
//
// Actually all digits 1-9 + 5 are claimed. The 0 digit is free. So:
// `0` (digit zero, with shift produces `)`) is too easy to misfire.
//
// Final decision: place via 'P' is free? P is used for harvest hint
// in some loops. Let's check by grepping. {} are open. Use '{' to
// place the scarecrow (it sits next to '}' which is the natural
// next-to brackets pair the future panel cycler can swap). This
// matches the prompt's note in STATE.md about `{ } ~ ` keys being
// the remaining free chars.
//
// Once placed, each scarecrow watches a 3-tile Chebyshev radius. At
// harvest, scarecrowBoost() is consulted: if a scarecrow is in range
// it returns the bumped CropQuality (normal -> silver, silver -> gold,
// gold -> gold). farming.harvest() multiplies the streak-derived
// quality up by one tier before writing the bucket. Result: a
// well-watered crop has more elastic quality, and even a careless
// player gets occasional silvers within range. Each scarecrow only
// covers a small area so the player still has to layout them out.

import type { World, Tile } from '../world/world';
import type { CropQuality } from './crop-quality';

/** Inventory key under which an unplaced scarecrow lives. */
export const SCARECROW_INVENTORY_KEY = 'craft-scarecrow';

/** Chebyshev radius of the per-scarecrow quality boost. */
export const SCARECROW_RADIUS = 3;

/** A placed scarecrow on the world. */
export interface PlacedScarecrow {
  tx: number;
  ty: number;
}

/** Augment the World shape — `scarecrows` is attached lazily. */
export interface WorldWithScarecrows {
  scarecrows?: PlacedScarecrow[];
}

/** Read the world's scarecrow list, creating it on first access. */
export function getScarecrows(world: World): PlacedScarecrow[] {
  const w = world as World & WorldWithScarecrows;
  if (!w.scarecrows) w.scarecrows = [];
  return w.scarecrows;
}

/** Returns the scarecrow on (tx, ty) if any. */
export function scarecrowAt(world: World, tx: number, ty: number): PlacedScarecrow | undefined {
  return getScarecrows(world).find((s) => s.tx === tx && s.ty === ty);
}

/**
 * Place a scarecrow at (tx, ty). Requires the tile to be grass (so
 * we don't displace tilled soil), no crop on it, and no scarecrow
 * already there. Returns true on success.
 */
export function placeScarecrow(world: World, tx: number, ty: number): boolean {
  if (!world.inBounds(tx, ty)) return false;
  const tile: Tile = world.tiles[ty][tx];
  if (tile.type !== 'grass') return false;
  // Don't allow stacking on an existing placeable. The world doesn't
  // expose a unified "occupant?" predicate so we just guard against
  // our own list — sprinklers live on tilled tiles, so scarecrows on
  // grass tiles never overlap them in practice.
  const list = getScarecrows(world);
  if (list.some((s) => s.tx === tx && s.ty === ty)) return false;
  list.push({ tx, ty });
  return true;
}

/** Remove the scarecrow at (tx, ty). Returns true if one was there. */
export function removeScarecrow(world: World, tx: number, ty: number): boolean {
  const list = getScarecrows(world);
  const idx = list.findIndex((s) => s.tx === tx && s.ty === ty);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

/** True iff a scarecrow covers (tx, ty) within SCARECROW_RADIUS. */
export function isCovered(world: World, tx: number, ty: number): boolean {
  for (const s of getScarecrows(world)) {
    if (Math.abs(s.tx - tx) <= SCARECROW_RADIUS && Math.abs(s.ty - ty) <= SCARECROW_RADIUS) {
      return true;
    }
  }
  return false;
}

/**
 * Bump a CropQuality up one tier if (tx, ty) is covered by any
 * scarecrow. Returns the input quality unchanged when no scarecrow
 * is in range. gold stays gold (no tier above).
 */
export function scarecrowBoost(
  world: World,
  tx: number,
  ty: number,
  quality: CropQuality,
): CropQuality {
  if (!isCovered(world, tx, ty)) return quality;
  if (quality === 'normal') return 'silver';
  if (quality === 'silver') return 'gold';
  return 'gold';
}

// ---------------------------------------------------------------------
// Procedural sprite
// ---------------------------------------------------------------------

/**
 * Draws a small scarecrow at (x, y). About 14x18 px on screen — a
 * brown cross, a straw-yellow head with a darker hat brim, two
 * stick arms. Centered on (x, y) so the renderer feeds tile centres.
 */
export function drawScarecrowSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  const stake = '#5C4530';
  const straw = '#E0C76E';
  const hat = '#3A2A1A';
  const shirt = '#7A3A4A';
  const shirtDark = '#5A2A38';

  // Vertical stake.
  px(ctx, x, y - 2, 2, 8, stake);
  // Horizontal cross-arm (sticks out either side).
  px(ctx, x - 4, y - 4, 10, 2, stake);

  // Tunic — a tiny shirt draped over the cross.
  px(ctx, x - 3, y - 2, 8, 5, shirt);
  px(ctx, x - 3, y + 1, 8, 2, shirtDark);

  // Head — yellow straw ball.
  px(ctx, x - 2, y - 8, 6, 4, straw);
  px(ctx, x - 3, y - 7, 1, 2, straw);
  px(ctx, x + 4, y - 7, 1, 2, straw);

  // Hat — brim + cone.
  px(ctx, x - 3, y - 9, 8, 1, hat);
  px(ctx, x - 1, y - 12, 4, 3, hat);

  // Eye stitches — two single dark pixels on the head.
  px(ctx, x - 1, y - 6, 1, 1, '#1a1426');
  px(ctx, x + 2, y - 6, 1, 1, '#1a1426');
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
