// HUD layout — the stacking geometry for the right-hand HUD column.
//
// Three widgets stack down the right edge under the top status bar:
// the weather strip, the sun/moon sky dial, and the almanac highlight
// chip. Each was hard-coded at a fixed Y (40 / 66 / 110) and a fixed
// size, so at HUD scale 1.25x / 1.5x the top bar grew but these three
// didn't — they visually detached from the bar and from each other.
//
// This pure module is the single source of truth for the column: given
// the HUD scale it returns the scaled Y + height of each widget so they
// cascade correctly under a taller top bar. The widgets read their slot
// here and scale their own internals by `scale`, keeping the drawing in
// the ui/* layer and the geometry unit-testable.

/** Base (1.0x) top-bar height — mirrors hud.ts drawTopBar. */
export const TOP_BAR_BASE_H = 32;
/** Gap between the top bar and the first right-column widget (base px). */
export const COLUMN_TOP_MARGIN = 8;
/** Gap between stacked right-column widgets (base px). */
export const COLUMN_GAP = 4;

/** Base heights of the three stacked widgets (1.0x). */
export const WEATHER_STRIP_BASE_H = 22;
export const SKY_DIAL_BASE_H = 40;
export const ALMANAC_CHIP_BASE_H = 20;
/** Base width of the sky dial card (1.0x). */
export const SKY_DIAL_BASE_W = 132;

/** A widget's slot in the column: its top Y and its scaled height. */
export interface ColumnSlot {
  y: number;
  height: number;
}

export interface RightColumnLayout {
  /** The clamped scale every widget should multiply its internals by. */
  scale: number;
  weatherStrip: ColumnSlot;
  skyDial: ColumnSlot & { width: number };
  almanacChip: ColumnSlot;
}

/**
 * Clamp the HUD scale to the same 1..2 range the top bar uses so a bad
 * setting can never explode the layout. Pure.
 */
export function clampHudScale(hudScale: number): number {
  return Math.max(1, Math.min(2, hudScale));
}

/**
 * Compute the right-column stack for a given HUD scale. Y positions
 * cascade: the weather strip sits a margin below the (scaled) top bar,
 * the sky dial a gap below the strip, the chip a gap below the dial.
 * Every height is the base height times the clamped scale.
 *
 * At scale 1.0 this reproduces the historical fixed positions exactly
 * (weather y=40, sky-dial y=66, chip y=110), so nothing moves for the
 * default HUD.
 */
export function rightColumnLayout(hudScale: number): RightColumnLayout {
  const scale = clampHudScale(hudScale);
  const topBarH = Math.round(TOP_BAR_BASE_H * scale);
  const margin = Math.round(COLUMN_TOP_MARGIN * scale);
  const gap = Math.round(COLUMN_GAP * scale);

  const weatherH = Math.round(WEATHER_STRIP_BASE_H * scale);
  const skyH = Math.round(SKY_DIAL_BASE_H * scale);
  const chipH = Math.round(ALMANAC_CHIP_BASE_H * scale);

  const weatherY = topBarH + margin;
  const skyY = weatherY + weatherH + gap;
  const chipY = skyY + skyH + gap;

  return {
    scale,
    weatherStrip: { y: weatherY, height: weatherH },
    skyDial: { y: skyY, height: skyH, width: Math.round(SKY_DIAL_BASE_W * scale) },
    almanacChip: { y: chipY, height: chipH },
  };
}
