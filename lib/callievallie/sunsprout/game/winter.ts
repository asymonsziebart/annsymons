// Winter quiet-season pass.
//
// Winter (season index 3) is the cozy farm's pause button. Crops that
// sit on bare outdoor tiles refuse to grow — the soil is too cold, the
// frost too sharp — and a soft snow drifts across the village. The
// greenhouse becomes the late-game player's main growing space, since
// every tile inside its footprint stays warm. A new Hot Cocoa recipe
// appears in the cookbook so the player has something to actually do
// with milk-grade comfort calories during the quiet weeks.
//
// This module is intentionally tiny and pure:
//   - isFrozenSeason(time) — quick predicate the engine can call.
//   - freezeOutdoorCrops(world) — at day rollover, mark every outdoor
//     crop as un-watered so advanceDay() can't grow it. Returns the
//     number of crops that got frozen so the HUD can post a flavour
//     toast on the first morning of Winter.
//   - drawSnowOverlay() — cheap procedural particle layer mirroring
//     the rain overlay in weather-strip.ts. Respects reduce-motion at
//     the call site by simply not being invoked.
//
// We do NOT kill the crop — the player can still harvest whatever was
// already at max stage when Winter started. We just halt growth so the
// season feels quiet without punishing the player who forgot to clear
// their field.

import type { World } from '../world/world';
import type { TimeOfDay } from './time';
import type { FarmCrop } from './farming';
import { isInsideGreenhouse } from './greenhouse';

/** Winter is season index 3 (Spring=0, Summer=1, Fall=2, Winter=3). */
export const WINTER_SEASON_INDEX = 3 as const;

/** True when the calendar is currently in Winter. */
export function isFrozenSeason(time: TimeOfDay): boolean {
  return time.season === WINTER_SEASON_INDEX;
}

/**
 * Day-rollover hook. When the calendar reads Winter, mark every crop
 * that's NOT inside a greenhouse as un-watered and reset its streak so
 * the standard advanceDay() pass can't grow it. Greenhouse crops are
 * left untouched — they keep their watered=true status from the prior
 * greenhouseTick() pass and grow as usual.
 *
 * Returns the number of crops that got frozen (zero outside winter,
 * zero when the field is empty).
 */
export function freezeOutdoorCrops(world: World): number {
  let frozen = 0;
  for (const c of world.crops as unknown as FarmCrop[]) {
    if (isInsideGreenhouse(world, c.tx, c.ty)) continue;
    if (c.watered) {
      c.watered = false;
      frozen++;
    }
    // Drop the streak so the player doesn't accidentally cash in a
    // gold-star tier off a frozen field at Spring rollover.
    c.waterStreak = 0;
  }
  return frozen;
}

/**
 * Cheap procedural snow overlay. Modelled after drawRainOverlay so
 * the call site is symmetrical. Drifts diagonally down + slightly
 * sideways so it feels like winter air rather than vertical hail.
 *
 * Particle density stays modest so old laptops don't dip below 60fps.
 * The caller is responsible for skipping this entirely when
 * settings.reduceMotion is on.
 */
export function drawSnowOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  nowMs: number,
): void {
  const count = 80;
  const speedY = 0.05;
  const speedX = 0.02;
  ctx.save();
  ctx.fillStyle = 'rgba(245, 250, 255, 0.85)';
  for (let i = 0; i < count; i++) {
    const seed = i * 53.17;
    const baseX = (seed * 37 + nowMs * speedX) % (canvasW + 40);
    const baseY = (seed * 71 + nowMs * speedY) % (canvasH + 40);
    const x = Math.floor(baseX) - 20;
    const y = Math.floor(baseY) - 20;
    // Each flake is a 2x2 pixel for visibility, with a 1px tail every other one.
    const size = (i & 1) === 0 ? 2 : 1;
    ctx.fillRect(x, y, size, size);
  }
  // A faint blue-white wash so the world reads as cold.
  ctx.fillStyle = 'rgba(180, 210, 240, 0.10)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();
}

/**
 * Returns a short flavour line for the HUD toast that fires on the
 * first day of Winter. Stable copy so the player learns to recognise
 * it across save files.
 */
export function winterFlavorLine(frozenCount: number): string {
  if (frozenCount <= 0) return 'Winter settles in. The fields go quiet.';
  return `Winter freezes ${frozenCount} crop${frozenCount === 1 ? '' : 's'}. Greenhouse only from here.`;
}
