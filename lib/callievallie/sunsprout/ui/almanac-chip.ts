// Almanac HUD chip — a tiny one-line pill that surfaces the almanac's
// top row ("Tomorrow: Vallie's birthday") directly on the HUD so the
// player sees the most imminent event without opening the `0` planner.
//
// Only renders when an event lands Today or Tomorrow; quieter stretches
// show nothing so the HUD stays uncluttered. Sits in the right-hand HUD
// column, stacked just below the sky dial, sharing its panel chrome. A
// left colour-rail tints the chip by event kind (matching the almanac
// panel's KIND_STYLE) so a glance reads the category.
//
// Pure draw layer — all the "what's next" logic lives in almanac.ts.

import type { TimeOfDay } from '../game/time';
import type { Player } from '../world/world';
import { almanacHighlight, highlightChipText, type AlmanacKind } from '../game/almanac';
import { rightColumnLayout } from '../game/hud-layout';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const TODAY = '#A3D77A';

/** Per-kind rail colour — mirrors the almanac panel's KIND_STYLE. */
const KIND_COLOR: Record<AlmanacKind, string> = {
  personal: '#E25C7A',
  festival: '#9ECDB5',
  birthday: '#F5C9A0',
  cart: '#C8923A',
  tournament: '#C8A0E8',
};

/**
 * Draws the almanac highlight chip, right-aligned under the sky dial.
 * No-op when nothing is due Today/Tomorrow. `canvasW` right-aligns it;
 * `hudScale` grows the chip + its Y in lockstep with the rest of the
 * right HUD column so it stays attached when the HUD is scaled up.
 * `player` (optional) folds the player's own hangout dates into the
 * highlight so a personal commitment due tomorrow surfaces on the HUD.
 */
export function drawAlmanacChip(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  canvasW: number,
  hudScale: number = 1.0,
  player?: Player,
): void {
  const hit = almanacHighlight(time, 1, player);
  if (!hit) return;

  const text = highlightChipText(hit);
  const rail = KIND_COLOR[hit.kind];
  const isToday = hit.daysUntil <= 0;

  const layout = rightColumnLayout(hudScale);
  const scale = layout.scale;
  const height = layout.almanacChip.height;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.font = `bold ${Math.round(10 * scale)}px ui-monospace, monospace`;
  const padL = Math.round(12 * scale); // text inset (leaves room for the rail)
  const padR = Math.round(10 * scale);
  const w = Math.ceil(ctx.measureText(text).width) + padL + padR;
  const x = canvasW - w - Math.round(12 * scale);
  const y = layout.almanacChip.y;

  // Frame.
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, height);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, height - 1);

  // Left colour rail keyed to the event kind.
  ctx.fillStyle = rail;
  ctx.fillRect(x + Math.round(3 * scale), y + Math.round(4 * scale), Math.round(3 * scale), height - Math.round(8 * scale));

  // Text — "Today" highlighted green, "Tomorrow" in the warm body colour.
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = isToday ? TODAY : TEXT_COLOR;
  ctx.fillText(text, x + padL, y + height / 2 + 0.5);

  ctx.restore();
}
