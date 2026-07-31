// Auto-restock seed kit.
//
// A buyable convenience: once the player owns one, every dawn the kit
// scans their last planted seed key and tries to top them back up to a
// configurable target (default 5) by spending gold at Vallie's posted
// seed price. The kit is consumable in the sense that it persists for
// the rest of the save — Vallie's bookkeeping, not a physical item.
//
// Design intent: cozy. The kit never overspends — if the player can't
// afford the full top-up, it buys as many seeds as the wallet allows
// and quietly carries on tomorrow. Last-planted is captured at plant
// time (see engine wiring in game.ts) so the system already knows what
// crop the player is invested in this season.
//
// Pure module: no IO, no canvas. The Game wires the kit purchase into
// the shop catalog and the dawn rollover into the existing day tick.

import type { Player } from '../world/world';
import { CROPS } from './crops';

/** Inventory key Vallie uses to record kit ownership. */
export const AUTO_RESTOCK_KEY = 'auto-restock-kit';

/** One-shot purchase price. */
export const AUTO_RESTOCK_PRICE = 600;

/** Per-seed target — kit keeps the bag topped up to this. */
export const AUTO_RESTOCK_TARGET = 5;

/** Storage shape attached to the Player. */
export interface AutoRestockState {
  /** Crop key the player most recently planted. */
  lastSeed: string | null;
}

/** Lazy reader. */
export function getRestock(player: Player): AutoRestockState {
  const p = player as Player & { restock?: AutoRestockState };
  if (!p.restock) p.restock = { lastSeed: null };
  return p.restock;
}

/** Remember the last seed planted — called from the engine plant hook. */
export function recordLastSeed(player: Player, cropKey: string): void {
  getRestock(player).lastSeed = cropKey;
}

/** True iff the player owns at least one kit. */
export function hasKit(player: Player): boolean {
  return (player.inventory[AUTO_RESTOCK_KEY] ?? 0) > 0;
}

/** Outcome of a single dawn-restock attempt. */
export type RestockOutcome =
  | { kind: 'restocked'; cropKey: string; bought: number; gold: number }
  | { kind: 'no-kit' }
  | { kind: 'no-last-seed' }
  | { kind: 'already-stocked'; cropKey: string }
  | { kind: 'no-gold'; cropKey: string };

/**
 * Top the player's last-planted seed back up to AUTO_RESTOCK_TARGET.
 * Returns a tagged outcome the engine can route into a toast + the
 * money log. Never overspends — buys exactly enough to hit target or
 * exhaust the wallet, whichever comes first. Returns 'no-kit' when
 * the player doesn't own the kit.
 */
export function dawnRestock(player: Player): RestockOutcome {
  if (!hasKit(player)) return { kind: 'no-kit' };
  const state = getRestock(player);
  const key = state.lastSeed;
  if (!key) return { kind: 'no-last-seed' };
  const crop = CROPS[key];
  if (!crop) return { kind: 'no-last-seed' };
  const have = player.inventory[key] ?? 0;
  if (have >= AUTO_RESTOCK_TARGET) return { kind: 'already-stocked', cropKey: key };
  const need = AUTO_RESTOCK_TARGET - have;
  const price = crop.seedPrice;
  const canAfford = Math.floor(player.gold / price);
  const buy = Math.min(need, canAfford);
  if (buy <= 0) return { kind: 'no-gold', cropKey: key };
  player.gold -= buy * price;
  player.inventory[key] = have + buy;
  return { kind: 'restocked', cropKey: key, bought: buy, gold: buy * price };
}
