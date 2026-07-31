// Animal coop + chickens — buy a coop, raise chickens, collect eggs.
//
// The coop is a placeable structure that goes on grass next to the
// farmhouse (the player picks a spot, like a sprinkler). Inside the
// coop the player keeps up to MAX_CHICKENS_PER_COOP chickens; each
// chicken lays one egg at day rollover, dropped into the coop's
// internal eggs cache. A small per-chicken roll each morning replaces
// a plain egg with a "fancy egg" (sells for 3x). The fancy-roll rate
// depends on the coop's tier — a basic coop sees the occasional
// fancy egg, a deluxe coop sees them roughly twice as often.
//
// Collect eggs by standing next to the coop and pressing E (the
// existing "interact" key in game.ts). Eggs go into the player's
// inventory under the EGG_INVENTORY_KEY for the recipe / sell loops.
// Fancy eggs use a distinct FANCY_EGG_INVENTORY_KEY so the well /
// recipe loops can route them at the premium price.
//
// Pure module: no DOM, no rendering side effects in tick logic. A
// drawCoopSprite + drawChickenSprite helper paint the procedural art.

import type { World } from '../world/world';
import { coopFancyRate } from './animal-happiness';

/** Inventory key for a collected (standard) egg. */
export const EGG_INVENTORY_KEY = 'egg';

/** Inventory key for the rare 3x-priced "fancy" egg. */
export const FANCY_EGG_INVENTORY_KEY = 'egg-fancy';

/** Inventory key for an unplaced coop. */
export const COOP_INVENTORY_KEY = 'coop';

/** Gold cost of a coop kit from the shop. */
export const COOP_PRICE = 600;

/** Sell price of one egg at the well. */
export const EGG_SELL_PRICE = 12;

/** Sell price of one fancy egg at the well. 3x of the standard egg. */
export const FANCY_EGG_SELL_PRICE = EGG_SELL_PRICE * 3;

/** Sell price of one (sad) hen — used if the player wants to clear a coop. */
export const CHICKEN_SELL_PRICE = 80;

/** Buy price of a single chicken from Maple. */
export const CHICKEN_PRICE = 200;

/** Hard cap so a single coop can't run away with the day-rollover cost. */
export const MAX_CHICKENS_PER_COOP = 4;

/** Footprint of a coop in tiles (width x height). */
export const COOP_W = 2;
export const COOP_H = 2;

/** Coop quality tiers. */
export type CoopTier = 'basic' | 'deluxe';

/** Probability that a single chicken lays a fancy egg per day, per tier. */
export const FANCY_EGG_RATE: Record<CoopTier, number> = {
  basic: 0.08,
  deluxe: 0.18,
};

/** Gold cost of the deluxe upgrade kit at the carpenter's bench / shop. */
export const COOP_DELUXE_PRICE = 700;

/** One placed coop in the world. */
export interface PlacedCoop {
  /** Tile-space top-left coordinate. */
  tx: number;
  ty: number;
  /** Number of chickens currently inside. */
  chickens: number;
  /** Standard eggs sitting inside the coop, waiting to be collected. */
  eggs: number;
  /** Fancy eggs sitting inside the coop. Counted separately so the
   *  collect step can split them out into FANCY_EGG_INVENTORY_KEY. */
  fancyEggs?: number;
  /** Quality tier — drives the fancy-egg roll rate. Default 'basic'. */
  tier?: CoopTier;
  /**
   * Coop happiness 0..100. Petting / feeding / collecting eggs bumps
   * it; a one-point daily decay pulls it back down. Adds up to +6
   * percentage points to the fancy-egg roll when maxed.
   */
  happiness?: number;
  /** Day index of the last successful care bump. -1 / undefined = never. */
  lastCareDay?: number;
  /**
   * Per-chicken heritage flag. Heritage chickens roll fancy eggs at a
   * HERITAGE_FANCY_BONUS-higher base rate than their non-heritage
   * coopmates. Indices align with chicken slots [0..MAX_CHICKENS_PER_COOP).
   * Missing / undefined entries default to false. Persists in the save
   * snapshot via the coops blob.
   */
  heritage?: boolean[];
  /**
   * Breeder eggs sitting in the coop, waiting to be collected. Mints
   * only when the coop has >= HERITAGE_BREEDER_MIN_HERITAGE heritage
   * chickens AND a deterministic per-day roll passes. A breeder egg
   * routes into BREEDER_EGG_INVENTORY_KEY on collect and hatches as
   * a guaranteed heritage chick.
   */
  breederEggs?: number;
}

/** Per-chicken fancy-rate bump granted to a heritage chicken (additive). */
export const HERITAGE_FANCY_BONUS = 0.15;

/**
 * Probability that a coop with TWO OR MORE heritage chickens routes
 * one of its fancy eggs that morning into the BREEDER egg cache
 * instead. Deterministic per (coop position, day) so reload-scumming
 * is harmless.
 *
 * Tuned at 40% — when a coop is breeder-eligible, ~40% of dawns add
 * one breeder egg. A breeder egg loaded into the hatchery hatches a
 * guaranteed heritage chick (vs the regular 18% roll). Combined with
 * the per-chicken fancy roll, a pair of heritage chickens generates
 * roughly one breeder egg per week of in-game time.
 */
export const HERITAGE_BREEDER_RATE = 0.4;

/** Inventory key for an unhatched BREEDER fancy egg. */
export const BREEDER_EGG_INVENTORY_KEY = 'egg-breeder';

/** Heritage chickens required in a single coop to enable the breeder roll. */
export const HERITAGE_BREEDER_MIN_HERITAGE = 2;

export interface WorldWithCoops {
  coops?: PlacedCoop[];
}

/** Lazy-init reader. */
export function getCoops(world: World): PlacedCoop[] {
  const w = world as World & WorldWithCoops;
  if (!w.coops) w.coops = [];
  return w.coops;
}

/** True when (tx,ty) is a clear grass tile of the right footprint. */
export function canPlaceCoop(world: World, tx: number, ty: number): boolean {
  // Every tile in the footprint must be plain grass and not occupied
  // by an existing coop or building.
  for (let dy = 0; dy < COOP_H; dy++) {
    for (let dx = 0; dx < COOP_W; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (!world.inBounds(x, y)) return false;
      const t = world.tiles[y][x];
      if (t.type !== 'grass') return false;
      // Skip into a building?
      for (const b of world.buildings) {
        if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return false;
      }
    }
  }
  // No overlapping coop already.
  for (const c of getCoops(world)) {
    if (overlaps({ tx: c.tx, ty: c.ty }, { tx, ty })) return false;
  }
  return true;
}

function overlaps(
  a: { tx: number; ty: number },
  b: { tx: number; ty: number },
): boolean {
  return (
    a.tx < b.tx + COOP_W &&
    a.tx + COOP_W > b.tx &&
    a.ty < b.ty + COOP_H &&
    a.ty + COOP_H > b.ty
  );
}

/** Place a coop. Returns the new PlacedCoop or null when blocked. */
export function placeCoop(world: World, tx: number, ty: number): PlacedCoop | null {
  if (!canPlaceCoop(world, tx, ty)) return null;
  const coop: PlacedCoop = { tx, ty, chickens: 0, eggs: 0 };
  getCoops(world).push(coop);
  return coop;
}

/** Returns the coop whose footprint covers (tx,ty), or undefined. */
export function coopAt(world: World, tx: number, ty: number): PlacedCoop | undefined {
  for (const c of getCoops(world)) {
    if (tx >= c.tx && tx < c.tx + COOP_W && ty >= c.ty && ty < c.ty + COOP_H) {
      return c;
    }
  }
  return undefined;
}

/** True when (tx,ty) is orthogonally adjacent to any coop. */
export function isAdjacentToCoop(world: World, tx: number, ty: number): boolean {
  for (const c of getCoops(world)) {
    if (
      tx >= c.tx - 1 &&
      tx <= c.tx + COOP_W &&
      ty >= c.ty - 1 &&
      ty <= c.ty + COOP_H
    ) {
      // Exclude tiles already inside the footprint — adjacency only.
      const inside = tx >= c.tx && tx < c.tx + COOP_W && ty >= c.ty && ty < c.ty + COOP_H;
      if (!inside) return true;
    }
  }
  return false;
}

/** Returns the first coop next to (tx,ty), or undefined. */
export function adjacentCoop(world: World, tx: number, ty: number): PlacedCoop | undefined {
  for (const c of getCoops(world)) {
    if (
      tx >= c.tx - 1 &&
      tx <= c.tx + COOP_W &&
      ty >= c.ty - 1 &&
      ty <= c.ty + COOP_H
    ) {
      const inside = tx >= c.tx && tx < c.tx + COOP_W && ty >= c.ty && ty < c.ty + COOP_H;
      if (!inside) return c;
    }
  }
  return undefined;
}

/** Adds a chicken to `coop`. Returns true on success, false at cap.
 *
 * Pass `heritage=true` to mark the new slot as a heritage chicken —
 * its fancy-egg roll uses the higher rate. Default is non-heritage so
 * Vallie's regular chickens stay vanilla; only hatched chicks that
 * survived the heritage roll come in flagged.
 */
export function addChicken(coop: PlacedCoop, heritage: boolean = false): boolean {
  if (coop.chickens >= MAX_CHICKENS_PER_COOP) return false;
  if (!coop.heritage) coop.heritage = [];
  coop.heritage[coop.chickens] = heritage;
  coop.chickens += 1;
  return true;
}

/** True if the chicken at the given slot is a heritage breed. */
export function isHeritageChicken(coop: PlacedCoop, slot: number): boolean {
  return Boolean(coop.heritage && coop.heritage[slot]);
}

/** Total heritage chickens in this coop. */
export function heritageCount(coop: PlacedCoop): number {
  if (!coop.heritage) return 0;
  let n = 0;
  for (let i = 0; i < coop.chickens; i++) {
    if (coop.heritage[i]) n += 1;
  }
  return n;
}

/**
 * Day-rollover hook. Every chicken in every coop drops one egg into
 * its coop's eggs cache. With a per-tier probability, each chicken's
 * egg becomes a "fancy" egg instead — counted in coop.fancyEggs and
 * sold at the premium price. Returns the total egg count laid this
 * morning (standard + fancy summed).
 *
 * The fancy roll is deterministic per (coop position, day, chicken
 * index) so the same in-game day always produces the same outcome —
 * the player can't reload-scum it.
 *
 * Happiness factors into the rate via animal-happiness.coopFancyRate
 * — a thriving coop bumps fancy odds by up to +6 percentage points
 * on top of the tier base, lazily-loaded so older saves still work.
 *
 * Heritage chickens (coop.heritage[slot] === true) additionally get
 * HERITAGE_FANCY_BONUS percentage points on top of the per-coop rate.
 * A heritage chicken in a basic coop with 0 happiness already lays
 * fancy eggs ~23% of the time vs the regular 8%.
 */
export function coopTick(world: World, day: number = 0): number {
  let produced = 0;
  for (const c of getCoops(world)) {
    const tier: CoopTier = c.tier ?? 'basic';
    const baseRate = FANCY_EGG_RATE[tier];
    const rate = coopFancyRate(c, baseRate);
    let fancy = 0;
    let fancyFromHeritage = 0;
    for (let i = 0; i < c.chickens; i++) {
      // Per-chicken rate — heritage chickens get a flat +HERITAGE_FANCY_BONUS.
      const isHeritage = isHeritageChicken(c, i);
      const perChickenRate = isHeritage
        ? Math.min(1, rate + HERITAGE_FANCY_BONUS)
        : rate;
      // Hash (tx, ty, day, i) into a [0,1) roll.
      const r = pseudoRoll(c.tx, c.ty, day, i);
      if (r < perChickenRate) {
        fancy += 1;
        if (isHeritage) fancyFromHeritage += 1;
      }
    }
    // Breeder pass — eligible only when this coop has at least
    // HERITAGE_BREEDER_MIN_HERITAGE heritage chickens AND today's
    // batch already produced at least one fancy egg from a heritage
    // hen. Promotes one fancy egg to breeder. Roll uses a distinct
    // multiplier from pseudoRoll so the two streams don't correlate.
    let breeder = 0;
    if (heritageCount(c) >= HERITAGE_BREEDER_MIN_HERITAGE && fancyFromHeritage > 0) {
      const br = breederRoll(c.tx, c.ty, day);
      if (br < HERITAGE_BREEDER_RATE) {
        breeder = 1;
        fancy = Math.max(0, fancy - 1);
      }
    }
    const plain = c.chickens - fancy - breeder;
    c.eggs += Math.max(0, plain);
    c.fancyEggs = (c.fancyEggs ?? 0) + fancy;
    c.breederEggs = (c.breederEggs ?? 0) + breeder;
    produced += c.chickens;
  }
  return produced;
}

/** Distinct deterministic roll for the breeder gate. */
export function breederRoll(tx: number, ty: number, day: number): number {
  // Hash multipliers picked to be distinct from pseudoRoll() above so
  // breeder + per-chicken streams stay uncorrelated.
  let h = (tx | 0) * 1597334677 + (ty | 0) * 2147483647;
  h = (h ^ (h >>> 13)) * 668265263;
  h = (h ^ ((day | 0) * 374761393));
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Tiny deterministic 32-bit avalanche over (tx, ty, day, idx) -> [0,1). */
function pseudoRoll(tx: number, ty: number, day: number, idx: number): number {
  let h = (tx | 0) * 374761393 + (ty | 0) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ ((day | 0) * 2246822519));
  h = (h ^ (idx | 0) * 1013904223);
  h ^= h >>> 16;
  // >>> 0 forces unsigned; divide by 2^32 to land in [0,1).
  return (h >>> 0) / 4294967296;
}

/**
 * Collect every egg in `coop` (standard + fancy + breeder) into the
 * player's inventory. Returns the total collected.
 */
export function collectEggs(
  coop: PlacedCoop,
  player: { inventory: Record<string, number> },
): number {
  const plain = coop.eggs;
  const fancy = coop.fancyEggs ?? 0;
  const breeder = coop.breederEggs ?? 0;
  if (plain <= 0 && fancy <= 0 && breeder <= 0) return 0;
  coop.eggs = 0;
  coop.fancyEggs = 0;
  coop.breederEggs = 0;
  if (plain > 0) {
    player.inventory[EGG_INVENTORY_KEY] = (player.inventory[EGG_INVENTORY_KEY] ?? 0) + plain;
  }
  if (fancy > 0) {
    player.inventory[FANCY_EGG_INVENTORY_KEY] =
      (player.inventory[FANCY_EGG_INVENTORY_KEY] ?? 0) + fancy;
  }
  if (breeder > 0) {
    player.inventory[BREEDER_EGG_INVENTORY_KEY] =
      (player.inventory[BREEDER_EGG_INVENTORY_KEY] ?? 0) + breeder;
  }
  return plain + fancy + breeder;
}

/** Detailed collection result used by the toast layer. */
export function collectEggsDetailed(
  coop: PlacedCoop,
  player: { inventory: Record<string, number> },
): { plain: number; fancy: number; breeder: number } {
  const plain = coop.eggs;
  const fancy = coop.fancyEggs ?? 0;
  const breeder = coop.breederEggs ?? 0;
  coop.eggs = 0;
  coop.fancyEggs = 0;
  coop.breederEggs = 0;
  if (plain > 0) {
    player.inventory[EGG_INVENTORY_KEY] = (player.inventory[EGG_INVENTORY_KEY] ?? 0) + plain;
  }
  if (fancy > 0) {
    player.inventory[FANCY_EGG_INVENTORY_KEY] =
      (player.inventory[FANCY_EGG_INVENTORY_KEY] ?? 0) + fancy;
  }
  if (breeder > 0) {
    player.inventory[BREEDER_EGG_INVENTORY_KEY] =
      (player.inventory[BREEDER_EGG_INVENTORY_KEY] ?? 0) + breeder;
  }
  return { plain, fancy, breeder };
}

/** Upgrade a coop's tier. Returns true on success (tier actually changed). */
export function upgradeCoop(coop: PlacedCoop, next: CoopTier): boolean {
  if ((coop.tier ?? 'basic') === next) return false;
  coop.tier = next;
  return true;
}

/** Total egg count across every coop in the world (for stats / quests). */
export function totalEggsWaiting(world: World): number {
  let total = 0;
  for (const c of getCoops(world)) total += c.eggs + (c.fancyEggs ?? 0);
  return total;
}

/** Sells every egg in the player's inventory. Returns gold earned. */
export function sellAllEggs(player: { inventory: Record<string, number>; gold: number }): number {
  let earned = 0;
  const plain = player.inventory[EGG_INVENTORY_KEY] ?? 0;
  if (plain > 0) {
    earned += plain * EGG_SELL_PRICE;
    player.inventory[EGG_INVENTORY_KEY] = 0;
  }
  const fancy = player.inventory[FANCY_EGG_INVENTORY_KEY] ?? 0;
  if (fancy > 0) {
    earned += fancy * FANCY_EGG_SELL_PRICE;
    player.inventory[FANCY_EGG_INVENTORY_KEY] = 0;
  }
  if (earned > 0) player.gold += earned;
  return earned;
}

// ---------------------------------------------------------------------
// Procedural sprites
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
 * Draw a 2x2 tile coop centered at the screen pixel (cx, cy) — which
 * the caller derives from the coop's tile origin. Small wooden roof
 * + opening + chicken peeking out if any are inside.
 */
export function drawCoopSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  coop: PlacedCoop,
  tileSize: number,
): void {
  const w = COOP_W * tileSize;
  const h = COOP_H * tileSize;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 2, y + h - 2, w - 4, 3);
  // Wall.
  px(ctx, x + 4, y + h * 0.4, w - 8, h * 0.6, '#C49A6A');
  // Base shadow.
  px(ctx, x + 4, y + h - 4, w - 8, 3, '#8A6B44');
  // Roof — chunky pixel triangle.
  const roofH = Math.floor(h * 0.5);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const inset = Math.floor(t * (w / 2 - 4));
    const stripY = y + h * 0.4 - i * Math.ceil(roofH / 4);
    px(
      ctx,
      x + inset,
      stripY,
      w - inset * 2,
      Math.ceil(roofH / 4),
      i === 3 ? '#7A4530' : '#B85A3D',
    );
  }
  // Doorway opening.
  px(ctx, x + w / 2 - 4, y + h - 12, 8, 10, '#2A1F12');
  // Door arch.
  px(ctx, x + w / 2 - 4, y + h - 12, 8, 1, '#5A3818');
  // Tiny window with golden glow on each side.
  px(ctx, x + 8, y + h * 0.5, 4, 4, '#FFE4A0');
  px(ctx, x + w - 12, y + h * 0.5, 4, 4, '#FFE4A0');
  // Peeking chicken if any are inside.
  if (coop.chickens > 0) {
    drawChickenSprite(ctx, x + w / 2, y + h - 4);
  }
  // Egg counter badge above the roof when collectible eggs are waiting.
  if (coop.eggs > 0) {
    const text = `${coop.eggs}`;
    ctx.save();
    ctx.font = 'bold 9px ui-monospace, monospace';
    const tw = ctx.measureText(text).width + 8;
    const bx = x + w / 2 - tw / 2;
    const by = y - 12;
    px(ctx, bx, by, tw, 12, '#F5E9D4');
    ctx.fillStyle = '#1A1426';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, by + 6);
    ctx.restore();
  }
}

/** Tiny chicken sprite — peeks out of the coop doorway. */
export function drawChickenSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  // Body.
  px(ctx, x - 3, y - 4, 6, 4, '#F8F0E0');
  // Tail.
  px(ctx, x + 3, y - 5, 2, 2, '#F8F0E0');
  // Head.
  px(ctx, x - 4, y - 6, 3, 3, '#F8F0E0');
  // Comb.
  px(ctx, x - 3, y - 8, 2, 1, '#D8322A');
  // Beak.
  px(ctx, x - 5, y - 5, 1, 1, '#F0A828');
  // Eye.
  px(ctx, x - 3, y - 5, 1, 1, '#1A1426');
}
