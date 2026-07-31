// Forage spawns — wild berries / mushrooms / herbs that bloom on grass
// each morning and vanish at dusk. They are pickable for cheap gold and
// will double as cooking ingredients in later recipes.
//
// Design mirrors sprinklers.ts / weather.ts: a catalog + a pure list
// hanging off the World, regenerated deterministically per (season, day)
// so the same calendar slot always spawns the same forage layout for a
// given save. That keeps the world feeling predictable without locking
// the player into one playstyle.
//
// Spawn rules:
//   - Only on plain `grass` tiles (never on path / water / tilled / stone).
//   - Never on a tile that already holds a placed sprinkler or coop.
//   - Daily cap so the screen never feels littered.
//   - Vanish after dusk (>= hour 19), to give the day a rhythm.

import type { World, Tile } from '../world/world';

export type ForageKind = 'berry' | 'mushroom' | 'herb';

export interface ForageDef {
  key: ForageKind;
  /** Human-readable label for HUD toasts. */
  name: string;
  /** Hex colour of the procedural sprite cap / berry. */
  color: string;
  /** Gold earned per unit at the well. */
  sellPrice: number;
  /** Catalog spawn weight — higher = more likely to roll. */
  weight: number;
}

export const FORAGE: Record<ForageKind, ForageDef> = {
  berry: { key: 'berry', name: 'Wild Berry', color: '#C8324A', sellPrice: 6, weight: 5 },
  mushroom: { key: 'mushroom', name: 'Forest Mushroom', color: '#D8A472', sellPrice: 9, weight: 3 },
  herb: { key: 'herb', name: 'Sage Sprig', color: '#7BCB6A', sellPrice: 4, weight: 4 },
};

export const FORAGE_KEYS: ForageKind[] = ['berry', 'mushroom', 'herb'];

/** Inventory key for a picked-up forage item. */
export function forageInventoryKey(kind: ForageKind): string {
  return `forage-${kind}`;
}

/** One forage item placed in the world. */
export interface PlacedForage {
  tx: number;
  ty: number;
  kind: ForageKind;
  /** Calendar day the item spawned — used to detect stale forage. */
  spawnedDay: number;
}

export interface WorldWithForage {
  forage?: PlacedForage[];
  /** Last (season,day) we regenerated for. Encoded as season*100+day. */
  forageDayKey?: number;
}

/** Reads the world's forage list, lazy-init on first access. */
export function getForage(world: World): PlacedForage[] {
  const w = world as World & WorldWithForage;
  if (!w.forage) w.forage = [];
  return w.forage;
}

/** Internal helper: deterministic 0..1 hash. */
function hash01(seed: number): number {
  let h = (seed * 2654435761) ^ 0x9E3779B9;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

/** Pick a forage kind from the weighted catalog. */
function pickKind(r: number): ForageKind {
  const total = FORAGE_KEYS.reduce((a, k) => a + FORAGE[k].weight, 0);
  let cum = 0;
  const target = r * total;
  for (const k of FORAGE_KEYS) {
    cum += FORAGE[k].weight;
    if (target < cum) return k;
  }
  return 'berry';
}

/** True when (tx,ty) is a fresh grass tile we can drop forage on. */
function eligibleTile(world: World, tx: number, ty: number): boolean {
  if (!world.inBounds(tx, ty)) return false;
  const t: Tile = world.tiles[ty][tx];
  if (t.type !== 'grass') return false;
  // Don't stack on existing forage.
  if (forageAt(world, tx, ty)) return false;
  return true;
}

/**
 * Regenerate the day's forage. Deterministic per (season,day). Called by
 * the day-rollover hook. Returns the number of items spawned.
 */
export function regenerateForage(
  world: World,
  season: 0 | 1 | 2 | 3,
  day: number,
): number {
  const list = getForage(world);
  // Clear yesterday's items.
  list.length = 0;
  const w = world as World & WorldWithForage;
  w.forageDayKey = season * 100 + day;
  // 6-10 items per morning, biased by season (more in spring/fall).
  const baseCount = 6 + Math.floor(hash01(season * 7919 + day * 31) * 5);
  let placed = 0;
  let attempts = 0;
  // Each placement gets up to ~30 attempts to find a fresh grass tile.
  while (placed < baseCount && attempts < baseCount * 30) {
    const r1 = hash01(season * 13 + day * 257 + attempts * 991);
    const r2 = hash01(season * 47 + day * 113 + attempts * 1009);
    const r3 = hash01(season * 89 + day * 47 + attempts * 743);
    const tx = Math.floor(r1 * world.width);
    const ty = Math.floor(r2 * world.height);
    attempts++;
    if (!eligibleTile(world, tx, ty)) continue;
    const kind = pickKind(r3);
    list.push({ tx, ty, kind, spawnedDay: day });
    placed++;
  }
  return placed;
}

/** Look up a forage item at (tx,ty). */
export function forageAt(world: World, tx: number, ty: number): PlacedForage | undefined {
  return getForage(world).find((f) => f.tx === tx && f.ty === ty);
}

/** Remove every forage item from the world (used at dusk). */
export function clearForage(world: World): number {
  const list = getForage(world);
  const n = list.length;
  list.length = 0;
  return n;
}

/**
 * Pick up the forage at (tx,ty). Adds one to `forage-<kind>` in the
 * player's inventory and removes it from the world. Returns the kind
 * picked up, or null when nothing was there.
 */
export function pickupForage(
  world: World,
  player: { inventory: Record<string, number> },
  tx: number,
  ty: number,
): ForageKind | null {
  const list = getForage(world);
  const idx = list.findIndex((f) => f.tx === tx && f.ty === ty);
  if (idx === -1) return null;
  const f = list[idx];
  list.splice(idx, 1);
  const key = forageInventoryKey(f.kind);
  player.inventory[key] = (player.inventory[key] ?? 0) + 1;
  return f.kind;
}

/** True when the in-game time has crossed into dusk and forage should vanish. */
export function isDusk(hour: number): boolean {
  return hour >= 19;
}

/** Sells every forage item in the player's inventory. Returns gold earned. */
export function sellAllForage(player: { inventory: Record<string, number>; gold: number }): number {
  let earned = 0;
  for (const k of FORAGE_KEYS) {
    const invKey = forageInventoryKey(k);
    const have = player.inventory[invKey] ?? 0;
    if (have <= 0) continue;
    earned += have * FORAGE[k].sellPrice;
    player.inventory[invKey] = 0;
  }
  player.gold += earned;
  return earned;
}

// ---------------------------------------------------------------------
// Procedural sprite
// ---------------------------------------------------------------------

/** Tiny single-pixel rect helper. */
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
 * Draws one forage item centred at (x,y). Each kind is a recognisable
 * miniature: berries are a red cluster, mushrooms have a cap + stem,
 * herbs are a pair of green sprigs. Matches the cozy pixel language
 * of crops.ts / sprinklers.ts.
 */
export function drawForageSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: ForageKind,
): void {
  const def = FORAGE[kind];
  switch (kind) {
    case 'berry': {
      // Three small dark-red berries on a green leaf.
      px(ctx, x - 3, y - 1, 6, 2, '#3A7A2E');
      px(ctx, x - 2, y - 3, 2, 2, def.color);
      px(ctx, x + 1, y - 3, 2, 2, def.color);
      px(ctx, x - 1, y - 5, 2, 2, def.color);
      // Tiny highlight.
      px(ctx, x - 1, y - 4, 1, 1, '#F0B0C0');
      break;
    }
    case 'mushroom': {
      // Cap + stem.
      px(ctx, x - 1, y - 1, 2, 3, '#F0E0CA'); // stem
      px(ctx, x - 3, y - 4, 6, 2, def.color); // cap
      px(ctx, x - 2, y - 5, 4, 1, def.color);
      // Dots on the cap.
      px(ctx, x - 1, y - 4, 1, 1, '#FFF1B0');
      px(ctx, x + 1, y - 3, 1, 1, '#FFF1B0');
      break;
    }
    case 'herb': {
      // Two leafy sprigs.
      px(ctx, x - 2, y - 2, 1, 3, def.color);
      px(ctx, x + 1, y - 2, 1, 3, def.color);
      px(ctx, x - 3, y - 4, 3, 1, def.color);
      px(ctx, x + 1, y - 4, 3, 1, def.color);
      px(ctx, x, y - 1, 1, 2, '#3A7A2E');
      break;
    }
  }
}
