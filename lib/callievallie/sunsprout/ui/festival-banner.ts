// Festival banner — a thin centered ribbon for any active festival.
// Mirrors the birthday-banner chrome but uses a cooler teal-stained
// accent so the player can tell the two banners apart at a glance.
// Stacks under the birthday banner when both fire on the same day.

import type { TimeOfDay } from '../game/time';
import { festivalBanner } from '../game/festivals';
import { birthdayBanner } from '../game/birthdays';
import { bannerLayout } from '../game/banner-layout';

const ACCENT = '#9ECDB5';
const TEXT_COLOR = '#1A1426';

/** Draw the festival ribbon if a festival is active today. No-op otherwise. */
export function drawFestivalBanner(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
  hudScale: number = 1.0,
): void {
  const msg = festivalBanner(time);
  if (!msg) return;
  // Scale with the HUD like the birthday ribbon, and use the shared layout
  // so the two ribbons stack at the same scaled height with no overlap.
  const L = bannerLayout(hudScale);
  ctx.save();
  ctx.font = `bold ${L.fontPx}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const w = ctx.measureText(msg).width + L.padX * 2;
  const x = Math.floor((canvasW - w) / 2);
  // Sit on the second ribbon row when the birthday banner is also up, else
  // take the first row — so a lone festival hugs the top bar cleanly.
  const y = birthdayBanner(time) ? L.secondY : L.firstY;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(x, y, w, L.height);
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(msg, canvasW / 2, y + L.height / 2);
  ctx.restore();
}
