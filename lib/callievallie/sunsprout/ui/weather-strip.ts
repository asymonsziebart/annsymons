// Weather HUD strip — a small pill in the top status bar showing
// "Today: <weather>  /  Next: <weather>". Matches the existing
// HUD palette (PANEL_BG / PANEL_BORDER / monospace) and sits flush
// under the top status bar.
//
// When the player owns a Brass Barometer (sold at Pip's cart) the
// strip widens and adds an "After" pill for the day-after-tomorrow,
// extending the forecast to two days ahead.

import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import { weatherToday, weatherTomorrow, WEATHER } from '../game/weather';
import { hasBarometer, weatherDayAfterTomorrow } from '../game/barometer';
import { rightColumnLayout } from '../game/hud-layout';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const SUBTLE = '#9D8FB8';

/**
 * Renders the strip aligned to the top-right, just below the status
 * bar. Returns void; the HUD layer composes it on every frame. When
 * the player owns the barometer the strip widens to include an
 * "After" pill (day-after-tomorrow). `hudScale` grows the strip + its
 * Y position in lockstep with the top bar so it stays attached when the
 * player scales the HUD up for accessibility.
 */
export function drawWeatherStrip(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
  player?: Player,
  hudScale: number = 1.0,
): void {
  const today = weatherToday(time);
  const tomorrow = weatherTomorrow(time);
  const showAfter = player ? hasBarometer(player) : false;
  const after = showAfter ? weatherDayAfterTomorrow(time) : null;
  const layout = rightColumnLayout(hudScale);
  const scale = layout.scale;
  const w = Math.round((showAfter ? 320 : 220) * scale);
  const h = layout.weatherStrip.height;
  const x = canvasW - w - Math.round(12 * scale);
  const y = layout.weatherStrip.y;

  ctx.save();
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.font = `${Math.round(11 * scale)}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle';

  // "Today:" label + colored pill + "Next:" + colored pill.
  ctx.textAlign = 'left';
  ctx.fillStyle = SUBTLE;
  ctx.fillText('Today', x + Math.round(6 * scale), y + h / 2);
  drawWeatherPill(ctx, x + Math.round(42 * scale), y + Math.round(4 * scale), WEATHER[today].label, WEATHER[today].color, scale);

  ctx.fillStyle = SUBTLE;
  ctx.fillText('Next', x + Math.round(116 * scale), y + h / 2);
  drawWeatherPill(ctx, x + Math.round(148 * scale), y + Math.round(4 * scale), WEATHER[tomorrow].label, WEATHER[tomorrow].color, scale);

  if (showAfter && after) {
    ctx.fillStyle = SUBTLE;
    ctx.fillText('After', x + Math.round(220 * scale), y + h / 2);
    drawWeatherPill(ctx, x + Math.round(254 * scale), y + Math.round(4 * scale), WEATHER[after].label, WEATHER[after].color, scale);
  }

  ctx.restore();
  void TEXT_COLOR;
}

function drawWeatherPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
  scale: number = 1.0,
): void {
  const pillH = Math.round(14 * scale);
  const padX = Math.round(6 * scale);
  ctx.font = `bold ${Math.round(10 * scale)}px ui-monospace, monospace`;
  const w = ctx.measureText(label).width + padX * 2;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, pillH);
  ctx.fillStyle = '#1A1426';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + padX, y + pillH / 2);
}

/**
 * Renders a cheap procedural rain overlay on top of the world. Diagonal
 * pixel streaks at a low density so the framerate doesn't suffer on
 * smaller machines. Storm pulses brighter.
 */
export function drawRainOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  intense: boolean,
  nowMs: number,
): void {
  const count = intense ? 110 : 60;
  const speed = intense ? 0.4 : 0.2;
  ctx.save();
  ctx.fillStyle = intense ? 'rgba(180, 200, 240, 0.55)' : 'rgba(180, 200, 240, 0.35)';
  for (let i = 0; i < count; i++) {
    // Pseudo-random position per drop, animated by nowMs.
    const seed = i * 73.13;
    const baseX = (seed * 91) % (canvasW + 40);
    const baseY = ((seed * 47 + nowMs * speed) % (canvasH + 40));
    const x = Math.floor(baseX) - 20;
    const y = Math.floor(baseY) - 20;
    // Each drop is a 1px wide, 4-6px tall diagonal streak.
    ctx.fillRect(x, y, 1, intense ? 6 : 4);
  }
  if (intense) {
    // Faint blue tint over the whole scene during storms.
    ctx.fillStyle = 'rgba(30, 40, 80, 0.12)';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }
  ctx.restore();
}
