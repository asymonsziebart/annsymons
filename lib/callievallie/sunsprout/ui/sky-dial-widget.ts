// Sky dial widget — a small sun/moon arc tucked under the top status bar
// next to the centered clock. It renders the celestial body climbing a
// horizon-to-horizon arc so the player can read "how much daylight is
// left" at a glance, with a phase caption ("Midday", "Dusk", "Night")
// and an "Nh left" readout during the day.
//
// Matches the HUD palette and integer-snaps every coordinate. Pure
// drawing layer — all the placement math comes from sky-dial.ts.

import type { TimeOfDay } from '../game/time';
import { skyDialState, daylightMinutesLeft, skyWeatherStyle } from '../game/sky-dial';
import { weatherToday } from '../game/weather';
import { rightColumnLayout } from '../game/hud-layout';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const SUBTLE = '#9D8FB8';
const ARC_DAY = 'rgba(245, 201, 160, 0.40)';
const ARC_NIGHT = 'rgba(150, 170, 220, 0.35)';
const SUN_CORE = '#F7D070';
const SUN_RAY = '#F5B94A';
const MOON_CORE = '#E8ECF5';
const MOON_SHADOW = '#9FB0D0';
const CLOUD_LIGHT = '#C7CDDA';
const CLOUD_DARK = '#8C93A6';
const CLOUD_STORM = '#6A7186';

/**
 * Draws the sky dial. Anchored top-right, stacked just below the weather
 * strip so it shares the right-hand HUD column and never collides with the
 * centred clock or the birthday/festival banners. `canvasW` right-aligns it.
 * `hudScale` grows the card + its Y in lockstep with the rest of the column
 * so the dial stays attached when the HUD is scaled up for accessibility.
 */
export function drawSkyDial(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
  hudScale: number = 1.0,
): void {
  const state = skyDialState(time.hour, time.minute);
  const layout = rightColumnLayout(hudScale);
  const scale = layout.scale;
  const width = layout.skyDial.width;
  const height = layout.skyDial.height;
  // Right-aligned, in its column slot below the weather strip.
  const x = canvasW - width - Math.round(12 * scale);
  const y = layout.skyDial.y;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Frame.
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

  // Arc geometry: a shallow dome inside the frame. The body rides it by
  // arcT (0 left horizon -> 1 right horizon), lifted by its altitude.
  const padX = Math.round(14 * scale);
  const baseY = y + height - Math.round(14 * scale); // horizon line
  const arcLeft = x + padX;
  const arcRight = x + width - padX;
  const arcSpan = arcRight - arcLeft;
  const arcHeight = Math.round(16 * scale);

  // Horizon line.
  ctx.strokeStyle = state.isDay ? ARC_DAY : ARC_NIGHT;
  ctx.beginPath();
  ctx.moveTo(arcLeft, baseY + 0.5);
  ctx.lineTo(arcRight, baseY + 0.5);
  ctx.stroke();

  // Dotted arc the body travels along.
  ctx.fillStyle = state.isDay ? ARC_DAY : ARC_NIGHT;
  const dot = Math.max(1, Math.round(scale));
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const px = arcLeft + t * arcSpan;
    const py = baseY - Math.sin(t * Math.PI) * arcHeight;
    ctx.fillRect(Math.floor(px), Math.floor(py), dot, dot);
  }

  // Body position.
  const bx = Math.floor(arcLeft + state.arcT * arcSpan);
  const by = Math.floor(baseY - state.altitude * arcHeight);
  // Weather tie-in: rain / storm dim + grey the body and tuck a small
  // cloud over it so the dial reads the sky, not just the clock.
  const weather = skyWeatherStyle(weatherToday(time));
  ctx.save();
  if (weather.dimmed) ctx.globalAlpha = 0.5;
  if (state.body === 'sun') {
    drawSun(ctx, bx, by, scale);
  } else {
    drawMoon(ctx, bx, by, scale);
  }
  ctx.restore();
  if (weather.cloud) {
    drawCloud(ctx, bx, by, weather.storm, scale);
  }

  // Caption: phase word + daylight-left readout.
  ctx.font = `bold ${Math.round(9 * scale)}px ui-monospace, monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = SUBTLE;
  ctx.fillText(state.phaseLabel, x + Math.round(8 * scale), y + Math.round(5 * scale));

  if (state.isDay) {
    const minsLeft = daylightMinutesLeft(time.hour, time.minute);
    const hrs = Math.floor(minsLeft / 60);
    const mins = minsLeft % 60;
    const txt = hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
    ctx.textAlign = 'right';
    ctx.fillStyle = SUBTLE;
    ctx.font = `${Math.round(9 * scale)}px ui-monospace, monospace`;
    ctx.fillText(txt, x + width - Math.round(8 * scale), y + Math.round(5 * scale));
  }

  ctx.restore();
}

/** Tiny radiant sun glyph centred on (cx, cy). */
function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number = 1.0): void {
  const u = (n: number) => Math.round(n * scale);
  // Rays.
  ctx.fillStyle = SUN_RAY;
  ctx.fillRect(cx - u(1), cy - u(6), u(2), u(3));
  ctx.fillRect(cx - u(1), cy + u(4), u(2), u(3));
  ctx.fillRect(cx - u(6), cy - u(1), u(3), u(2));
  ctx.fillRect(cx + u(4), cy - u(1), u(3), u(2));
  // Core.
  ctx.fillStyle = SUN_CORE;
  ctx.fillRect(cx - u(3), cy - u(2), u(6), u(5));
  ctx.fillRect(cx - u(2), cy - u(3), u(4), u(7));
}

/** Tiny crescent moon glyph centred on (cx, cy). */
function drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number = 1.0): void {
  const u = (n: number) => Math.round(n * scale);
  // Full disc.
  ctx.fillStyle = MOON_CORE;
  ctx.fillRect(cx - u(3), cy - u(2), u(6), u(5));
  ctx.fillRect(cx - u(2), cy - u(3), u(4), u(7));
  // Shadow bite to make it a crescent.
  ctx.fillStyle = MOON_SHADOW;
  ctx.fillRect(cx, cy - u(3), u(3), u(7));
  ctx.fillRect(cx + u(1), cy - u(2), u(2), u(5));
}

/**
 * Small overcast puff tucked over the body so a rainy / stormy day reads
 * at a glance. Offset down-right of the body centre so the dimmed sun /
 * moon still peeks out behind it. Storms get a darker, heavier cloud.
 */
function drawCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  storm: boolean,
  scale: number = 1.0,
): void {
  const u = (n: number) => Math.round(n * scale);
  const base = storm ? CLOUD_STORM : CLOUD_DARK;
  const top = storm ? CLOUD_DARK : CLOUD_LIGHT;
  // Cloud body — a couple of stacked puffs, offset slightly down-right so
  // the dimmed body still peeks out behind it.
  const ox = cx + u(1);
  const oy = cy + u(1);
  ctx.fillStyle = base;
  ctx.fillRect(ox - u(5), oy + u(1), u(11), u(3));
  ctx.fillRect(ox - u(3), oy - u(1), u(8), u(3));
  ctx.fillStyle = top;
  ctx.fillRect(ox - u(3), oy - u(1), u(7), u(2));
  ctx.fillRect(ox - u(1), oy - u(2), u(4), u(2));
}
