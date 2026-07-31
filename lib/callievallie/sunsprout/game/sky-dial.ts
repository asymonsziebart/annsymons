// Sky dial — pure math for the sun/moon arc HUD widget.
//
// The HUD already prints a 12-hour clock, but a number doesn't convey
// "how much daylight is left" at a glance. This module turns the current
// time into a celestial body (sun by day, moon by night) travelling along
// a horizon-to-horizon arc, plus a 0..1 daylight-progress value the widget
// uses to tint the sky band behind the arc. Sunrise sits at DAY_START,
// sunset at DAY_END; the body climbs to its zenith at the midpoint.
//
// Pure module: no canvas, no Date. Consumes the same DAY_START / DAY_END
// constants as the renderer's tint so the dial and the world agree on
// when it's "night".

import { DAY_START, DAY_END } from './time';
import type { Weather } from './weather';

export type CelestialBody = 'sun' | 'moon';

export interface SkyDialState {
  /** Which body is currently on the arc. */
  body: CelestialBody;
  /**
   * Fractional position along the visible arc in [0,1]: 0 = left horizon
   * (rising), 0.5 = zenith, 1 = right horizon (setting). For the sun this
   * spans DAY_START..DAY_END; for the moon it spans the night DAY_END..
   * DAY_START (wrapping midnight).
   */
  arcT: number;
  /** Normalised height in [0,1]: 0 at either horizon, 1 at the zenith. */
  altitude: number;
  /** True while the sun is up (DAY_START <= h < DAY_END). */
  isDay: boolean;
  /** Short label for the current phase, e.g. "Dawn", "Midday", "Night". */
  phaseLabel: string;
}

/** Continuous hour-of-day in [0,24) from an hour + minute pair. */
function hourOf(hour: number, minute: number): number {
  const h = ((hour % 24) + 24) % 24 + Math.max(0, Math.min(59, minute)) / 60;
  return h % 24;
}

/** Length of the daytime window in hours (DAY_START..DAY_END). */
export const DAY_HOURS = DAY_END - DAY_START;
/** Length of the nighttime window in hours (wraps midnight). */
export const NIGHT_HOURS = 24 - DAY_HOURS;

/**
 * Map the current time to a sky-dial state. The arc parameter increases
 * monotonically across whichever window (day or night) we're in, so the
 * widget can place the body without any per-frame easing state.
 */
export function skyDialState(hour: number, minute: number = 0): SkyDialState {
  const h = hourOf(hour, minute);
  const isDay = h >= DAY_START && h < DAY_END;

  let arcT: number;
  if (isDay) {
    arcT = (h - DAY_START) / DAY_HOURS;
  } else {
    // Night runs DAY_END -> 24 -> DAY_START. Shift hours into a 0..NIGHT
    // span so the moon rises at dusk and sets at dawn.
    const sinceDusk = h >= DAY_END ? h - DAY_END : h + (24 - DAY_END);
    arcT = sinceDusk / NIGHT_HOURS;
  }
  // Clamp against floating-point spill at the exact boundaries.
  arcT = Math.max(0, Math.min(1, arcT));

  // Altitude is a sine hump: 0 at the horizons, 1 at the zenith (arcT=0.5).
  const altitude = Math.sin(arcT * Math.PI);

  return {
    body: isDay ? 'sun' : 'moon',
    arcT,
    altitude,
    isDay,
    phaseLabel: phaseLabelFor(h, isDay, arcT),
  };
}

/** Human-readable phase word for the dial caption. */
export function phaseLabelFor(h: number, isDay: boolean, arcT: number): string {
  if (isDay) {
    if (arcT < 0.18) return 'Dawn';
    if (arcT < 0.42) return 'Morning';
    if (arcT < 0.58) return 'Midday';
    if (arcT < 0.82) return 'Afternoon';
    return 'Dusk';
  }
  // Night phases.
  if (arcT < 0.2) return 'Dusk';
  if (arcT < 0.5) return 'Evening';
  if (arcT < 0.8) return 'Night';
  return 'Pre-dawn';
}

/**
 * Minutes of daylight remaining until DAY_END (0 once the sun has set).
 * Used by the widget to caption "Nh left" so the player can plan the day.
 * Returns whole minutes.
 */
export function daylightMinutesLeft(hour: number, minute: number = 0): number {
  const h = hourOf(hour, minute);
  if (h >= DAY_END || h < DAY_START) return 0;
  return Math.round((DAY_END - h) * 60);
}

/**
 * How the current weather should colour the sky dial. Sunny / cloudy
 * leave the body bright; rain / storm dim + grey it and ask the widget
 * to tuck a small cloud glyph over the body so the at-a-glance widget
 * also reads the sky. `dimmed` drives an alpha knock-down on the body
 * colour, `cloud` whether to draw the overcast puff.
 *
 * Pure — a weather kind in, a small render hint out. Keeps the widget's
 * branch trivial and unit-testable without a canvas.
 */
export interface SkyWeatherStyle {
  /** True when the body should render greyed + dimmed (rain/storm). */
  dimmed: boolean;
  /** True when a small cloud glyph should overlay the body. */
  cloud: boolean;
  /** True for storms specifically — the widget tints the cloud darker. */
  storm: boolean;
}

export function skyWeatherStyle(weather: Weather): SkyWeatherStyle {
  const wet = weather === 'rain' || weather === 'storm';
  return {
    dimmed: wet,
    cloud: wet,
    storm: weather === 'storm',
  };
}
