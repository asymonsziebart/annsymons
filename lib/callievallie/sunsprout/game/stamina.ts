// Stamina / energy — a daily pool the player spends on physical work.
//
// Each in-game action that exists in the world has a stamina cost:
//
//   till         5
//   water        3
//   mine swing   8
//   fishing cast 4
//   harvest      0 (free — the payoff)
//
// The pool refills every dawn (sleep rollover) to MAX_STAMINA. Two
// drinks from the cookbook also restore stamina IMMEDIATELY when the
// player consumes them from the bag:
//
//   herb-tea          +20
//   hot-cocoa         +35
//
// Design intent: stamina is a *gentle* gate, not a punishment. Crops
// keep growing whether or not you're tired; the pool just nudges the
// player to spread work across multiple in-game days instead of
// blitzing the whole field in one afternoon. spend() never goes below
// zero — when the player is empty, it returns false and the caller is
// expected to surface a "too tired" toast and skip the action.
//
// Pure module: no IO, no canvas, no engine coupling. The Game wires
// spend() into the existing till/water/mine/cast handlers.

import type { Player } from '../world/world';

/** Storage shape attached to the Player. */
export interface StaminaState {
  /** Current stamina pool. */
  current: number;
  /** Maximum stamina (may increase later from upgrades). */
  max: number;
  /** Day index of the last refill — used to detect missed rollovers. */
  lastRefillDay: number;
}

/** The default daily cap. */
export const MAX_STAMINA = 100;

/** Per-action costs. */
export const STAMINA_COST = {
  till: 5,
  water: 3,
  mine: 8,
  cast: 4,
} as const;

/** Per-drink restore amounts when the player consumes a dish from the bag. */
export const STAMINA_RESTORE: Record<string, number> = {
  'dish-herb-tea': 20,
  'dish-hot-cocoa': 35,
  'dish-berry-tonic': 25,
  'dish-mushroom-broth': 30,
  'dish-sunflower-elixir': 60,
};

/** Default state — full pool. */
export function defaultStaminaState(day: number = 1): StaminaState {
  return { current: MAX_STAMINA, max: MAX_STAMINA, lastRefillDay: day };
}

/** Lazy accessor on the Player. */
export function getStamina(player: Player): StaminaState {
  const p = player as Player & { stamina?: StaminaState };
  if (!p.stamina) p.stamina = defaultStaminaState();
  return p.stamina;
}

/** Manually set the pool (clamped 0..max). Returns the new value. */
export function setStamina(player: Player, value: number): number {
  const s = getStamina(player);
  s.current = Math.max(0, Math.min(s.max, Math.floor(value)));
  return s.current;
}

/**
 * Attempt to spend `cost` stamina. Returns true and decrements the pool
 * on success; returns false and leaves the pool untouched when the
 * player doesn't have enough. cost=0 is always a success.
 */
export function spendStamina(player: Player, cost: number): boolean {
  if (cost <= 0) return true;
  const s = getStamina(player);
  if (s.current < cost) return false;
  s.current -= cost;
  return true;
}

/**
 * Restore stamina by `amount` (clamped to max). Returns the actual
 * amount added (may be less than requested if already near max).
 */
export function restoreStamina(player: Player, amount: number): number {
  if (amount <= 0) return 0;
  const s = getStamina(player);
  const before = s.current;
  s.current = Math.min(s.max, s.current + Math.floor(amount));
  return s.current - before;
}

/**
 * Day-rollover hook: top the pool back up to max and remember the day
 * so a save loaded mid-game doesn't double-refill. Returns the amount
 * topped up (0 if already full).
 */
export function refillStamina(player: Player, day: number): number {
  const s = getStamina(player);
  if (s.lastRefillDay === day) return 0;
  const before = s.current;
  s.current = s.max;
  s.lastRefillDay = day;
  return s.current - before;
}

/**
 * Consume one of the named restore-drink from the player's inventory
 * and apply its stamina restore. Returns a tagged outcome so the
 * caller can post the right toast.
 */
export type DrinkOutcome =
  | { kind: 'drank'; key: string; restored: number; remaining: number }
  | { kind: 'no-drink' }
  | { kind: 'already-full' };

export function drinkBest(player: Player): DrinkOutcome {
  const s = getStamina(player);
  if (s.current >= s.max) return { kind: 'already-full' };
  // Pick the highest-restore drink the player has — biggest bang first.
  const candidates = Object.entries(STAMINA_RESTORE).sort((a, b) => b[1] - a[1]);
  for (const [key, amount] of candidates) {
    if ((player.inventory[key] ?? 0) > 0) {
      player.inventory[key] = (player.inventory[key] ?? 0) - 1;
      const restored = restoreStamina(player, amount);
      return { kind: 'drank', key, restored, remaining: s.current };
    }
  }
  return { kind: 'no-drink' };
}

/** True if the player has at least `cost` stamina available. */
export function hasStamina(player: Player, cost: number): boolean {
  if (cost <= 0) return true;
  return getStamina(player).current >= cost;
}

/** Compact label used in the HUD bar. */
export function staminaLabel(state: StaminaState): string {
  return `${state.current}/${state.max}`;
}

// ---------------------------------------------------------------------------
// Low-energy warning — a graduated cue on the HUD stamina bar so the player
// notices they're running out BEFORE an action silently fails for lack of
// energy. Mirrors the hotbar's seed-stock warning (a reduce-motion-gated
// sine breathe), but the thresholds are tied to the actual ACTION COSTS
// rather than a fraction of max, so a bath-house max buff (which lifts the
// cap to 130) doesn't move the "you can't afford to work" line.
// ---------------------------------------------------------------------------

/** Severity of the stamina pool's low-energy warning. */
export type StaminaWarnLevel = 'none' | 'low' | 'crit';

/**
 * Below this the player can no longer afford the most expensive action
 * (a mine swing, the priciest STAMINA_COST), so the next physical action
 * will just fail — the urgent "crit" band. Kept in lock-step with the
 * costliest cost so the warning fires exactly when work starts bouncing.
 */
export const STAMINA_CRIT_THRESHOLD = STAMINA_COST.mine;

/** Below this only a handful of actions remain — the calmer "low" heads-up. */
export const STAMINA_LOW_THRESHOLD = 20;

/**
 * Classify the pool's warning level off the CURRENT value:
 *   current < STAMINA_CRIT_THRESHOLD -> 'crit'  (can't afford a mine swing)
 *   current < STAMINA_LOW_THRESHOLD  -> 'low'   (a few actions left)
 *   else                              -> 'none'
 * Pure.
 */
export function staminaWarnLevel(state: StaminaState): StaminaWarnLevel {
  if (state.current < STAMINA_CRIT_THRESHOLD) return 'crit';
  if (state.current < STAMINA_LOW_THRESHOLD) return 'low';
  return 'none';
}

/** Breathe period for the warning border; crit pulses faster than low. */
export const STAMINA_PULSE_PERIOD_MS = 1000;

/**
 * Pulse strength in [0,1] for the warning border at time `nowMs`, or 0 when
 * there's no warning. A sine breathe so the border swells rather than blinks;
 * 'crit' pulses faster and floors brighter than 'low' so an empty pool reads
 * as more urgent. Deterministic in nowMs so a test can pin a phase. Pure.
 */
export function staminaWarnPulse(level: StaminaWarnLevel, nowMs: number): number {
  if (level === 'none') return 0;
  const period = level === 'crit' ? STAMINA_PULSE_PERIOD_MS * 0.6 : STAMINA_PULSE_PERIOD_MS;
  const phase = ((nowMs % period) / period) * Math.PI * 2;
  const breathe = 0.5 + 0.5 * Math.sin(phase); // 0..1
  const floor = level === 'crit' ? 0.5 : 0.25;
  return floor + (1 - floor) * breathe;
}

/** Steady (non-animated) intensities for reduce-motion; crit brighter. */
export const STAMINA_STEADY_LOW = 0.7;
export const STAMINA_STEADY_CRIT = 0.95;

export function staminaWarnSteady(level: StaminaWarnLevel): number {
  if (level === 'crit') return STAMINA_STEADY_CRIT;
  if (level === 'low') return STAMINA_STEADY_LOW;
  return 0;
}

/**
 * The border intensity to actually draw, picking the steady value under
 * reduceMotion and the animated breathe otherwise. The single entry point
 * the bar widget calls so the motion decision lives here, tested, not in
 * the canvas layer. Mirrors hotbar.seedWarnIntensity.
 */
export function staminaWarnIntensity(
  level: StaminaWarnLevel,
  nowMs: number,
  reduceMotion: boolean,
): number {
  return reduceMotion ? staminaWarnSteady(level) : staminaWarnPulse(level, nowMs);
}

/** Border colour per warning level — amber heads-up, red urgent. */
export const STAMINA_WARN_LOW_COLOR = '#F0C24A';
export const STAMINA_WARN_CRIT_COLOR = '#E07B7B';

export function staminaWarnColor(level: StaminaWarnLevel): string {
  return level === 'crit' ? STAMINA_WARN_CRIT_COLOR : STAMINA_WARN_LOW_COLOR;
}
