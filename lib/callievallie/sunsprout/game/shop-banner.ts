// Seasonal shop banner — the village visibly notices the calendar.
//
// Vallie's General Goods flies a small cloth banner over its roof that
// swaps colour + motif every season, so a glance at the plaza tells you
// what time of year it is even before you open a panel. Spring blooms,
// Summer suns, Fall leaves, Winter frost.
//
// This module is the PURE half: given the season index it returns the
// banner's palette, a tiny pixel motif bitmap, and a short word. The
// render half (render/shop-banner-sprite.ts) is a thin draw layer that
// blits this descriptor over the shop. Keeping the data here makes the
// per-season look unit-testable without a canvas — the discipline the
// loop relies on (math/data in game/, drawing in render/ + ui/).

import { SEASONS } from './time';

/** Everything the renderer needs to paint the banner for a season. */
export interface ShopBannerStyle {
  /** Main cloth colour. */
  cloth: string;
  /** Shadow / stripe colour, a darker shade of the cloth. */
  clothDark: string;
  /** Motif accent (the flower / sun / leaf / frost colour). */
  accent: string;
  /** Short season word shown under the motif (e.g. "Spring"). */
  label: string;
  /**
   * 5x5 motif bitmap — 1 = accent pixel, 0 = empty. Drawn centred on the
   * banner cloth. Kept tiny + symmetric so it reads at pixel scale.
   */
  motif: ReadonlyArray<ReadonlyArray<0 | 1>>;
}

// 5x5 motifs, one per season. Hand-tuned so each is legible at 1px scale.
const SPRING_BLOOM: ReadonlyArray<ReadonlyArray<0 | 1>> = [
  [0, 1, 0, 1, 0],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
];
const SUMMER_SUN: ReadonlyArray<ReadonlyArray<0 | 1>> = [
  [1, 0, 1, 0, 1],
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [1, 0, 1, 0, 1],
];
const FALL_LEAF: ReadonlyArray<ReadonlyArray<0 | 1>> = [
  [0, 0, 1, 0, 0],
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
];
const WINTER_FROST: ReadonlyArray<ReadonlyArray<0 | 1>> = [
  [1, 0, 1, 0, 1],
  [0, 1, 1, 1, 0],
  [1, 1, 0, 1, 1],
  [0, 1, 1, 1, 0],
  [1, 0, 1, 0, 1],
];

/**
 * Per-season banner style, indexed by the clock's `season` field
 * (0 Spring, 1 Summer, 2 Fall, 3 Winter). Colours are pulled to feel
 * seasonal but stay inside the game's warm cozy palette; monochrome hex,
 * no emoji (git-safe + pixel-friendly).
 */
export const SHOP_BANNER_STYLES: Record<0 | 1 | 2 | 3, ShopBannerStyle> = {
  0: {
    cloth: '#6FB36F',
    clothDark: '#4E8E52',
    accent: '#F2A6D2',
    label: SEASONS[0],
    motif: SPRING_BLOOM,
  },
  1: {
    cloth: '#E2B23C',
    clothDark: '#B98A26',
    accent: '#FFF1B0',
    label: SEASONS[1],
    motif: SUMMER_SUN,
  },
  2: {
    cloth: '#C7703A',
    clothDark: '#9A5226',
    accent: '#F5D98A',
    label: SEASONS[2],
    motif: FALL_LEAF,
  },
  3: {
    cloth: '#7AA8C8',
    clothDark: '#587F9E',
    accent: '#F0F6FF',
    label: SEASONS[3],
    motif: WINTER_FROST,
  },
};

/**
 * Banner style for a season index. Out-of-range / undefined falls back to
 * Spring so a malformed clock never crashes the render. Pure.
 */
export function shopBannerStyle(season: number): ShopBannerStyle {
  const key = ((((season % 4) + 4) % 4) as 0 | 1 | 2 | 3);
  return SHOP_BANNER_STYLES[key];
}

/**
 * Count of lit motif pixels — a cheap sanity hook for tests so each
 * season's glyph is non-empty and they aren't accidentally identical.
 */
export function motifPixelCount(style: ShopBannerStyle): number {
  let n = 0;
  for (const row of style.motif) for (const c of row) n += c;
  return n;
}
