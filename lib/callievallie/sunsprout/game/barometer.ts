// Weather barometer — premium one-shot upgrade from Pip's cart that
// extends the weather forecast HUD from one day ahead to two days
// ahead. Once owned, the strip shows "Today · Next · After" instead
// of just "Today · Next".
//
// Pricing: 300g at Pip's cart, single-purchase (already-owned guard
// in the cart flow). Persistence rides on player.inventory under
// BAROMETER_INVENTORY_KEY — a quantity of 1 means owned. No new save
// schema, no new save fields.
//
// Pure module: no IO, no canvas. The UI strip imports `hasBarometer`
// + `weatherDayAfterTomorrow` and the cart catalog imports
// BAROMETER_PRICE + the inventory key.

import type { Player } from '../world/world';
import type { TimeOfDay } from './time';
import type { Weather } from './weather';
import { rollWeather, weatherTomorrow } from './weather';

/** Inventory key for an owned barometer. Quantity 1 = owned. */
export const BAROMETER_INVENTORY_KEY = 'barometer';

/** Gold cost at Pip's cart. */
export const BAROMETER_PRICE = 300;

/** True iff the player owns at least one barometer (singleton item). */
export function hasBarometer(player: Player): boolean {
  return (player.inventory[BAROMETER_INVENTORY_KEY] ?? 0) > 0;
}

/**
 * Weather for the day-after-tomorrow, given the current clock. Wraps
 * day 7 to day 1 of the next season just like weatherTomorrow does.
 * Pure function — the player has to own a barometer for the HUD to
 * actually call it, but the calculation itself is always available so
 * tests don't need to fake a player to verify the rollover math.
 */
export function weatherDayAfterTomorrow(time: TimeOfDay): Weather {
  let nextDay = time.day + 2;
  let nextSeason: 0 | 1 | 2 | 3 = time.season;
  // Walk forward one calendar at a time so a +2 step from day 6
  // correctly lands on day 1 of the next season (6 → 7 stays, 7 → 1).
  if (nextDay > 7) {
    nextDay = nextDay - 7;
    nextSeason = (((time.season + 1) % 4) as 0 | 1 | 2 | 3);
  }
  return rollWeather(nextSeason, nextDay);
}

/** Pretty label for the cart purchase toast. */
export function barometerBoughtLine(): string {
  return `Barometer mounted on the porch. Forecast now reaches two days ahead.`;
}

/**
 * Returns "Storm in N days — line up shelters now." when the barometer
 * is mounted AND a storm sits in the (tomorrow, day-after-tomorrow)
 * forecast window, otherwise an empty string. Drives the village
 * board's storm-warning chip + the dawn-toast tail.
 *
 * Distance ordering: prefer the closer storm so a chain of two storms
 * surfaces the more urgent one first. With a 2-day lookahead we only
 * ever pick from { 1, 2 } so the ordering is trivial.
 */
export function barometerStormWarning(player: Player, time: TimeOfDay): string {
  if (!hasBarometer(player)) return '';
  if (weatherTomorrow(time) === 'storm') {
    return 'Storm tomorrow — line up shelters now.';
  }
  if (weatherDayAfterTomorrow(time) === 'storm') {
    return 'Storm in 2 days — line up shelters now.';
  }
  return '';
}
