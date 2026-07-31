// Fishing minigame — slice 3 of the v0.2.0 fishing pond.
//
// While the rod is in the REELING state, a small timing bar appears on
// the HUD. A cursor sweeps back and forth across the bar at a fixed
// period and the player has to press F again while the cursor is inside
// a marked target zone to land a "perfect" catch (bonus gold). Missing
// the zone still nets a regular catch — fishing is cozy, not punishing.
//
// This module is deliberately split into a pure math layer (cursor /
// grade) that vitest can exercise, plus a thin `drawFishingBar` that
// paints onto a CanvasRenderingContext2D. The math layer never touches
// the DOM, so the unit tests run in jsdom-free node.

/** Inclusive target zone on the [0,1] cursor axis. */
export interface TimingZone {
  /** Start of the perfect zone (0..1). */
  start: number;
  /** End of the perfect zone (0..1). Must be > start. */
  end: number;
  /** Half-width of the "good" tolerance around the perfect zone. */
  tolerance: number;
}

/** Default tunables for the timing bar. */
export const MINIGAME = {
  /** Cursor sweep period in milliseconds (one full there-and-back). */
  periodMs: 1400,
  /** Default target zone — slightly off-centre to feel intentional. */
  defaultZone: { start: 0.42, end: 0.58, tolerance: 0.12 } as TimingZone,
  /** Bonus gold for a "perfect" landing. */
  perfectBonusGold: 8,
  /** Bonus gold for a "good" landing. */
  goodBonusGold: 3,
} as const;

/** Final grade for a reel attempt. */
export type ReelGrade = 'perfect' | 'good' | 'miss';

/**
 * Returns the cursor position in [0,1] for a given elapsed time in the
 * REELING state. Uses a triangle wave so the cursor moves at constant
 * speed and turns around crisply at the edges (sine waves slow at the
 * ends and feel mushy in timing bars).
 */
export function cursorPosition(elapsedMs: number, periodMs: number = MINIGAME.periodMs): number {
  if (periodMs <= 0) return 0;
  const t = ((elapsedMs % periodMs) + periodMs) % periodMs;
  const half = periodMs / 2;
  // Tri-wave: 0 → 1 → 0 over one period.
  return t < half ? t / half : 1 - (t - half) / half;
}

/**
 * Grades a reel attempt given the cursor position at the time of the
 * press and the target zone. Inside the perfect window → 'perfect',
 * within `tolerance` of either edge → 'good', else → 'miss'.
 */
export function gradeReel(cursor: number, zone: TimingZone = MINIGAME.defaultZone): ReelGrade {
  if (cursor >= zone.start && cursor <= zone.end) return 'perfect';
  const distToZone =
    cursor < zone.start ? zone.start - cursor : cursor - zone.end;
  if (distToZone <= zone.tolerance) return 'good';
  return 'miss';
}

/** Bonus gold awarded for a given grade. */
export function gradeBonus(grade: ReelGrade): number {
  switch (grade) {
    case 'perfect':
      return MINIGAME.perfectBonusGold;
    case 'good':
      return MINIGAME.goodBonusGold;
    case 'miss':
      return 0;
  }
}

/** Cozy short message paired with a catch toast. */
export function gradeLabel(grade: ReelGrade): string {
  switch (grade) {
    case 'perfect':
      return 'Perfect catch!';
    case 'good':
      return 'Nice catch.';
    case 'miss':
      return 'Caught it.';
  }
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------

const BAR_BG = 'rgba(26, 20, 38, 0.85)';
const BAR_BORDER = '#F5C9A0';
const ZONE_PERFECT = '#7BD66B';
const ZONE_TOLERANCE = 'rgba(123, 214, 107, 0.35)';
const CURSOR_COLOR = '#F5E9D4';
const LABEL_COLOR = '#F5E9D4';

/**
 * Renders the fishing timing bar. `(x, y)` is the top-left of the bar
 * area (including label). `lockedCursor`, if non-null, freezes the
 * cursor at the moment the player pressed F so they can read their
 * grade before the reel animation finishes.
 */
export function drawFishingBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  cursor: number,
  zone: TimingZone = MINIGAME.defaultZone,
  lockedCursor: number | null = null,
  grade: ReelGrade | null = null,
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
  const label = grade ? gradeLabel(grade) : 'REEL! tap F in the green';
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

  // If locked, draw a thin shadow of the live cursor so motion still reads
  // (gives the bar a "frozen" feel without going dead).
  if (lockedCursor !== null) {
    const liveX = Math.floor(x + cursor * width);
    ctx.fillStyle = 'rgba(245, 233, 212, 0.25)';
    ctx.fillRect(liveX - 1, barY - 2, 3, barH + 4);
  }

  // Border on top
  ctx.strokeStyle = BAR_BORDER;
  ctx.strokeRect(x + 0.5, barY + 0.5, width - 1, barH - 1);

  ctx.restore();
}
