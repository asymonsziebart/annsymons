// Mining — pure state-machine module.
//
// Slice 1 of the v0.4.0 mining caves feature. Like `fishing.ts` slice 1,
// this is just the data model and a deterministic state machine — no UI,
// no input wiring, no world coupling. The cave-entrance trigger box and
// the swing minigame come in later ticks.
//
// The Pickaxe owns a small finite state machine:
//
//   IDLE → SWINGING → STRIKING → IDLE  (+ optional Drop)
//
// IDLE      – pickaxe is shouldered. swing() arms a new strike at a
//             specific ore node.
// SWINGING  – the swing animation is mid-arc. Auto-advances to STRIKING
//             after a short fixed wind-up so the hit feels weighty.
// STRIKING  – the player has a short reaction window to call strike()
//             to land a clean hit. Missing the window glances the swing
//             and drops back to IDLE with no reward.
//
// All durations are in milliseconds. `tick(dtMs)` is called from the
// game loop and never throws — it returns true when the state changed
// so the caller can fire a sound / toast / particle.

import { GEMS, type GemKey, pickGem } from './gems';

export type MiningState = 'idle' | 'swinging' | 'striking';

/** Default tunables — exported so the UI / tests can reach them. */
export const MINING = {
  /** How long the wind-up arc lasts before the head connects. */
  swingMs: 450,
  /** Reaction window during which strike() will land cleanly. */
  strikeWindowMs: 700,
  /**
   * Rough hit count it takes to break an average node — the swing
   * minigame in a later tick will tune around this.
   */
  hitsPerNode: 3,
};

/**
 * Minimal deterministic RNG (mulberry32). Used so tests can seed the
 * pickaxe and get the same gem drop every run. Mirrors the helper in
 * `fishing.ts` so the two modules stay symmetrical.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PickaxeOptions {
  /** Seed for the gem-roll RNG. Defaults to Math.random based. */
  seed?: number;
}

export class Pickaxe {
  public state: MiningState = 'idle';
  /** Time spent in the current state. */
  public elapsedMs = 0;
  /** Last gem rolled on a clean strike, surfaced for HUD toasts. */
  public lastDrop: GemKey | null = null;
  /** Last result so the UI can briefly flash "clean!" or "glance!". */
  public lastResult: 'struck' | 'missed' | null = null;

  private rng: () => number;

  constructor(opts: PickaxeOptions = {}) {
    this.rng = opts.seed === undefined ? Math.random : mulberry32(opts.seed);
  }

  /** Whether the pickaxe is mid-swing and cannot start a new one. */
  isBusy(): boolean {
    return this.state !== 'idle';
  }

  /**
   * Starts a new swing. No-op (returns false) if the pickaxe is already
   * mid-swing. Resets the per-attempt result fields so the UI can flash
   * the next outcome cleanly.
   */
  swing(): boolean {
    if (this.isBusy()) return false;
    this.state = 'swinging';
    this.elapsedMs = 0;
    this.lastResult = null;
    return true;
  }

  /**
   * Lands the strike. Only valid during STRIKING (success) — in any
   * other state it's a misclick and cancels the swing back to idle.
   * On a clean hit, rolls a gem from the weighted catalog using the
   * seeded rng and returns it.
   */
  strike(): GemKey | null {
    if (this.state === 'striking') {
      const gem = pickGem(this.rng);
      this.lastDrop = gem;
      this.lastResult = 'struck';
      this.state = 'idle';
      this.elapsedMs = 0;
      return gem;
    }
    // Any other state → misclick cancels.
    this.state = 'idle';
    this.elapsedMs = 0;
    this.lastResult = 'missed';
    return null;
  }

  /**
   * Advance the pickaxe by `dtMs`. Returns true on state transitions so
   * callers can fire toasts / sounds / particles. Designed to be called
   * every frame.
   */
  tick(dtMs: number): boolean {
    if (this.state === 'idle') return false;
    this.elapsedMs += dtMs;
    switch (this.state) {
      case 'swinging':
        if (this.elapsedMs >= MINING.swingMs) {
          this.state = 'striking';
          this.elapsedMs = 0;
          return true;
        }
        return false;
      case 'striking':
        if (this.elapsedMs >= MINING.strikeWindowMs) {
          // Missed the window — swing glances off.
          this.state = 'idle';
          this.elapsedMs = 0;
          this.lastResult = 'missed';
          return true;
        }
        return false;
    }
    return false;
  }

  /** Forces the pickaxe back to idle (used when the player walks away). */
  cancel(): void {
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.elapsedMs = 0;
    this.lastResult = 'missed';
  }
}

/** Re-export GEMS so consumers only import one module. */
export { GEMS };
export type { GemKey };

// ---------------------------------------------------------------------
// World coupling helpers
// ---------------------------------------------------------------------

/**
 * Minimal structural type for the world bits this module touches. Kept
 * here (instead of importing `World`) so `mining.ts` stays decoupled
 * from world.ts and remains trivially unit-testable with a stub.
 * Mirrors the WaterProbe shape in `fishing.ts`.
 */
export interface OreProbe {
  inBounds(tx: number, ty: number): boolean;
  getTile(tx: number, ty: number): { type: string };
}

/**
 * True iff the tile at (tx,ty) is in-bounds and made of stone — i.e. a
 * legal target for a pickaxe strike. The cave-entrance tick will hand
 * the world directly to this helper from the input layer to decide
 * whether pressing `M` while facing this tile should arm the pickaxe.
 */
export function canStrikeInto(w: OreProbe, tx: number, ty: number): boolean {
  return w.inBounds(tx, ty) && w.getTile(tx, ty).type === 'stone';
}
