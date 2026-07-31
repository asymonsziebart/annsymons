// HUD: top status bar (day / season / time / gold) and bottom hotbar.
//
// The HUD is rendered in screen space after the world has been drawn,
// so it floats above everything. We deliberately keep the font stack
// to monospace and integer-snap every coordinate so the HUD looks like
// it belongs to a pixel-art game.

import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import { SEASONS } from '../game/time';
import { CROPS, CROP_KEYS, drawCropSprite } from '../game/crops';
import { seedWarnLevel, seedWarnIntensity, SEED_WARN_COLOR } from '../game/hotbar';
import { hotbarLayout } from '../game/hotbar-layout';
import type { Quest } from '../game/quests';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const ACCENT = '#F5C9A0';
const SLOT_BG = 'rgba(40, 30, 60, 0.92)';
const SLOT_BORDER = '#6b5b8e';
const SLOT_SELECTED = '#F5C9A0';
const COIN_COLOR = '#F0C24A';
const COIN_OUTLINE = '#B89224';

/** Format HH:MM AM/PM. */
function fmtTime(time: TimeOfDay): string {
  const h12 = time.hour % 12 === 0 ? 12 : time.hour % 12;
  const ampm = time.hour < 12 ? 'AM' : 'PM';
  const mm = time.minute.toString().padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

/** Draws the top status bar. */
function drawTopBar(
  ctx: CanvasRenderingContext2D,
  player: Player,
  time: TimeOfDay,
  canvasW: number,
  hudScale: number = 1.0,
): void {
  const scale = Math.max(1, Math.min(2, hudScale));
  const barH = Math.round(32 * scale);
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(0, 0, canvasW, barH);
  ctx.fillStyle = PANEL_BORDER;
  ctx.fillRect(0, barH, canvasW, 1);

  const fontPx = Math.round(14 * scale);
  ctx.font = `bold ${fontPx}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.textBaseline = 'middle';

  // Left: day + season
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'left';
  ctx.fillText(`Day ${time.day} · ${SEASONS[time.season]}`, 12, barH / 2);

  // Center: clock
  ctx.textAlign = 'center';
  ctx.fillStyle = ACCENT;
  ctx.fillText(fmtTime(time), canvasW / 2, barH / 2);

  // Right: gold
  ctx.textAlign = 'right';
  const goldText = `${player.gold}g`;
  const goldX = canvasW - 12;
  // Draw a small coin indicator to the left of the gold number.
  const tw = ctx.measureText(goldText).width;
  const coinX = Math.floor(goldX - tw - 16);
  const coinY = Math.floor(barH / 2);
  const coinR = Math.round(7 * scale);
  ctx.fillStyle = COIN_OUTLINE;
  ctx.beginPath();
  ctx.arc(coinX, coinY, coinR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COIN_COLOR;
  ctx.beginPath();
  ctx.arc(coinX, coinY, Math.max(3, coinR - 2), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(goldText, goldX, barH / 2);
}

/** Draws the bottom hotbar with crop slots + watering can. */
function drawHotbar(
  ctx: CanvasRenderingContext2D,
  player: Player,
  canvasW: number,
  canvasH: number,
  nowMs: number,
  reduceMotion: boolean,
  hudScale: number = 1.0,
): void {
  const slots = CROP_KEYS.length + 1; // crops + watering can
  // Scale the whole strip with the HUD so the action bar matches the top
  // bar / stamina bar instead of holding a fixed 48px slot.
  const L = hotbarLayout(hudScale, slots, canvasW, canvasH);
  const slotSize = L.slotSize;
  const gap = L.gap;
  const startX = L.startX;
  const y = L.y;
  const fontPx = L.fontPx;
  const badge = Math.round(4 * L.scale);

  const selected = (player as Player & { selectedSlot?: number }).selectedSlot ?? 0;

  for (let i = 0; i < slots; i++) {
    const x = startX + i * (slotSize + gap);
    ctx.fillStyle = SLOT_BG;
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = i === selected ? SLOT_SELECTED : SLOT_BORDER;
    ctx.lineWidth = i === selected ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, slotSize - 1, slotSize - 1);

    if (i < CROP_KEYS.length) {
      // Crop seed slot.
      const cropKey = CROP_KEYS[i];
      const crop = CROPS[cropKey];
      // Draw a small ripe-stage preview centred. The sprite art is drawn at
      // a fixed pixel size, so grow it with the slot via a scoped transform
      // anchored at the slot centre (no-op at 1.0x).
      ctx.save();
      ctx.translate(x + slotSize / 2, y + slotSize - Math.round(8 * L.scale));
      ctx.scale(L.spriteScale, L.spriteScale);
      drawCropSprite(ctx, 0, 0, cropKey, crop.growthStages - 1);
      ctx.restore();
      // Seed count badge.
      const count = player.inventory[cropKey] ?? 0;
      // Low-stock warning: pulse an amber border when the stack is down
      // to its last planting (or empty) so the player notices before
      // trying to plant nothing. The selected slot keeps its bright
      // selection border; the warning rides on top as an overlay stroke.
      const level = seedWarnLevel(count);
      if (level !== 'none') {
        const pulse = seedWarnIntensity(level, nowMs, reduceMotion);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = SEED_WARN_COLOR;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, slotSize - 2, slotSize - 2);
        ctx.restore();
      }
      ctx.fillStyle = level === 'empty' ? SEED_WARN_COLOR : TEXT_COLOR;
      ctx.font = `bold ${fontPx}px ui-monospace, monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(String(count), x + slotSize - badge, y + badge - 1);
      // Hotkey indicator.
      ctx.fillStyle = ACCENT;
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + badge, y + badge - 1);
    } else {
      // Watering can slot — the can sprite is a fixed 16x16, so centre +
      // scale it the same way as the crop sprites.
      ctx.save();
      ctx.translate(x + slotSize / 2, y + slotSize / 2);
      ctx.scale(L.spriteScale, L.spriteScale);
      drawWateringCan(ctx, -8, -8);
      ctx.restore();
      ctx.fillStyle = ACCENT;
      ctx.font = `bold ${fontPx}px ui-monospace, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('W', x + badge, y + badge - 1);
    }
  }
}

function drawWateringCan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  // Tiny watering can: 16x16 sprite.
  const body = '#4A7BC8';
  const dark = '#345A9A';
  const trim = '#A2C4EE';
  // Body
  ctx.fillStyle = body;
  ctx.fillRect(x + 3, y + 6, 10, 7);
  // Spout
  ctx.fillStyle = body;
  ctx.fillRect(x + 12, y + 4, 3, 2);
  ctx.fillRect(x + 14, y + 3, 2, 3);
  // Handle
  ctx.fillStyle = dark;
  ctx.fillRect(x + 1, y + 7, 3, 4);
  // Top trim
  ctx.fillStyle = trim;
  ctx.fillRect(x + 3, y + 5, 10, 1);
  // Water droplet hint
  ctx.fillStyle = '#7BB3DA';
  ctx.fillRect(x + 15, y + 7, 1, 1);
}

/** Draws active quests in the top-left, just below the status bar. */
function drawQuestPanel(
  ctx: CanvasRenderingContext2D,
  player: Player,
  hudScale: number = 1.0,
): void {
  const quests = (player.quests as Quest[]) || [];
  const open = quests.filter((q) => !q.complete);
  if (open.length === 0) return;
  const scale = Math.max(1, Math.min(2, hudScale));
  const x = 12;
  const y = Math.round(40 * scale);
  const w = Math.round(230 * scale);
  const lineH = Math.round(18 * scale);
  const h = Math.round(22 * scale) + open.length * lineH;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = ACCENT;
  ctx.font = `bold ${Math.round(12 * scale)}px ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('quests', x + 8, y + Math.round(5 * scale));
  ctx.font = `${Math.round(11 * scale)}px ui-monospace, monospace`;
  ctx.fillStyle = TEXT_COLOR;
  for (let i = 0; i < open.length; i++) {
    const q = open[i];
    const line = `${q.name}  (${q.progress}/${q.goal})`;
    ctx.fillText(line, x + 8, y + Math.round(20 * scale) + i * lineH);
  }
}

/** Public entry: draws the whole HUD on top of the world. */
export function drawHUD(
  ctx: CanvasRenderingContext2D,
  player: Player,
  time: TimeOfDay,
  canvasW: number,
  canvasH: number,
  hudScale: number = 1.0,
  nowMs: number = 0,
  reduceMotion: boolean = false,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  drawTopBar(ctx, player, time, canvasW, hudScale);
  drawHotbar(ctx, player, canvasW, canvasH, nowMs, reduceMotion, hudScale);
  drawQuestPanel(ctx, player, hudScale);
  ctx.restore();
}
