// Seasonal storm — once-per-season big-weather event.
//
// Each season has exactly one big storm. Its day is picked
// deterministically (per season + per save signature) and the event
// fires at the next morning's rollover. When it hits:
//   - Every OUTDOOR crop (i.e. not inside a greenhouse) loses one
//     watered-day streak point AND has its daysSinceWater bumped to 1.
//     A silver-star streak crop drops back to normal; a gold drops to
//     silver. Players who walk the field and water that day buy back
//     a streak point so the storm is recoverable, not punishing.
//   - Crops inside a greenhouse are unaffected (this is the headline
//     payoff for owning a greenhouse).
//   - Forage on grass tiles is cleared (storm "blew them away").
//
// The storm posts a memo on the StormMemo state slot so the day
// summary + dawn toast can name the day it struck and what got hit.
// Persistence ships the memo so a reload right after a storm shows
// the same message.

import type { World } from '../world/world';
import type { Player } from '../world/world';
import type { FarmCrop } from './farming';
import { isInsideGreenhouse } from './greenhouse';
import { getForage } from './forage';
import { consumeShelteringShelters, isUnderShelter } from './storm-shelter';

/** Per-season storm record stored on the Player. */
export interface StormState {
  /** Map of seasonId(0..3 cycled by run) -> day-of-season when the storm hit. */
  hit: Record<string, number>;
  /** Most recent storm memo for the day summary; cleared at next storm. */
  lastMemo?: {
    season: number;
    day: number;
    cropsHit: number;
    forageHit: number;
    /** Number of crops that got protected by a storm shelter. */
    cropsSheltered?: number;
    /** Number of shelters consumed in the process. */
    consumedShelters?: number;
  };
}

/** Lazy reader on Player. */
export function getStorm(player: Player): StormState {
  const p = player as Player & { storm?: StormState };
  if (!p.storm) p.storm = { hit: {} };
  return p.storm;
}

/** Stable run-anchored season key — survives wraparound across years. */
function seasonKey(season: number, day: number, hitMap: Record<string, number>): string {
  // Each in-game year cycles seasons 0..3. We anchor a "year" as the
  // first non-empty entry seen in the run. For determinism we hash the
  // (season, prior-hit-count) so the same save always picks the same
  // storm day even after a reload + re-tick.
  const year = Math.floor(Object.keys(hitMap).length / 4);
  return `y${year}:s${season}`;
  void day;
}

/** Deterministic storm-day picker. Returns a day in [2, 6] inclusive. */
export function pickStormDay(season: number, hitMap: Record<string, number>): number {
  // Hash (season, year) to a stable day in 2..6 (avoids day 1 and 7
  // edges so the player isn't ambushed at season turnover).
  const year = Math.floor(Object.keys(hitMap).length / 4);
  let h = (season * 2654435761) ^ (year * 40503);
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return 2 + (h % 5);
}

/**
 * Should a storm fire on (season, day)? Returns the scheduled storm
 * day for this season — caller compares against time.day at rollover.
 * Caches the picked day so repeated reads don't re-roll if the count
 * field shifts mid-season.
 */
export function stormScheduledDay(player: Player, season: number): number {
  const state = getStorm(player);
  const key = seasonKey(season, 1, state.hit);
  // If we've already hit this season, we still expose the same day
  // (so the calendar shows the past storm day, not a wandering future).
  if (state.hit[key]) return state.hit[key];
  return pickStormDay(season, state.hit);
}

/**
 * Outcome of an attempted storm at (season, day). 'fired' when one
 * actually struck; 'already' when this season's storm is already on
 * record; 'not-today' when the schedule says a different day.
 */
export type StormOutcome =
  | { kind: 'fired'; cropsHit: number; forageHit: number; day: number; cropsSheltered: number; consumedShelters: number }
  | { kind: 'already' }
  | { kind: 'not-today' };

/**
 * Try to fire the storm for the current (season, day). Mutates outdoor
 * crops + clears forage if it fires; idempotent — only fires once per
 * season. Caller hooks this into the day-rollover after advanceDay.
 */
export function maybeFireStorm(
  world: World,
  player: Player,
  season: number,
  day: number,
): StormOutcome {
  const state = getStorm(player);
  const key = seasonKey(season, day, state.hit);
  if (state.hit[key]) return { kind: 'already' };
  const scheduled = pickStormDay(season, state.hit);
  if (day !== scheduled) return { kind: 'not-today' };
  // Fire.
  let cropsHit = 0;
  let cropsSheltered = 0;
  const shelteredTiles: Array<{ tx: number; ty: number }> = [];
  for (const c of world.crops as unknown as FarmCrop[]) {
    if (isInsideGreenhouse(world, c.tx, c.ty)) continue;
    // Storm shelter covers (Chebyshev radius 1) crops — they keep
    // their streak intact. Track the tile so we can consume the
    // shelter after the loop runs.
    if (isUnderShelter(world, c.tx, c.ty)) {
      cropsSheltered += 1;
      shelteredTiles.push({ tx: c.tx, ty: c.ty });
      continue;
    }
    // Drop one streak point + bump drought counter. Caps at 0.
    if ((c.waterStreak ?? 0) > 0) {
      c.waterStreak = (c.waterStreak ?? 0) - 1;
    }
    c.daysSinceWater = Math.max(c.daysSinceWater ?? 0, 1);
    cropsHit += 1;
  }
  // Consume every shelter that actually covered a crop.
  const consumedShelters = consumeShelteringShelters(world, shelteredTiles);
  // Forage gets cleared — the storm blew it away.
  const forage = getForage(world);
  const forageHit = forage.length;
  forage.length = 0;
  state.hit[key] = day;
  state.lastMemo = { season, day, cropsHit, forageHit, cropsSheltered, consumedShelters };
  return { kind: 'fired', cropsHit, forageHit, day, cropsSheltered, consumedShelters };
}

/** Pop the memo (returns + clears). Used by the day-summary overlay. */
export function takeStormMemo(player: Player): StormState['lastMemo'] | undefined {
  const state = getStorm(player);
  const memo = state.lastMemo;
  state.lastMemo = undefined;
  return memo;
}

/** Convenience: how many days until the next storm in (season). */
export function stormDaysUntil(player: Player, season: number, day: number): number {
  const state = getStorm(player);
  const key = seasonKey(season, day, state.hit);
  if (state.hit[key]) return -1; // already happened this season
  const scheduled = pickStormDay(season, state.hit);
  return scheduled - day;
}

/** Short flavour line for the dawn toast. */
export function stormFlavorLine(memo: NonNullable<StormState['lastMemo']>): string {
  const seasonName = ['Spring', 'Summer', 'Fall', 'Winter'][memo.season % 4] ?? 'Spring';
  if (memo.cropsHit === 0 && memo.forageHit === 0 && !memo.cropsSheltered) {
    return `${seasonName} storm rolled through — nothing in the field to lose.`;
  }
  const cropPart = memo.cropsHit > 0 ? `${memo.cropsHit} crop${memo.cropsHit === 1 ? '' : 's'} lost a streak day` : '';
  const foragePart = memo.forageHit > 0 ? `${memo.forageHit} forage blown away` : '';
  const shelterPart =
    memo.cropsSheltered && memo.cropsSheltered > 0
      ? `${memo.cropsSheltered} crop${memo.cropsSheltered === 1 ? '' : 's'} kept dry under shelter${memo.consumedShelters && memo.consumedShelters > 1 ? 's' : ''}`
      : '';
  const tail = [cropPart, foragePart, shelterPart].filter(Boolean).join(', ');
  return `${seasonName} storm hit overnight — ${tail}.`;
}
