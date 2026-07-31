// Hotbar layout — the geometry for the bottom seed/can hotbar so it honours
// the HUD scale like the top bar, quest panel, stamina bar, and right-column
// widgets already do.
//
// The hotbar was the last core HUD surface still hard-coded: 48px slots, a
// 6px gap, a 12px bottom margin, an 11px badge font. At HUD scale 1.25x /
// 1.5x everything else grew but the action bar didn't, so it read small and
// detached on a scaled HUD. This pure module is the single source of truth
// for the slot strip: given the scale + the slot count + the canvas size it
// returns the scaled slot box, the gap, the bottom Y, the centred start X,
// and the badge font px, plus the per-sprite scale factor the widget uses to
// grow the fixed-pixel crop / watering-can sprites with a ctx transform.
//
// At scale 1.0 it reproduces the historical fixed values exactly (slot 48,
// gap 6, font 11, y = canvasH - 60) so nothing moves for the default HUD.

/** Base (1.0x) slot edge length. */
export const HOTBAR_BASE_SLOT = 48;
/** Base (1.0x) gap between slots. */
export const HOTBAR_BASE_GAP = 6;
/** Base (1.0x) margin from the bottom of the canvas to the slot bottom. */
export const HOTBAR_BASE_BOTTOM_MARGIN = 12;
/** Base (1.0x) badge font size (the count / hotkey glyphs). */
export const HOTBAR_BASE_FONT_PX = 11;
/** The slot size the sprites were hand-drawn against — the scale-1 baseline. */
export const HOTBAR_SPRITE_BASE_SLOT = 48;

export interface HotbarLayout {
  /** The clamped scale every internal multiplies by. */
  scale: number;
  /** Scaled slot edge length. */
  slotSize: number;
  /** Scaled gap between slots. */
  gap: number;
  /** Scaled badge font size in px. */
  fontPx: number;
  /** Top-left X of the FIRST slot (the whole strip is centred). */
  startX: number;
  /** Top Y of every slot row. */
  y: number;
  /** Total strip width (all slots + gaps). */
  totalW: number;
  /**
   * Factor to scale the fixed-pixel sprites by so they grow with the slot.
   * == slotSize / HOTBAR_SPRITE_BASE_SLOT, i.e. exactly the clamped scale,
   * so at 1.0x the sprites draw at their native size.
   */
  spriteScale: number;
}

/**
 * Clamp the HUD scale to the same 1..2 range the rest of the HUD uses so a
 * bad setting can never explode the layout. Pure.
 */
export function clampHotbarScale(hudScale: number): number {
  return Math.max(1, Math.min(2, hudScale));
}

/**
 * Compute the hotbar strip geometry for a given HUD scale, slot count, and
 * canvas size. The strip is horizontally centred and pinned a scaled margin
 * above the canvas bottom; every dimension scales by the clamped factor.
 *
 * At scale 1.0 with the historical 4-slot strip this reproduces the old
 * fixed values exactly (slot 48, gap 6, font 11, y = canvasH - 60).
 */
export function hotbarLayout(
  hudScale: number,
  slots: number,
  canvasW: number,
  canvasH: number,
): HotbarLayout {
  const scale = clampHotbarScale(hudScale);
  const slotSize = Math.round(HOTBAR_BASE_SLOT * scale);
  const gap = Math.round(HOTBAR_BASE_GAP * scale);
  const margin = Math.round(HOTBAR_BASE_BOTTOM_MARGIN * scale);
  const totalW = slots * slotSize + Math.max(0, slots - 1) * gap;
  return {
    scale,
    slotSize,
    gap,
    fontPx: Math.round(HOTBAR_BASE_FONT_PX * scale),
    startX: Math.floor((canvasW - totalW) / 2),
    y: canvasH - slotSize - margin,
    totalW,
    spriteScale: slotSize / HOTBAR_SPRITE_BASE_SLOT,
  };
}
