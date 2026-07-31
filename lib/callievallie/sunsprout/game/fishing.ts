// Fishing — pure state-machine module.
//
// This is slice 1 of the v0.2.0 fishing pond feature: just the data model
// and the timed cast/reel loop. No UI, no input wiring, no world coupling —
// those come in later ticks. The Rod owns a small finite state machine:
//
//   IDLE → CASTING → WAITING → BITING → REELING → IDLE (+ optional Catch)
//
// IDLE     – rod is put away. cast() arms a new attempt.
// CASTING  – the bobber is mid-flight. Auto-advances to WAITING after a
//            short fixed throw time so it feels weighty.
// WAITING  – the bobber is in the water. After a random delay (seeded so
//            tests are deterministic) a fish bites and we enter BITING.
// BITING   – the player has a short reaction window to call reel(). If
//            they miss it the fish escapes and we drop back to IDLE.
// REELING  – the timing minigame runs for a fixed duration. The minigame
//            UI lives in a later tick; for now reel() just succeeds and
//            we surface the caught fish on the rod.
//
// All durations are in milliseconds. `tick(dtMs)` is called from the game
// loop and never throws — it returns true when the state changed so the
// caller can fire a sound/toast/whatever.

import { FISH, type FishKey, pickFish } from './fish';

export type FishingState =
  | 'idle'
  | 'casting'
  | 'waiting'
  | 'biting'
  | 'reeling';

/** Default tunables — exported so the UI / tests can reach them. */
export const FISHING = {
  /** How long the bobber arcs through the air before it lands in water. */
  castMs: 600,
  /** Random window before a fish bites once the bobber is in the water. */
  waitMinMs: 1500,
  waitMaxMs: 4500,
  /** How long the player has to react to a bite before the fish escapes. */
  biteWindowMs: 900,
  /** How long the timing minigame runs for. */
  reelMs: 1800,
};

/**
 * Minimal deterministic RNG (mulberry32). Used so tests can seed the rod and
 * get the same bite delay every run. If no seed is provided we fall back to
 * Math.random.
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

export interface RodOptions {
  /** Seed for the bite-delay RNG. Defaults to Math.random() based. */
  seed?: number;
}

export class Rod {
  public state: FishingState = 'idle';
  /** Time spent in the current state. */
  public elapsedMs = 0;
  /** Random wait duration rolled on each cast. Surfaced for the UI. */
  public waitMs = 0;
  /** Bite-window ms for THIS cast — set on cast(), defaults to catalog. */
  public biteWindowMs: number = FISHING.biteWindowMs;
  /** Last fish that bit (set when state enters BITING; cleared on idle). */
  public hookedFish: FishKey | null = null;
  /** Last successful catch, kept so the UI can show a "you caught X!" toast. */
  public lastCatch: FishKey | null = null;
  /** Last result so the UI can show a brief "got away" or "caught it!" beat. */
  public lastResult: 'caught' | 'escaped' | null = null;

  private rng: () => number;
  /** Optional override for fish selection — set per-cast. */
  private fishPicker: ((rng: () => number) => FishKey) | null = null;

  constructor(opts: RodOptions = {}) {
    this.rng = opts.seed === undefined ? Math.random : mulberry32(opts.seed);
  }

  /** Whether the rod is busy and cannot accept a new cast. */
  isBusy(): boolean {
    return this.state !== 'idle';
  }

  /**
   * Starts a new cast. No-op (returns false) if the rod is already busy.
   * Rolls the next bite-delay using the seeded RNG so tests are stable.
   *
   * Optional opts override the bite window and fish picker for THIS cast
   * — used by rod-tier upgrades to stretch the window + bias the catch.
   */
  cast(opts?: {
    biteWindowMs?: number;
    fishPicker?: (rng: () => number) => FishKey;
  }): boolean {
    if (this.isBusy()) return false;
    this.state = 'casting';
    this.elapsedMs = 0;
    this.hookedFish = null;
    this.lastResult = null;
    const span = FISHING.waitMaxMs - FISHING.waitMinMs;
    this.waitMs = FISHING.waitMinMs + this.rng() * span;
    this.biteWindowMs = opts?.biteWindowMs ?? FISHING.biteWindowMs;
    this.fishPicker = opts?.fishPicker ?? null;
    return true;
  }

  /**
   * Reels in. Only valid in BITING (success) — in any other state it's a
   * misclick and cancels the cast back to idle. Returns the caught fish key
   * on success, or null otherwise.
   */
  reel(): FishKey | null {
    if (this.state === 'biting') {
      const pick = this.fishPicker ?? pickFish;
      const fish = this.hookedFish ?? pick(this.rng);
      this.state = 'reeling';
      this.elapsedMs = 0;
      this.hookedFish = fish;
      return fish;
    }
    // Any other state → mis-click cancels.
    this.state = 'idle';
    this.elapsedMs = 0;
    this.hookedFish = null;
    this.lastResult = 'escaped';
    return null;
  }

  /**
   * Advance the rod by `dtMs`. Returns true on state transitions so callers
   * can fire toasts / sounds. Designed to be called every frame.
   */
  tick(dtMs: number): boolean {
    if (this.state === 'idle') return false;
    this.elapsedMs += dtMs;
    switch (this.state) {
      case 'casting':
        if (this.elapsedMs >= FISHING.castMs) {
          this.state = 'waiting';
          this.elapsedMs = 0;
          return true;
        }
        return false;
      case 'waiting':
        if (this.elapsedMs >= this.waitMs) {
          this.state = 'biting';
          this.elapsedMs = 0;
          const pick = this.fishPicker ?? pickFish;
          this.hookedFish = pick(this.rng);
          return true;
        }
        return false;
      case 'biting':
        if (this.elapsedMs >= this.biteWindowMs) {
          // Missed the window — fish escapes.
          this.state = 'idle';
          this.elapsedMs = 0;
          this.hookedFish = null;
          this.lastResult = 'escaped';
          return true;
        }
        return false;
      case 'reeling':
        if (this.elapsedMs >= FISHING.reelMs) {
          this.lastCatch = this.hookedFish;
          this.lastResult = 'caught';
          this.state = 'idle';
          this.elapsedMs = 0;
          return true;
        }
        return false;
    }
    return false;
  }

  /** Forces the rod back to idle (used when the player walks away). */
  cancel(): void {
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.elapsedMs = 0;
    this.hookedFish = null;
    this.lastResult = 'escaped';
  }
}

/** Re-export FISH so consumers only import one module. */
export { FISH };
export type { FishKey };

// ---------------------------------------------------------------------
// World coupling helpers
// ---------------------------------------------------------------------

/**
 * Minimal structural type for the world bits this module touches. Kept
 * here (instead of importing `World`) so `fishing.ts` stays decoupled
 * from world.ts and remains trivially unit-testable with a stub.
 */
export interface WaterProbe {
  inBounds(tx: number, ty: number): boolean;
  getTile(tx: number, ty: number): { type: string };
}

/**
 * True iff the tile at (tx,ty) is in-bounds and made of water — i.e. a
 * legal target for a fishing cast. Used by the input layer to decide
 * whether pressing `F` while facing this tile should arm the rod.
 */
export function canCastInto(w: WaterProbe, tx: number, ty: number): boolean {
  return w.inBounds(tx, ty) && w.getTile(tx, ty).type === 'water';
}
