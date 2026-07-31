// Greenhouse — late-game building that auto-waters its tiles and
// accelerates crop growth.
//
// You buy a Greenhouse Kit (1800g) from Vallie and place it onto a
// GREENHOUSE_W x GREENHOUSE_H grass footprint with the H keybind.
// Every tile inside the greenhouse footprint becomes tilled soil
// automatically. At day rollover:
//   1. Every crop inside is set to watered=true and daysSinceWater=0.
//   2. Every watered crop inside ALSO grows an extra stage on top of
//      the standard advanceDay() tick — so a wheat crop that normally
//      takes 2 days to ripen finishes in 1. (Capped at growthStages-1.)
//
// The greenhouse never blocks the player from walking inside — the
// tiles stay walkable like normal tilled soil. The glass roof + steel
// trim sprite makes the footprint legible from a distance.

import type { World } from '../world/world';
import type { FarmCrop } from './farming';
import { cropAt } from './farming';
import { CROPS } from './crops';

/** Inventory key for an unplaced greenhouse kit. */
export const GREENHOUSE_INVENTORY_KEY = 'greenhouse-kit';

/** Gold cost of a kit at Vallie's shop. */
export const GREENHOUSE_PRICE = 1800;

/** Footprint of one greenhouse, in tiles. */
export const GREENHOUSE_W = 3;
export const GREENHOUSE_H = 3;

/** Extra stages of growth applied per day to every watered crop inside. */
export const GREENHOUSE_GROWTH_BONUS = 1;

/** One placed greenhouse. */
export interface PlacedGreenhouse {
  /** Tile-space top-left corner. */
  tx: number;
  ty: number;
}

export interface WorldWithGreenhouses {
  greenhouses?: PlacedGreenhouse[];
}

/** Lazy reader. */
export function getGreenhouses(world: World): PlacedGreenhouse[] {
  const w = world as World & WorldWithGreenhouses;
  if (!w.greenhouses) w.greenhouses = [];
  return w.greenhouses;
}

/** True when a clear GREENHOUSE_W x GREENHOUSE_H grass footprint sits at (tx,ty). */
export function canPlaceGreenhouse(world: World, tx: number, ty: number): boolean {
  for (let dy = 0; dy < GREENHOUSE_H; dy++) {
    for (let dx = 0; dx < GREENHOUSE_W; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!world.inBounds(x, y)) return false;
      const t = world.tiles[y][x];
      if (t.type !== 'grass') return false;
      // No building overlap.
      for (const b of world.buildings) {
        if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return false;
      }
    }
  }
  // No overlapping greenhouse already.
  for (const g of getGreenhouses(world)) {
    if (overlaps(g, { tx, ty })) return false;
  }
  return true;
}

function overlaps(a: PlacedGreenhouse, b: { tx: number; ty: number }): boolean {
  return (
    a.tx < b.tx + GREENHOUSE_W &&
    a.tx + GREENHOUSE_W > b.tx &&
    a.ty < b.ty + GREENHOUSE_H &&
    a.ty + GREENHOUSE_H > b.ty
  );
}

/**
 * Place a greenhouse. On success every tile in its footprint is
 * converted to tilled soil so the player can plant immediately, and
 * the new PlacedGreenhouse is returned. Returns null on a blocked
 * footprint.
 */
export function placeGreenhouse(
  world: World,
  tx: number,
  ty: number,
): PlacedGreenhouse | null {
  if (!canPlaceGreenhouse(world, tx, ty)) return null;
  for (let dy = 0; dy < GREENHOUSE_H; dy++) {
    for (let dx = 0; dx < GREENHOUSE_W; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      const tile = world.tiles[y][x];
      world.tiles[y][x] = { type: 'tilled', variant: tile.variant };
    }
  }
  const g: PlacedGreenhouse = { tx, ty };
  getGreenhouses(world).push(g);
  return g;
}

/** True when (tx,ty) is inside the footprint of any greenhouse. */
export function isInsideGreenhouse(world: World, tx: number, ty: number): boolean {
  for (const g of getGreenhouses(world)) {
    if (tx >= g.tx && tx < g.tx + GREENHOUSE_W && ty >= g.ty && ty < g.ty + GREENHOUSE_H) {
      return true;
    }
  }
  return false;
}

/**
 * Per-day rollover hook. Water + bonus-grow every crop inside every
 * greenhouse. Call AFTER advanceDay so the bonus stage applies on
 * top of the standard tick (crops always grow by one when watered;
 * the greenhouse adds GREENHOUSE_GROWTH_BONUS extra stages).
 *
 * Returns the number of crops that benefited from the bonus growth
 * (useful for HUD toasts).
 */
export function greenhouseTick(world: World): number {
  let bumped = 0;
  for (const g of getGreenhouses(world)) {
    for (let dy = 0; dy < GREENHOUSE_H; dy++) {
      for (let dx = 0; dx < GREENHOUSE_W; dx++) {
        const tx = g.tx + dx;
        const ty = g.ty + dy;
        const c = cropAt(world, tx, ty);
        if (!c) continue;
        const farm = c as FarmCrop;
        // First make sure the crop is watered for tomorrow's tick.
        farm.watered = true;
        farm.daysSinceWater = 0;
        // Bonus growth on top of the regular advanceDay (which already
        // ran when this is called).
        const catalog = CROPS[farm.crop];
        if (!catalog) continue;
        const maxStage = catalog.growthStages - 1;
        if (farm.stage < maxStage) {
          const target = Math.min(maxStage, farm.stage + GREENHOUSE_GROWTH_BONUS);
          if (target > farm.stage) {
            farm.stage = target;
            farm.growth = farm.stage;
            bumped++;
          }
        }
      }
    }
  }
  return bumped;
}

/** Total greenhouse-affected tiles in the world (for stats / quests). */
export function greenhouseTileCount(world: World): number {
  return getGreenhouses(world).length * GREENHOUSE_W * GREENHOUSE_H;
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
 * Draws the greenhouse frame on top of the world at the screen pixel
 * (cx, cy) — the centre of the footprint. We draw only the frame +
 * the translucent glass roof so the player can still see crops
 * inside. The renderer's tiled-soil layer paints the floor underneath.
 */
export function drawGreenhouseSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tileSize: number,
): void {
  const w = GREENHOUSE_W * tileSize;
  const h = GREENHOUSE_H * tileSize;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Glass roof — translucent so crops show through.
  ctx.fillStyle = 'rgba(180, 220, 240, 0.30)';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  // Steel frame — thin border lines.
  ctx.strokeStyle = '#5A6E80';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // Corner posts.
  for (const [px1, py1] of [
    [x, y],
    [x + w - 4, y],
    [x, y + h - 4],
    [x + w - 4, y + h - 4],
  ] as const) {
    px(ctx, px1, py1, 4, 4, '#3A4858');
  }
  // Glass cross-bars for that conservatory look.
  ctx.strokeStyle = 'rgba(90, 110, 128, 0.6)';
  ctx.lineWidth = 1;
  for (let i = 1; i < GREENHOUSE_W; i++) {
    const vx = x + i * tileSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(vx, y + 4);
    ctx.lineTo(vx, y + h - 4);
    ctx.stroke();
  }
  for (let j = 1; j < GREENHOUSE_H; j++) {
    const hy = y + j * tileSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, hy);
    ctx.lineTo(x + w - 4, hy);
    ctx.stroke();
  }
  // Door — front-centre, slightly darker so it reads as the entrance.
  const doorW = Math.floor(tileSize * 0.5);
  px(
    ctx,
    x + w / 2 - doorW / 2,
    y + h - 6,
    doorW,
    6,
    'rgba(58, 72, 88, 0.55)',
  );
}
