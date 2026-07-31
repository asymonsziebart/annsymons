// Stamina bar — small HUD widget tucked between the top status bar and
// the quest panel. Shows current/max with a colour-coded fill that
// drains warmly: green at full, amber at half, red below a quarter.

import type { Player } from '../world/world';
import {
  getStamina,
  MAX_STAMINA,
  staminaWarnLevel,
  staminaWarnIntensity,
  staminaWarnColor,
} from '../game/stamina';

const BG = 'rgba(26, 20, 38, 0.85)';
const BORDER = '#4a3b6e';
const TEXT = '#F5E9D4';
const LABEL = '#F5C9A0';
const FILL_OK = '#7FC97F';
const FILL_LOW = '#F0C24A';
const FILL_CRIT = '#E07B7B';

/**
 * Draws a thin stamina bar in the top-left corner, just below the
 * status bar. Hidden when the pool is undefined (legacy saves load
 * defaults so this should be effectively always shown).
 *
 * When the pool runs low the frame border pulses a warning colour (amber
 * when only a few actions remain, red once the player can't afford a mine
 * swing) so they notice BEFORE an action silently fails — the same
 * heads-up the hotbar gives a low seed slot. Reduce-motion holds the
 * border steady instead of breathing.
 */
export function drawStaminaBar(
  ctx: CanvasRenderingContext2D,
  player: Player,
  canvasW: number,
  hudScale: number = 1.0,
  nowMs: number = 0,
  reduceMotion: boolean = false,
): void {
  void canvasW;
  const scale = Math.max(1, Math.min(2, hudScale));
  const s = getStamina(player);
  const x = 12;
  const y = Math.round(36 * scale) + 4;
  const w = Math.round(140 * scale);
  const h = Math.round(14 * scale);
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Frame.
  ctx.fillStyle = BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = BORDER;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Fill.
  const ratio = Math.max(0, Math.min(1, s.current / s.max));
  const fillW = Math.floor((w - 4) * ratio);
  const fillColor = ratio > 0.5 ? FILL_OK : ratio > 0.25 ? FILL_LOW : FILL_CRIT;
  ctx.fillStyle = fillColor;
  ctx.fillRect(x + 2, y + 2, fillW, h - 4);

  // Low-energy warning border — pulses over the frame when the pool is
  // running out, so the cue reads even at a glance away from the fill.
  const level = staminaWarnLevel(s);
  if (level !== 'none') {
    const pulse = staminaWarnIntensity(level, nowMs, reduceMotion);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = staminaWarnColor(level);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.restore();
  }

  // Label.
  ctx.font = `bold ${Math.round(10 * scale)}px ui-monospace, monospace`;
  ctx.fillStyle = LABEL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('STA', x + 6, y + h / 2);

  // Counter.
  ctx.textAlign = 'right';
  ctx.fillStyle = TEXT;
  ctx.fillText(`${s.current}/${s.max}`, x + w - 6, y + h / 2);

  ctx.restore();
  // Silence unused-import warning in case the bar is wired before MAX is needed.
  void MAX_STAMINA;
}
