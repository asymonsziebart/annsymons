// Banner layout — the geometry for the top-center celebration ribbons
// (birthday + festival) so they honour the HUD scale like the top bar,
// stamina bar, and right-column widgets already do.
//
// Both banners were hard-coded at h=18, an 11px font, and y=36 (just
// under the unscaled 32px top bar). At HUD scale 1.25x / 1.5x the top bar
// grew but the ribbons didn't — they overlapped the taller bar and read
// at the wrong size. This pure module is the single source of truth for
// the ribbon stack: given the scale it returns the scaled height, font
// px, padding, and the Y of each banner row so the festival ribbon
// stacks cleanly under the birthday one.
//
// At scale 1.0 it reproduces the historical fixed values exactly (h=18,
// font=11, y=36, second row at y=54) so nothing moves for the default HUD.

/** Base (1.0x) top-bar height — mirrors hud.ts drawTopBar. */
export const BANNER_TOP_BAR_BASE_H = 32;
/** Base ribbon height (1.0x). */
export const BANNER_BASE_H = 18;
/** Base ribbon font size in px (1.0x). */
export const BANNER_BASE_FONT_PX = 11;
/** Base horizontal text padding either side (1.0x). */
export const BANNER_BASE_PAD_X = 12;
/** Base gap between the top bar and the first ribbon (1.0x): 36 - 32 = 4. */
export const BANNER_BASE_TOP_GAP = 4;

export interface BannerLayout {
  /** The clamped scale the widget multiplies its internals by. */
  scale: number;
  /** Scaled ribbon height. */
  height: number;
  /** Scaled font size in px. */
  fontPx: number;
  /** Scaled horizontal padding either side of the text. */
  padX: number;
  /** Y of the FIRST ribbon row (birthday, or festival when alone). */
  firstY: number;
  /** Y of the SECOND ribbon row (festival, when the birthday is also up). */
  secondY: number;
}

/**
 * Clamp the HUD scale to the same 1..2 range the top bar uses so a bad
 * setting can never explode the layout. Pure.
 */
export function clampBannerScale(hudScale: number): number {
  return Math.max(1, Math.min(2, hudScale));
}

/**
 * Compute the ribbon stack geometry for a given HUD scale. The first
 * ribbon sits a scaled gap below the scaled top bar; the second sits one
 * ribbon-height below the first. Every size scales by the clamped factor.
 *
 * At scale 1.0 this reproduces the historical fixed values exactly
 * (h=18, font=11, padX=12, firstY=36, secondY=54).
 */
export function bannerLayout(hudScale: number): BannerLayout {
  const scale = clampBannerScale(hudScale);
  const topBarH = Math.round(BANNER_TOP_BAR_BASE_H * scale);
  const gap = Math.round(BANNER_BASE_TOP_GAP * scale);
  const height = Math.round(BANNER_BASE_H * scale);
  const firstY = topBarH + gap;
  return {
    scale,
    height,
    fontPx: Math.round(BANNER_BASE_FONT_PX * scale),
    padX: Math.round(BANNER_BASE_PAD_X * scale),
    firstY,
    secondY: firstY + height,
  };
}
