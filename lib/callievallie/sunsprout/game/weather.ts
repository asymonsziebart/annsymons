// Weather — per-day forecast, with rain auto-watering crops.
//
// A cozy farm sim needs weather: rain saves you the morning watering
// chore but might mess with festivals; storms add drama. Weather is
// deterministic per (season, day) so the same calendar slot always
// rolls the same forecast for a given save — the player can plan
// around it. RAIN auto-waters every crop at day-rollover, exactly like
// the player walking the field with a watering can.
//
// The world only stores `currentWeather` (the active day's roll); the
// next day's forecast is computed on demand from the calendar so saves
// stay tiny.

import type { World } from '../world/world';
import type { TimeOfDay } from './time';
import type { FarmCrop } from './farming';

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm';

/** Static info per weather kind — used by HUD strip + flavour text. */
export interface WeatherDef {
  /** Human-readable label for the HUD pill. */
  label: string;
  /** Hex color of the HUD pill background. */
  color: string;
  /** Whether this weather waters every crop at day rollover. */
  watersCrops: boolean;
  /** Short flavour line for the day-summary overlay / NPC dialogue. */
  flavor: string;
}

export const WEATHER: Record<Weather, WeatherDef> = {
  sunny: {
    label: 'Sunny',
    color: '#F0C24A',
    watersCrops: false,
    flavor: 'The sun is high and the fields are bright.',
  },
  cloudy: {
    label: 'Cloudy',
    color: '#9EA9C2',
    watersCrops: false,
    flavor: 'Soft grey clouds roll over the valley.',
  },
  rain: {
    label: 'Rain',
    color: '#5A8FD8',
    watersCrops: true,
    flavor: 'A gentle rain soaks the soil all afternoon.',
  },
  storm: {
    label: 'Storm',
    color: '#3A4FA0',
    watersCrops: true,
    flavor: 'Thunder cracks over the hills — best stay inside.',
  },
};

export const WEATHER_KEYS: Weather[] = ['sunny', 'cloudy', 'rain', 'storm'];

/**
 * Per-season weather odds (must sum to 1.0). Spring leans rainy, Summer
 * leans sunny, Fall mixes, Winter (cold + clear) leans sunny + cloudy.
 * The weights model the village's mood; they're not a real climate sim.
 */
export const SEASON_WEIGHTS: Record<0 | 1 | 2 | 3, Record<Weather, number>> = {
  0: { sunny: 0.35, cloudy: 0.30, rain: 0.30, storm: 0.05 }, // Spring
  1: { sunny: 0.60, cloudy: 0.20, rain: 0.15, storm: 0.05 }, // Summer
  2: { sunny: 0.30, cloudy: 0.30, rain: 0.30, storm: 0.10 }, // Fall
  3: { sunny: 0.55, cloudy: 0.35, rain: 0.05, storm: 0.05 }, // Winter
};

/** Deterministic hash of (season, day) → [0, 1). Stable across runs. */
function calendarHash(season: number, day: number): number {
  // FNV-ish mix — same season+day always returns the same number.
  let h = (season * 2654435761) ^ (day * 40503);
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  // To [0, 1).
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Roll the weather for a given calendar day. Always returns the same
 * weather for the same (season, day) on the same season — that's the
 * whole point of "predictable forecasts".
 */
export function rollWeather(season: 0 | 1 | 2 | 3, day: number): Weather {
  const r = calendarHash(season, day);
  const weights = SEASON_WEIGHTS[season];
  let cum = 0;
  for (const k of WEATHER_KEYS) {
    cum += weights[k];
    if (r < cum) return k;
  }
  return 'sunny';
}

/** Today's weather, given the clock. */
export function weatherToday(time: TimeOfDay): Weather {
  return rollWeather(time.season, time.day);
}

/**
 * Tomorrow's weather, given the clock. Wraps day 7 → day 1 of the next
 * season (matching TimeOfDay's SEASON_LENGTH of 7).
 */
export function weatherTomorrow(time: TimeOfDay): Weather {
  let nextDay = time.day + 1;
  let nextSeason: 0 | 1 | 2 | 3 = time.season;
  if (nextDay > 7) {
    nextDay = 1;
    nextSeason = (((time.season + 1) % 4) as 0 | 1 | 2 | 3);
  }
  return rollWeather(nextSeason, nextDay);
}

/**
 * Apply day-rollover rain. If the current day's weather waters crops,
 * mark every crop on the map as `watered=true` and reset its drought
 * counter — exactly what walking the field with a can does. Returns
 * the number of crops that got rained on (0 when it didn't rain).
 *
 * Call this BEFORE advanceDay(world) so the rain counts toward the
 * growth tick that's about to happen.
 */
export function applyRain(world: World, weather: Weather): number {
  if (!WEATHER[weather].watersCrops) return 0;
  let count = 0;
  for (const c of world.crops as unknown as FarmCrop[]) {
    c.watered = true;
    c.daysSinceWater = 0;
    count++;
  }
  return count;
}
