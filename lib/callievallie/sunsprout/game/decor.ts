// Farmhouse decor — premium cosmetics sold at Pip's cart.
//
// The cart already sells a "Brass Lantern" trinket the player can buy.
// Decor extends that into a proper room-makeover system: each piece is
// a {wall, roof, accent} palette swap that retints the farmhouse
// exterior when applied. Owning a piece unlocks it; the player can
// then "apply" any unlocked piece to re-skin the home for free.
//
// Two equip slots:
//   wallpaper  — swaps the wall + window-trim colour
//   floor      — swaps the roof + foundation accent
//
// Pure module: no IO, no canvas. The Game persists the active
// selection on `player.decor`, the cart wires purchases through
// buyDecor(), and the renderer reads colors via decorPalette().

import type { Player } from '../world/world';

/** Storage key the decor module attaches to the Player. */
export interface DecorState {
  /** Catalog keys the player has unlocked (owns). */
  owned: string[];
  /** Active wallpaper key, or null when running the default skin. */
  activeWallpaper: string | null;
  /** Active floor key, or null when running the default skin. */
  activeFloor: string | null;
}

/** One catalog entry — buyable piece + the palette it paints. */
export interface DecorPiece {
  key: string;
  label: string;
  slot: 'wallpaper' | 'floor';
  /** Cost in gold at Pip's cart. */
  price: number;
  /** Per-piece colour overrides applied to the farmhouse renderer. */
  swap: {
    /** Replaces the wall fill when this piece is the active wallpaper. */
    wall?: string;
    /** Replaces the darker wall band when this piece is the active wallpaper. */
    wallDark?: string;
    /** Replaces the trim (door, window frame) when active wallpaper. */
    trim?: string;
    /** Replaces the roof colour when this piece is the active floor. */
    roof?: string;
    /** Replaces the dark roof eaves when active floor. */
    roofDark?: string;
    /** Replaces the window-pane glow when active wallpaper. */
    window?: string;
  };
  /** One-line flavour shown on the cart menu. */
  flavor: string;
}

/** Catalog of unlockable decor. Add at the END to keep keys stable. */
export const DECOR_CATALOG: DecorPiece[] = [
  {
    key: 'wallpaper-rose',
    label: 'Callie Wallpaper',
    slot: 'wallpaper',
    price: 280,
    swap: {
      wall: '#E8C5C5',
      wallDark: '#B49494',
      trim: '#6A3848',
      window: '#FFE0E0',
    },
    flavor: 'Pip swears it matches the inn drapery.',
  },
  {
    key: 'wallpaper-mint',
    label: 'Mint Wallpaper',
    slot: 'wallpaper',
    price: 320,
    swap: {
      wall: '#B8D8C0',
      wallDark: '#7CA08A',
      trim: '#3A5A45',
      window: '#E0F4E4',
    },
    flavor: 'Smells faintly of the herb forage at dawn.',
  },
  {
    key: 'wallpaper-cobalt',
    label: 'Cobalt Wallpaper',
    slot: 'wallpaper',
    price: 420,
    swap: {
      wall: '#7C92BC',
      wallDark: '#48618C',
      trim: '#1E2A48',
      window: '#D2DCEE',
    },
    flavor: 'Cool blues, like the pond at midnight.',
  },
  {
    key: 'floor-honey',
    label: 'Honey Floors',
    slot: 'floor',
    price: 260,
    swap: {
      roof: '#D8A050',
      roofDark: '#9A6A20',
    },
    flavor: 'Sun-stained oak. Warms the whole room.',
  },
  {
    key: 'floor-slate',
    label: 'Slate Floors',
    slot: 'floor',
    price: 340,
    swap: {
      roof: '#5E6878',
      roofDark: '#3A424E',
    },
    flavor: 'A quiet grey. Pairs well with rain.',
  },
  {
    key: 'floor-evergreen',
    label: 'Evergreen Floors',
    slot: 'floor',
    price: 380,
    swap: {
      roof: '#446A4E',
      roofDark: '#2A452F',
    },
    flavor: 'A forest-floor green. Year-round Winter cheer.',
  },
];

export const DECOR_KEYS: string[] = DECOR_CATALOG.map((p) => p.key);

/** Lazy accessor — creates the storage block on first read. */
export function getDecor(player: Player): DecorState {
  const p = player as Player & { decor?: DecorState };
  if (!p.decor) {
    p.decor = {
      owned: [],
      activeWallpaper: null,
      activeFloor: null,
    };
  }
  return p.decor;
}

/** Look up a piece by key (cheap linear scan — catalog is tiny). */
export function findPiece(key: string): DecorPiece | undefined {
  return DECOR_CATALOG.find((p) => p.key === key);
}

/** True iff the player owns the catalog entry. */
export function ownsDecor(player: Player, key: string): boolean {
  return getDecor(player).owned.includes(key);
}

/** Outcome of a buyDecor() call. */
export type DecorBuyOutcome =
  | { kind: 'bought'; piece: DecorPiece; remainingGold: number }
  | { kind: 'already-owned'; piece: DecorPiece }
  | { kind: 'unknown' }
  | { kind: 'not-enough-gold'; need: number; have: number };

/**
 * Spend gold + add the piece to the owned set. On success the piece is
 * automatically applied to its slot so the player sees the new skin
 * without a second action. Already-owned purchases are no-ops.
 */
export function buyDecor(player: Player, key: string): DecorBuyOutcome {
  const piece = findPiece(key);
  if (!piece) return { kind: 'unknown' };
  if (ownsDecor(player, key)) return { kind: 'already-owned', piece };
  if (player.gold < piece.price) {
    return { kind: 'not-enough-gold', need: piece.price, have: player.gold };
  }
  player.gold -= piece.price;
  const state = getDecor(player);
  state.owned.push(key);
  applyDecor(player, key);
  return { kind: 'bought', piece, remainingGold: player.gold };
}

/** Outcome of an applyDecor() call. */
export type DecorApplyOutcome =
  | { kind: 'applied'; piece: DecorPiece }
  | { kind: 'not-owned' }
  | { kind: 'unknown' };

/**
 * Set the active piece for its slot. Returns 'not-owned' when the
 * player doesn't have the piece yet (the cart must sell it first).
 * Passing the same key twice is idempotent. Pass null via clearSlot
 * to revert to the default skin.
 */
export function applyDecor(player: Player, key: string): DecorApplyOutcome {
  const piece = findPiece(key);
  if (!piece) return { kind: 'unknown' };
  if (!ownsDecor(player, key)) return { kind: 'not-owned' };
  const state = getDecor(player);
  if (piece.slot === 'wallpaper') state.activeWallpaper = key;
  else state.activeFloor = key;
  return { kind: 'applied', piece };
}

/** Revert the slot to the default farmhouse skin. */
export function clearSlot(player: Player, slot: 'wallpaper' | 'floor'): void {
  const state = getDecor(player);
  if (slot === 'wallpaper') state.activeWallpaper = null;
  else state.activeFloor = null;
}

/** Bundle of colours the renderer asks for when painting the farmhouse. */
export interface DecorPalette {
  wall?: string;
  wallDark?: string;
  trim?: string;
  roof?: string;
  roofDark?: string;
  window?: string;
}

/** Resolve the current palette (empty when nothing applied). */
export function decorPalette(player: Player): DecorPalette {
  const state = getDecor(player);
  const out: DecorPalette = {};
  if (state.activeWallpaper) {
    const p = findPiece(state.activeWallpaper);
    if (p) {
      if (p.swap.wall) out.wall = p.swap.wall;
      if (p.swap.wallDark) out.wallDark = p.swap.wallDark;
      if (p.swap.trim) out.trim = p.swap.trim;
      if (p.swap.window) out.window = p.swap.window;
    }
  }
  if (state.activeFloor) {
    const p = findPiece(state.activeFloor);
    if (p) {
      if (p.swap.roof) out.roof = p.swap.roof;
      if (p.swap.roofDark) out.roofDark = p.swap.roofDark;
    }
  }
  return out;
}

/** Total catalog ownership progress, for the achievement / decorator tally. */
export function decorOwnedCount(player: Player): number {
  return getDecor(player).owned.length;
}
