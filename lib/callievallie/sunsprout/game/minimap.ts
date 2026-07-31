// Minimap model — pure helpers that turn the World into a compact
// colour grid plus a set of labelled landmark markers for the `9`
// minimap overlay. Keeping the projection math here (rather than in the
// canvas widget) means the landmark placement and tile-colour mapping are
// unit-testable without a rendering context.

import type { World, TileType } from '../world/world';
import type { Player } from '../world/world';
import type { TimeOfDay } from './time';
import { BOARD_X, BOARD_Y, canTurnIn } from './board';
import { CART_X, CART_Y, cartOpen } from './cart';
import { tournamentOpen, alreadyEntered } from './tournament';

/** Per-tile colour on the minimap, keyed by tile type. */
export const MINIMAP_TILE_COLORS: Record<TileType, string> = {
  grass: '#5F9F47',
  tilled: '#7A4E28',
  water: '#3E7BB0',
  path: '#A88F66',
  wood: '#6A4E32',
  stone: '#8A8276',
};

/** A labelled point of interest drawn as a pip + initial on the map. */
export interface MinimapMarker {
  /** Tile-space centre of the landmark. */
  tx: number;
  ty: number;
  /** One-letter glyph drawn in the pip. */
  glyph: string;
  /** Full label for the legend. */
  label: string;
  /** Pip fill colour. */
  color: string;
}

/** Colour + glyph per building kind. */
const BUILDING_STYLE: Record<string, { glyph: string; color: string; label: string }> = {
  farmhouse: { glyph: 'H', color: '#E0A85A', label: 'Home' },
  shop: { glyph: 'S', color: '#C8923A', label: "Vallie's shop" },
  inn: { glyph: 'I', color: '#D06A8A', label: 'Inn' },
  well: { glyph: 'O', color: '#9FB0D0', label: 'Well' },
};

/**
 * Build the landmark markers from the world's buildings plus the cave.
 * The player marker is added separately by the widget (it moves every
 * frame; the landmark set is stable so it can be cached if desired).
 */
export function minimapMarkers(world: World): MinimapMarker[] {
  const markers: MinimapMarker[] = [];
  for (const b of world.buildings) {
    const style = BUILDING_STYLE[b.kind];
    if (!style) continue;
    // Centre of the building footprint.
    markers.push({
      tx: b.x + (b.w - 1) / 2,
      ty: b.y + (b.h - 1) / 2,
      glyph: style.glyph,
      label: style.label,
      color: style.color,
    });
  }
  // Cave outcrop entrance (NE corner landmark from world generation).
  markers.push({ tx: 35, ty: 4, glyph: 'C', label: 'Cave', color: '#8A8276' });
  return markers;
}

/**
 * Project a tile coordinate to a minimap pixel offset within a map of
 * `mapW` x `mapH` device pixels. Returns the top-left of the projected
 * cell. Pure — used by both the tile fill loop and the marker placement
 * so they stay pixel-aligned.
 */
export function projectTile(
  tx: number,
  ty: number,
  worldW: number,
  worldH: number,
  mapW: number,
  mapH: number,
): { px: number; py: number; cellW: number; cellH: number } {
  const cellW = mapW / worldW;
  const cellH = mapH / worldH;
  return {
    px: tx * cellW,
    py: ty * cellH,
    cellW,
    cellH,
  };
}

/**
 * Sample the world tiles down to a flat colour grid of `worldW*worldH`
 * entries in row-major order. Returns the colour strings so the widget
 * can blit them without re-reading tile types every frame.
 */
export function minimapTileColors(world: World): string[] {
  const out: string[] = [];
  for (let ty = 0; ty < world.height; ty++) {
    for (let tx = 0; tx < world.width; tx++) {
      const t = world.getTile(tx, ty).type;
      out.push(MINIMAP_TILE_COLORS[t] ?? MINIMAP_TILE_COLORS.grass);
    }
  }
  return out;
}

/** A soft "do something here right now" ping overlaid on the minimap. */
export interface MinimapPing {
  /** Tile-space centre of the ping. */
  tx: number;
  ty: number;
  /** Pulse ring colour. */
  color: string;
  /** Short reason for the legend / accessibility. */
  reason: string;
}

/** The well tile (centre of the plaza) — tournament + sell point. */
export const WELL_PING_X = 19;
export const WELL_PING_Y = 8;

/**
 * Derive the set of "act here now" pings from the same predicates the
 * rest of the game uses, so the minimap (`9`) highlights tiles that
 * matter at this exact moment without inventing new state:
 *
 *   - the notice board when its weekly quest can be turned in,
 *   - Pip's cart tile while the cart is parked + open,
 *   - the well during tournament hours, before the player has entered.
 *
 * Pure read-only helper — no mutation, deterministic from (player, time).
 * Returns an empty array on a calm day so the overlay adds nothing.
 */
export function minimapPings(player: Player, time: TimeOfDay): MinimapPing[] {
  const pings: MinimapPing[] = [];

  // Weekly board quest ready to hand in.
  if (canTurnIn(player, time)) {
    pings.push({
      tx: BOARD_X,
      ty: BOARD_Y,
      color: '#A3D77A',
      reason: 'Quest ready to turn in',
    });
  }

  // Pip's cart open for business.
  if (cartOpen(time)) {
    pings.push({
      tx: CART_X,
      ty: CART_Y,
      color: '#C8923A',
      reason: 'Pip the Peddler is here',
    });
  }

  // Friendship tournament running and the player hasn't entered yet.
  if (tournamentOpen(time) && !alreadyEntered(player, time)) {
    pings.push({
      tx: WELL_PING_X,
      ty: WELL_PING_Y,
      color: '#C8A0E8',
      reason: 'Tournament at the well',
    });
  }

  return pings;
}

// ---------------------------------------------------------------------
// Pulse helpers — the minimap's two animated cues (the "you are here"
// player-dot ring and the action-ping expanding rings) breathe on a
// shared clock. These pure helpers own the breathe math so the widget
// stays a thin draw layer AND so reduce-motion gating is unit-testable:
// when the player has asked for calm, the cues hold a steady, readable
// state instead of pulsing (mirroring how the rain/snow overlays already
// skip entirely under reduceMotion).
// ---------------------------------------------------------------------

/** Period of the shared minimap pulse clock (ms). */
export const MINIMAP_PULSE_PERIOD_MS = 1200;

/**
 * Alpha for the player-dot "you are here" ring at clock `pulseMs`. With
 * motion on it breathes 0.35..0.75; with reduceMotion it holds a steady
 * mid-bright 0.55 so the dot is still clearly marked without animating.
 */
export function playerDotRingAlpha(pulseMs: number, reduceMotion: boolean): number {
  if (reduceMotion) return 0.55;
  const pulse = 0.5 + 0.5 * Math.sin((pulseMs / MINIMAP_PULSE_PERIOD_MS) * Math.PI * 2);
  return 0.35 + 0.4 * pulse;
}

/** The animated expanding ring of an action ping. */
export interface PingRing {
  /** Expanding ring radius in px (0 when the ring is suppressed). */
  radius: number;
  /** Expanding ring stroke alpha (0 when suppressed). */
  ringAlpha: number;
  /** Whether to draw the expanding ring at all. */
  showRing: boolean;
  /** Radius of the always-drawn solid inner dot (px). */
  dotRadius: number;
}

/**
 * Resolve the ping's ring geometry at clock `pulseMs`. With motion on the
 * ring expands (radius 4..11) and fades (alpha 0.75..0) on the phase, with
 * a small 2px solid inner dot keeping the spot readable at the trough.
 * With reduceMotion the expanding ring is dropped entirely and the inner
 * dot grows to 3px so the location is still clearly marked — no animation,
 * but the player who asked for calm still sees WHERE to act.
 */
export function pingRing(pulseMs: number, reduceMotion: boolean): PingRing {
  if (reduceMotion) {
    return { radius: 0, ringAlpha: 0, showRing: false, dotRadius: 3 };
  }
  const phase = (pulseMs / MINIMAP_PULSE_PERIOD_MS) % 1;
  return {
    radius: 4 + phase * 7,
    ringAlpha: 0.75 * (1 - phase),
    showRing: true,
    dotRadius: 2,
  };
}

/** A colour-swatch + reason row for the minimap's "why is this pinging" key. */
export interface PingLegendRow {
  color: string;
  reason: string;
}

/**
 * Reduce a set of active pings to a de-duplicated legend so a colour-blind
 * player can read WHY a tile is pinging, not just that it is. Each distinct
 * reason appears once, in the order the pings were derived (board -> cart ->
 * tournament). Empty in -> empty out so the caller can hide the legend on a
 * calm day. Pure.
 */
export function pingLegend(pings: readonly MinimapPing[]): PingLegendRow[] {
  const rows: PingLegendRow[] = [];
  const seen = new Set<string>();
  for (const p of pings) {
    if (seen.has(p.reason)) continue;
    seen.add(p.reason);
    rows.push({ color: p.color, reason: p.reason });
  }
  return rows;
}

// ---------------------------------------------------------------------
// Focused-landmark caption — with no mouse, the minimap can still answer
// "what's that pip?" by letting the player cycle a focused landmark with
// a key while the map is open. These pure helpers own the cursor wrap +
// the caption wording so the widget stays a thin draw layer and the
// behaviour is unit-testable.
// ---------------------------------------------------------------------

/**
 * Wrap a focus cursor into the marker list by `delta` (+1 next, -1 prev).
 * Returns 0 for an empty list. Pure modular arithmetic so the cursor
 * never escapes [0, count) no matter how many times it's nudged.
 */
export function cycleFocusIndex(
  current: number,
  count: number,
  delta: number,
): number {
  if (count <= 0) return 0;
  return (((current + delta) % count) + count) % count;
}

/**
 * Caption for the currently focused landmark: its full label plus the
 * integer tile it sits on, e.g. "Vallie's shop  ·  tile 24, 9". Markers
 * carry fractional centres (building footprints), so we round to the
 * nearest tile for a clean readout. Returns null when there's nothing to
 * focus (empty marker list / out-of-range cursor) so the caller hides
 * the caption row.
 */
export function focusedLandmarkCaption(
  markers: readonly MinimapMarker[],
  index: number,
): string | null {
  if (markers.length === 0) return null;
  if (index < 0 || index >= markers.length) return null;
  const m = markers[index];
  const tx = Math.round(m.tx);
  const ty = Math.round(m.ty);
  return `${m.label}  -  tile ${tx}, ${ty}`;
}

