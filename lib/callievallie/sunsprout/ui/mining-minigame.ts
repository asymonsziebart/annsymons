// Mining minigame — slice of the v0.4.0 mining caves feature.
//
// While the pickaxe is in the STRIKING state, a small timing bar appears
// on the HUD just like the fishing reel meter. A cursor sweeps left to
// right across the strike-window once; the player has to press M while
// the cursor sits inside the perfect band to land a clean hit with bonus
// gold. Missing the band still counts as a clean strike — mining, like
// fishing, is cozy not punishing.
//
// Split into a pure math layer (cursor + grade) and a thin draw helper
// that paints onto a CanvasRenderingContext2D, mirroring the fishing
// minigame so the two systems stay symmetrical and trivially testable.

import { MINING } from '../game/mining';

/** Inclusive target zone on the [0,1] cursor axis. */
export interface SwingZone {
  /** Start of the perfect zone (0..1). */
  start: number;
  /** End of the perfect zone (0..1). Must be > start. */
  end: number;
  /** Half-width of the "good" tolerance around the perfect zone. */
  tolerance: number;
}

/** Default tunables for the swing meter. */
export const SWING = {
  /** Default target zone — slightly past centre so the swing has heft. */
  defaultZone: { start: 0.48, end: 0.66, tolerance: 0.14 } as SwingZone,
  /** Bonus gold for a "perfect" landing on top of the gem drop. */
  perfectBonusGold: 12,
  /** Bonus gold for a "good" landing. */
  goodBonusGold: 4,
} as const;

/** Final grade for a strike attempt. */
export type StrikeGrade = 'perfect' | 'good' | 'clean';

/**
 * Returns the cursor position in [0,1] for a given elapsed time within
 * the strike window. A one-shot left-to-right sweep — unlike fishing the
 * cursor does NOT bounce, because the strike window itself is finite.
 * Clamped at both ends so a late tick reads as a fully-extended swing.
 */
export function cursorPosition(
  elapsedMs: number,
  windowMs: number = MINING.strikeWindowMs,
): number {
  if (windowMs <= 0) return 0;
  const t = elapsedMs / windowMs;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

/**
 * Grades a strike attempt given the cursor position at the time of the
 * press and the target zone. Inside the perfect window → 'perfect',
 * within `tolerance` of either edge → 'good', else → 'clean' (still a
 * landed hit, just no bonus).
 */
export function gradeStrike(cursor: number, zone: SwingZone = SWING.defaultZone): StrikeGrade {
  if (cursor >= zone.start && cursor <= zone.end) return 'perfect';
  const distToZone = cursor < zone.start ? zone.start - cursor : cursor - zone.end;
  if (distToZone <= zone.tolerance) return 'good';
  return 'clean';
}

/** Bonus gold awarded for a given strike grade. */
export function gradeBonus(grade: StrikeGrade): number {
  switch (grade) {
    case 'perfect':
      return SWING.perfectBonusGold;
    case 'good':
      return SWING.goodBonusGold;
    case 'clean':
      return 0;
  }
}

/** Cozy short message prefixed to a gem-drop toast. */
export function gradeLabel(grade: StrikeGrade): string {
  switch (grade) {
    case 'perfect':
      return 'Perfect strike!';
    case 'good':
      return 'Solid hit.';
    case 'clean':
      return 'Clean hit!';
  }
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

const BAR_BG = 'rgba(26, 20, 38, 0.85)';
const BAR_BORDER = '#F5C9A0';
const ZONE_PERFECT = '#E8C168';
const ZONE_TOLERANCE = 'rgba(232, 193, 104, 0.35)';
const CURSOR_COLOR = '#F5E9D4';
const LABEL_COLOR = '#F5E9D4';

/**
 * Renders the mining swing-meter. `(x, y)` is the top-left of the bar
 * area (including label). Mirrors `drawFishingBar` so the two HUD
 * elements feel like siblings.
 */
export function drawSwingMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  cursor: number,
  zone: SwingZone = SWING.defaultZone,
  lockedCursor: number | null = null,
  grade: StrikeGrade | null = null,
): void {
  const barH = 14;
  const labelH = 16;
  const totalH = barH + labelH + 6;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Backplate
  ctx.fillStyle = BAR_BG;
  ctx.fillRect(x - 6, y - 4, width + 12, totalH);
  ctx.strokeStyle = BAR_BORDER;
  ctx.strokeRect(x - 5.5, y - 3.5, width + 11, totalH - 1);

  // Label
  ctx.font = 'bold 11px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.fillStyle = LABEL_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const label = grade ? gradeLabel(grade) : 'STRIKE! tap M in the gold';
  ctx.fillText(label, x + width / 2, y);

  // Bar background
  const barY = y + labelH;
  ctx.fillStyle = 'rgba(40, 30, 60, 0.85)';
  ctx.fillRect(x, barY, width, barH);

  // Tolerance band
  const tolStart = Math.max(0, zone.start - zone.tolerance);
  const tolEnd = Math.min(1, zone.end + zone.tolerance);
  ctx.fillStyle = ZONE_TOLERANCE;
  ctx.fillRect(x + tolStart * width, barY, (tolEnd - tolStart) * width, barH);

  // Perfect band
  ctx.fillStyle = ZONE_PERFECT;
  ctx.fillRect(
    x + zone.start * width,
    barY,
    (zone.end - zone.start) * width,
    barH,
  );

  // Cursor (live or locked)
  const drawCursor = lockedCursor ?? cursor;
  const cx = Math.floor(x + drawCursor * width);
  ctx.fillStyle = CURSOR_COLOR;
  ctx.fillRect(cx - 1, barY - 2, 3, barH + 4);

  if (lockedCursor !== null) {
    const liveX = Math.floor(x + cursor * width);
    ctx.fillStyle = 'rgba(245, 233, 212, 0.25)';
    ctx.fillRect(liveX - 1, barY - 2, 3, barH + 4);
  }

  ctx.strokeStyle = BAR_BORDER;
  ctx.strokeRect(x + 0.5, barY + 0.5, width - 1, barH - 1);

  ctx.restore();
}
