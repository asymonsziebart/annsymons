// Farm cat companion — a roof-perched pet that gives the player a
// morning stamina-style buff. Mirrors the dog loop but with a different
// rhythm: where the dog wanders behind you, the cat sits on the
// farmhouse roof and watches. Same once-per-day pet ritual, same
// streak-driven gold tip, but tuned slightly higher because the cat is
// more aloof.
//
// Acquisition: buy a Kitten Ticket (250g) from Callie at the inn. Press
// `-` near the farmhouse to redeem the ticket the first time, then `-`
// again to pet the cat on subsequent days.
//
// Design intent: the cat is a "set and forget" pet. It never moves
// (it just stretches on the roof tile each frame), so it never crowds
// the dog's follow-loop or interferes with placeables.

import type { World, Player } from '../world/world';
import type { TimeOfDay } from './time';

export interface FarmCatState {
  /** Whether the player owns the cat. */
  owned: boolean;
  /** Cat's perch tile coordinates. Set to the farmhouse roof on adopt. */
  x: number;
  y: number;
  /** Day index when the cat was last petted. -1 means never. */
  petLastDay: number;
  /** Total times the cat has ever been petted. */
  petTotal: number;
  /** Consecutive days petted. Drops to 1 on a skip. */
  petStreak: number;
}

export interface WorldWithCat {
  cat?: FarmCatState;
}

/** Gold cost of buying the kitten ticket from Callie at the inn. */
export const CAT_PRICE = 250;

/** Inventory key for an unredeemed kitten ticket. */
export const CAT_TICKET_KEY = 'cat-ticket';

/** Bonus gold at the next day rollover per consecutive day petted. */
export const PET_DAILY_BONUS = 8;

/** Hard cap on streak. */
export const PET_STREAK_CAP = 14;

/** Pet radius — must stand near the farmhouse. */
export const PET_RADIUS = 3;

/** Default state — un-adopted cat sitting in a sensible "hidden" tile. */
export function defaultCatState(): FarmCatState {
  return {
    owned: false,
    x: 14, // farmhouse roof corner; overwritten on adopt
    y: 18,
    petLastDay: -1,
    petTotal: 0,
    petStreak: 0,
  };
}

/** Lazy reader. */
export function getCat(world: World): FarmCatState {
  const w = world as World & WorldWithCat;
  if (!w.cat) w.cat = defaultCatState();
  return w.cat;
}

/**
 * Adopt the cat by spending a Kitten Ticket. Places the cat on the
 * farmhouse roof so it has a stable, visible perch.
 */
export function adoptCat(world: World, player: Player): boolean {
  const cat = getCat(world);
  if (cat.owned) return false;
  const have = player.inventory[CAT_TICKET_KEY] ?? 0;
  if (have <= 0) return false;
  player.inventory[CAT_TICKET_KEY] = have - 1;
  cat.owned = true;
  // Sit on the centre roof tile of the farmhouse (4x3 footprint at 13,18).
  const fh = world.buildings.find((b) => b.kind === 'farmhouse');
  if (fh) {
    cat.x = fh.x + Math.floor(fh.w / 2);
    cat.y = fh.y;
  }
  return true;
}

/** Chebyshev distance between two points (corner-counts-as-one). */
function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Whether the player is close enough to pet the cat (cat sits on the roof). */
export function canPetCat(world: World, player: Player): boolean {
  const cat = getCat(world);
  if (!cat.owned) return false;
  return chebyshev(cat.x, cat.y, player.x, player.y) <= PET_RADIUS;
}

export type CatPetOutcome =
  | { kind: 'petted'; streak: number; bonus: number }
  | { kind: 'too-far' }
  | { kind: 'already-today' }
  | { kind: 'not-owned' };

/**
 * Pet the cat. Once per in-game day. Streak rules match the dog so the
 * UX is consistent across pets.
 */
export function petCat(world: World, player: Player, time: TimeOfDay): CatPetOutcome {
  const cat = getCat(world);
  if (!cat.owned) return { kind: 'not-owned' };
  if (chebyshev(cat.x, cat.y, player.x, player.y) > PET_RADIUS) return { kind: 'too-far' };
  if (cat.petLastDay === time.day) return { kind: 'already-today' };
  const gap = cat.petLastDay === -1 ? 0 : Math.max(0, time.day - cat.petLastDay);
  if (gap === 1 || cat.petStreak === 0) {
    cat.petStreak = Math.min(PET_STREAK_CAP, cat.petStreak + 1);
  } else {
    cat.petStreak = 1;
  }
  cat.petLastDay = time.day;
  cat.petTotal += 1;
  const bonus = cat.petStreak * PET_DAILY_BONUS;
  return { kind: 'petted', streak: cat.petStreak, bonus };
}

/**
 * Day-rollover hook — pay the streak bonus from yesterday's pet.
 * Returns the gold added, or 0 when the cat wasn't petted yesterday.
 */
export function catTick(world: World, player: Player, time: TimeOfDay): number {
  const cat = getCat(world);
  if (!cat.owned || cat.petLastDay === -1) return 0;
  if (time.day - cat.petLastDay !== 1) return 0;
  const bonus = cat.petStreak * PET_DAILY_BONUS;
  player.gold += bonus;
  return bonus;
}

/**
 * Stamina-tea keys recognised as "pet treats" for the cat. Same
 * order as the dog's catalog so the two pet modules consume teas
 * in matched lowest-tier-first priority.
 */
export const CAT_TREAT_KEYS = [
  'dish-herb-tea',
  'dish-berry-tonic',
  'dish-hot-cocoa',
  'dish-mushroom-broth',
  'dish-sunflower-elixir',
] as const;

export type CatTreatOutcome =
  | { kind: 'treated'; streak: number; bonus: number; treatKey: string }
  | { kind: 'no-treat' }
  | { kind: 'not-petted-yet' }
  | { kind: 'at-cap' }
  | { kind: 'not-owned' }
  | { kind: 'too-far' };

/**
 * Spend one stamina tea to bump the cat's pet streak by +1 (clamped
 * at PET_STREAK_CAP). Mirror of treatDog — same gates, same priority
 * order for picking which tea to consume.
 *
 * The cat's bonus tier is 8g/streak vs the dog's 5g, so a treat in
 * the bag is actually MORE valuable to give to the cat than the
 * dog in absolute gold-per-streak terms. The player picks who eats
 * the tea by which key they press (J vs -).
 */
export function treatCat(world: World, player: Player, time: TimeOfDay): CatTreatOutcome {
  const cat = getCat(world);
  if (!cat.owned) return { kind: 'not-owned' };
  if (chebyshev(cat.x, cat.y, player.x, player.y) > PET_RADIUS) return { kind: 'too-far' };
  if (cat.petLastDay !== time.day) return { kind: 'not-petted-yet' };
  if (cat.petStreak >= PET_STREAK_CAP) return { kind: 'at-cap' };
  for (const key of CAT_TREAT_KEYS) {
    const have = player.inventory[key] ?? 0;
    if (have > 0) {
      player.inventory[key] = have - 1;
      cat.petStreak = Math.min(PET_STREAK_CAP, cat.petStreak + 1);
      const bonus = cat.petStreak * PET_DAILY_BONUS;
      return { kind: 'treated', streak: cat.petStreak, bonus, treatKey: key };
    }
  }
  return { kind: 'no-treat' };
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
 * Draws a small 12x8 cat curled on a roof tile at screen pixel (x, y).
 * The cat is a soft grey tabby with pricked ears and a tail tucked
 * around the body — readable from a distance.
 */
export function drawCatSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  const fur = '#7A6E7D';
  const dark = '#5B5260';
  const belly = '#C9BCC7';
  const black = '#1A1426';
  const pink = '#E8A8B8';
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(Math.floor(x - 5), Math.floor(y + 2), 11, 2);
  // Curled body.
  px(ctx, x - 4, y - 2, 8, 4, fur);
  px(ctx, x - 3, y + 1, 6, 1, belly);
  // Tabby stripes.
  px(ctx, x - 2, y - 1, 1, 1, dark);
  px(ctx, x + 1, y - 1, 1, 1, dark);
  // Head — slightly larger, sitting up.
  px(ctx, x + 2, y - 4, 3, 3, fur);
  // Ears.
  px(ctx, x + 2, y - 5, 1, 1, fur);
  px(ctx, x + 4, y - 5, 1, 1, fur);
  px(ctx, x + 2, y - 4, 1, 1, pink);
  // Face.
  px(ctx, x + 3, y - 3, 1, 1, black);
  // Tail curls forward over the back.
  px(ctx, x - 5, y - 2, 1, 3, fur);
  px(ctx, x - 4, y, 1, 1, dark);
}
