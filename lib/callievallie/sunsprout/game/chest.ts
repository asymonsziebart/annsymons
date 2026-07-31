// Cellar storage chest — placeable bag the player uses to off-load
// inventory items they don't need in the hotbar.
//
// One free chest comes built into the farmhouse cellar and lives at a
// fixed tile near the south of the farmhouse footprint. Additional
// chests are buyable as a kit (`X` to place onto any grass tile the
// player faces). Every chest is its OWN inventory map; opening one
// shows that chest's contents alongside the player's bag and supports
// deposit / withdraw transfers.
//
// API stays pure: open/close UI lives in src/ui/chest-menu.ts; the
// model here exposes typed mutators (deposit, withdraw, contents).

import type { Player, World } from '../world/world';

/** Inventory key for a chest kit in the player's bag. */
export const CHEST_INVENTORY_KEY = 'chest-kit';
/** Gold cost of a chest kit at Vallie's shop. */
export const CHEST_PRICE = 300;

/** One placed chest in the world. */
export interface PlacedChest {
  /** Unique id (so multiple chests don't clash). */
  id: string;
  /** Tile-space coords (single tile footprint). */
  tx: number;
  ty: number;
  /** Per-item count. Keys are arbitrary inventory keys. */
  items: Record<string, number>;
}

/** Lazy chest list on the World. */
export interface WorldWithChests {
  chests?: PlacedChest[];
}

export function getChests(world: World): PlacedChest[] {
  const w = world as World & WorldWithChests;
  if (!w.chests) w.chests = [];
  return w.chests;
}

/** True if (tx,ty) sits on a chest. */
export function chestAt(world: World, tx: number, ty: number): PlacedChest | undefined {
  return getChests(world).find((c) => c.tx === tx && c.ty === ty);
}

/** True if a chest is adjacent (Chebyshev radius 1) to (tx,ty). */
export function adjacentChest(world: World, tx: number, ty: number): PlacedChest | undefined {
  for (const c of getChests(world)) {
    if (Math.abs(c.tx - tx) <= 1 && Math.abs(c.ty - ty) <= 1) return c;
  }
  return undefined;
}

/** Returns true if the player can place a chest at (tx, ty). */
export function canPlaceChest(world: World, tx: number, ty: number): boolean {
  if (!world.inBounds(tx, ty)) return false;
  const t = world.tiles[ty][tx];
  if (t.type !== 'grass') return false;
  // No building overlap.
  for (const b of world.buildings) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return false;
  }
  // No double-stacked chest.
  if (chestAt(world, tx, ty)) return false;
  return true;
}

/** Place a chest at (tx, ty). Returns the new chest or null on a blocked spot. */
export function placeChest(world: World, tx: number, ty: number): PlacedChest | null {
  if (!canPlaceChest(world, tx, ty)) return null;
  const id = `chest-${tx}-${ty}-${getChests(world).length}`;
  const chest: PlacedChest = { id, tx, ty, items: {} };
  getChests(world).push(chest);
  return chest;
}

/**
 * Bootstrap the starter cellar chest at the south edge of the farmhouse.
 * Idempotent — call once on world init or first chest interaction.
 */
export function ensureStarterChest(world: World): PlacedChest {
  const fh = world.buildings.find((b) => b.kind === 'farmhouse');
  // Pick a deterministic spot just south of the farmhouse footprint.
  const tx = fh ? fh.x + 1 : 14;
  const ty = fh ? fh.y + fh.h : 21;
  const existing = chestAt(world, tx, ty);
  if (existing) return existing;
  const chest: PlacedChest = { id: 'cellar', tx, ty, items: {} };
  getChests(world).push(chest);
  return chest;
}

/**
 * Move `count` of `key` from the player's bag into the chest. Returns
 * the actual count moved (clamped to what the player has).
 */
export function depositItem(
  chest: PlacedChest,
  player: Player,
  key: string,
  count: number,
): number {
  const have = player.inventory[key] ?? 0;
  const move = Math.max(0, Math.min(have, count));
  if (move === 0) return 0;
  player.inventory[key] = have - move;
  chest.items[key] = (chest.items[key] ?? 0) + move;
  return move;
}

/**
 * Move `count` of `key` from the chest back to the player. Returns the
 * actual count moved.
 */
export function withdrawItem(
  chest: PlacedChest,
  player: Player,
  key: string,
  count: number,
): number {
  const have = chest.items[key] ?? 0;
  const move = Math.max(0, Math.min(have, count));
  if (move === 0) return 0;
  chest.items[key] = have - move;
  player.inventory[key] = (player.inventory[key] ?? 0) + move;
  return move;
}

/** Sorted list of (key, count) pairs in the chest, for the UI panel. */
export function listChestItems(chest: PlacedChest): Array<{ key: string; count: number }> {
  return Object.entries(chest.items)
    .filter(([, v]) => v > 0)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Sum of all items in a chest (display only). */
export function chestTotal(chest: PlacedChest): number {
  let n = 0;
  for (const v of Object.values(chest.items)) n += v;
  return n;
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

/** Draws a single chest sprite at (cx, cy), where (cx, cy) is the centre. */
export function drawChestSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  // 14x12 ish wooden chest with a brass band + lock.
  const wood = '#7A5630';
  const woodDark = '#503820';
  const brass = '#C19A4A';
  const brassDark = '#8A6A2C';
  const x = cx - 7;
  const y = cy - 5;
  // Body
  px(ctx, x, y + 1, 14, 9, wood);
  // Lid
  px(ctx, x, y - 2, 14, 4, wood);
  // Top trim
  px(ctx, x, y + 1, 14, 1, woodDark);
  // Bottom trim
  px(ctx, x, y + 9, 14, 1, woodDark);
  // Brass band
  px(ctx, x, y + 4, 14, 1, brass);
  // Lock plate
  px(ctx, x + 6, y + 3, 3, 3, brass);
  px(ctx, x + 7, y + 4, 1, 1, brassDark);
  // Side highlights
  px(ctx, x, y - 2, 1, 12, woodDark);
  px(ctx, x + 13, y - 2, 1, 12, woodDark);
}
