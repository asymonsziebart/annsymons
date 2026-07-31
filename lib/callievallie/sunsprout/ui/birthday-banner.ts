// Birthday banner — a thin centered ribbon at the top of the screen
// shown on any NPC's birthday. Matches the existing HUD palette so it
// reads as "part of the game chrome" not a popup.

import type { TimeOfDay } from '../game/time';
import { birthdayBanner } from '../game/birthdays';
import { bannerLayout } from '../game/banner-layout';

const ACCENT = '#F5C9A0';
const TEXT_COLOR = '#1A1426';

/** Draw the centered birthday ribbon if today is a celebrant's day. No-op otherwise. */
export function drawBirthdayBanner(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
  hudScale: number = 1.0,
): void {
  const msg = birthdayBanner(time);
  if (!msg) return;
  // Scale the ribbon with the HUD so it tucks under the (scaled) top bar
  // and reads at the chosen size, instead of holding a fixed 18px / 11px.
  const L = bannerLayout(hudScale);
  ctx.save();
  ctx.font = `bold ${L.fontPx}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const w = ctx.measureText(msg).width + L.padX * 2;
  const x = Math.floor((canvasW - w) / 2);
  // Sits just under the top status bar (the first ribbon row).
  const y = L.firstY;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(x, y, w, L.height);
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(msg, canvasW / 2, y + L.height / 2);
  ctx.restore();
}
