// Farm dog companion — a procedural pixel pet that follows the player
// around the farm. Press P near the dog to pet it (once per day) for a
// daily morale buff that grants a small gold bonus at the next day
// rollover. The dog wanders within a few tiles of the player and snaps
// to them when they walk away.
//
// Design intent: the dog is pure morale. It never blocks gameplay or
// occupies a tile (movement-wise) so it can never trap the player. It
// follows in real-time, no path-finding — just a soft lerp toward an
// offset behind the player. State is a single struct on the World.
//
// Persistence: petCount / petLastDay travel with the save so streaks
// are not reset on reload.

import type { World, Player } from '../world/world';
import type { TimeOfDay } from './time';

/** Storage shape attached to the World. */
export interface FarmDogState {
  /** Whether the player owns the dog yet (purchased from Maple). */
  owned: boolean;
  /** Dog's current tile-space position (fractional during chase). */
  x: number;
  y: number;
  /** Day index when the dog was last petted. -1 means never. */
  petLastDay: number;
  /** Total times the dog has ever been petted. */
  petTotal: number;
  /** Consecutive days the player has petted the dog. Drops to 1 on a skip. */
  petStreak: number;
}

export interface WorldWithDog {
  dog?: FarmDogState;
}

/** Gold cost of buying the dog from Maple. */
export const DOG_PRICE = 500;

/** Inventory key for an unredeemed "dog ticket". */
export const DOG_TICKET_KEY = 'dog-ticket';

/** Bonus gold at the next day rollover per consecutive day petted. */
export const PET_DAILY_BONUS = 5;

/** Hard cap on streak so a million-day save doesn't trivialise economy. */
export const PET_STREAK_CAP = 14;

/** How close (tiles) the player needs to be to pet the dog. */
export const PET_RADIUS = 2;

/** Default fresh-state factory. */
export function defaultDogState(): FarmDogState {
  return {
    owned: false,
    x: 14,
    y: 19, // near the farmhouse
    petLastDay: -1,
    petTotal: 0,
    petStreak: 0,
  };
}

/** Lazy-init reader. */
export function getDog(world: World): FarmDogState {
  const w = world as World & WorldWithDog;
  if (!w.dog) w.dog = defaultDogState();
  return w.dog;
}

/** Mark the dog as owned (called when the player redeems the ticket). */
export function adoptDog(world: World, player: Player): boolean {
  const dog = getDog(world);
  if (dog.owned) return false;
  const have = player.inventory[DOG_TICKET_KEY] ?? 0;
  if (have <= 0) return false;
  player.inventory[DOG_TICKET_KEY] = have - 1;
  dog.owned = true;
  // Spawn next to the player so they meet right away.
  dog.x = player.x;
  dog.y = player.y + 1;
  return true;
}

/** Distance (tile-space, taxicab) between the dog and the player. */
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** True when the player is close enough to pet the dog. */
export function canPet(world: World, player: Player): boolean {
  const dog = getDog(world);
  if (!dog.owned) return false;
  return dist(dog, player) <= PET_RADIUS;
}

/** Outcome union — used by game.ts to surface the right toast. */
export type PetOutcome =
  | { kind: 'petted'; streak: number; bonus: number }
  | { kind: 'too-far' }
  | { kind: 'already-today' }
  | { kind: 'not-owned' };

/**
 * Pet the dog. Once per in-game day. Streak resets to 1 if more than
 * one day has elapsed since the last pet. Streak grows toward
 * PET_STREAK_CAP. Returns the bonus that'll be paid at the next
 * morning's rollover (the actual payout is in dogTick()).
 */
export function petDog(world: World, player: Player, time: TimeOfDay): PetOutcome {
  const dog = getDog(world);
  if (!dog.owned) return { kind: 'not-owned' };
  if (dist(dog, player) > PET_RADIUS) return { kind: 'too-far' };
  if (dog.petLastDay === time.day) return { kind: 'already-today' };
  const gap = dog.petLastDay === -1 ? 0 : Math.max(0, time.day - dog.petLastDay);
  if (gap === 1 || dog.petStreak === 0) {
    dog.petStreak = Math.min(PET_STREAK_CAP, dog.petStreak + 1);
  } else {
    // Multi-day gap — reset the streak.
    dog.petStreak = 1;
  }
  dog.petLastDay = time.day;
  dog.petTotal += 1;
  const bonus = dog.petStreak * PET_DAILY_BONUS;
  return { kind: 'petted', streak: dog.petStreak, bonus };
}

/**
 * Per-day rollover hook. If the dog was petted yesterday, deposit the
 * streak's gold bonus into the player's wallet and return it. Call
 * AFTER advanceDay (so the toast shows the correct day).
 */
export function dogTick(world: World, player: Player, time: TimeOfDay): number {
  const dog = getDog(world);
  if (!dog.owned || dog.petLastDay === -1) return 0;
  // Pet yesterday? (We just rolled into time.day; petLastDay was set
  // before the rollover, so the gap is exactly 1.)
  if (time.day - dog.petLastDay !== 1) return 0;
  const bonus = dog.petStreak * PET_DAILY_BONUS;
  player.gold += bonus;
  return bonus;
}

/**
 * Stamina-tea keys recognised as "pet treats". Same catalog the
 * drinkBest() loop uses, so the player's existing tea stockpile
 * doubles as pet currency. Ordered cheapest-first so the dog/cat
 * eats the lowest-value tea before tapping a sunflower elixir.
 */
export const PET_TREAT_KEYS = [
  'dish-herb-tea',
  'dish-berry-tonic',
  'dish-hot-cocoa',
  'dish-mushroom-broth',
  'dish-sunflower-elixir',
] as const;

export type PetTreatOutcome =
  | { kind: 'treated'; streak: number; bonus: number; treatKey: string }
  | { kind: 'no-treat' }
  | { kind: 'not-petted-yet' }
  | { kind: 'at-cap' }
  | { kind: 'not-owned' }
  | { kind: 'too-far' };

/**
 * Spend one pet treat (a stamina tea) from the player's bag to add a
 * point to the dog's pet streak — clamped at PET_STREAK_CAP. Gated
 * by:
 *   - dog must be owned;
 *   - player must be within PET_RADIUS;
 *   - dog must already be petted TODAY (no skipping the regular pet);
 *   - streak < PET_STREAK_CAP (refuse 'at-cap' otherwise so the
 *     player doesn't waste a tea).
 *
 * Returns 'no-treat' when no recognised tea is in the bag. Picks the
 * lowest-tier tea first so the player keeps the heavy-hitters for
 * the stamina pool. Streak grows by exactly +1; the bonus paid at
 * the next dawn = newStreak * PET_DAILY_BONUS (same math as petDog).
 */
export function treatDog(world: World, player: Player, time: TimeOfDay): PetTreatOutcome {
  const dog = getDog(world);
  if (!dog.owned) return { kind: 'not-owned' };
  if (dist(dog, player) > PET_RADIUS) return { kind: 'too-far' };
  if (dog.petLastDay !== time.day) return { kind: 'not-petted-yet' };
  if (dog.petStreak >= PET_STREAK_CAP) return { kind: 'at-cap' };
  // Find the lowest-tier tea the player has.
  for (const key of PET_TREAT_KEYS) {
    const have = player.inventory[key] ?? 0;
    if (have > 0) {
      player.inventory[key] = have - 1;
      dog.petStreak = Math.min(PET_STREAK_CAP, dog.petStreak + 1);
      const bonus = dog.petStreak * PET_DAILY_BONUS;
      return { kind: 'treated', streak: dog.petStreak, bonus, treatKey: key };
    }
  }
  return { kind: 'no-treat' };
}

/**
 * Per-frame movement update. Soft-chase the player when more than
 * FOLLOW_RADIUS tiles away; idle in place when close.
 */
const FOLLOW_RADIUS = 2.5;
const CHASE_SPEED = 2.4; // tiles per second
const TELEPORT_DIST = 10; // snap to player if we're hopelessly far

export function updateDog(world: World, player: Player, dtMs: number): void {
  const dog = getDog(world);
  if (!dog.owned) return;
  const dx = player.x - dog.x;
  const dy = player.y - dog.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > TELEPORT_DIST) {
    dog.x = player.x;
    dog.y = player.y + 1;
    return;
  }
  if (d <= FOLLOW_RADIUS) return;
  const step = (CHASE_SPEED * dtMs) / 1000;
  const move = Math.min(step, d - FOLLOW_RADIUS);
  dog.x += (dx / d) * move;
  dog.y += (dy / d) * move;
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
 * Draws a 12x10 farm dog at the screen pixel (x,y). Small floppy ears,
 * a wagging tail, brown body with a lighter belly. Faces left when
 * dx<0, right otherwise.
 */
export function drawDogSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facingRight: boolean,
): void {
  const body = '#A86A3A';
  const dark = '#7A4A24';
  const belly = '#E8B07A';
  const black = '#1A1426';
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(Math.floor(x - 5), Math.floor(y + 3), 12, 2);
  // Body.
  px(ctx, x - 4, y - 2, 8, 5, body);
  // Belly highlight.
  px(ctx, x - 3, y + 2, 6, 1, belly);
  // Legs (four little stubs).
  px(ctx, x - 3, y + 3, 2, 2, dark);
  px(ctx, x + 1, y + 3, 2, 2, dark);
  // Head and tail anchor on facing.
  if (facingRight) {
    px(ctx, x + 3, y - 4, 4, 4, body);
    // Ear flop.
    px(ctx, x + 6, y - 5, 1, 2, dark);
    // Snout.
    px(ctx, x + 7, y - 2, 1, 1, body);
    // Eye.
    px(ctx, x + 5, y - 3, 1, 1, black);
    // Tail.
    px(ctx, x - 6, y - 3, 2, 1, body);
    px(ctx, x - 7, y - 4, 1, 1, body);
  } else {
    px(ctx, x - 7, y - 4, 4, 4, body);
    px(ctx, x - 7, y - 5, 1, 2, dark);
    px(ctx, x - 8, y - 2, 1, 1, body);
    px(ctx, x - 6, y - 3, 1, 1, black);
    px(ctx, x + 4, y - 3, 2, 1, body);
    px(ctx, x + 6, y - 4, 1, 1, body);
  }
}
