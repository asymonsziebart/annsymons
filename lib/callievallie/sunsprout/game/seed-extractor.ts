// Seed extractor — a buyable kit that turns a harvested crop back
// into 1-2 seeds of the same crop. Once the player owns the kit,
// pressing `l` consumes one harvest unit and grants new seeds.
//
// Why no placeable? Sunsprout's tile-space is tight and the cozy
// rhythm doesn't need another world-object. The kit lives in the
// player's bag and is a single keystroke away — closer in spirit
// to a workshop tool than a tractor.
//
// Determinism: yield (1 or 2 seeds) flips on a per-extraction
// counter, not Math.random. The counter ticks every successful
// extraction so the player sees alternating 1/2/1/2 yields. This
// keeps tests + multiplayer state stable.
//
// Priority rule: when the player has multiple kinds of harvest
// stockpiled, the extractor pulls from the LARGEST stockpile first.
// Ties break by CROP_KEYS order. This means "press l to clear
// surplus pumpkins" works without an extra menu.
//
// Pure module: no IO, no canvas. Engine wires the inventory key
// into Vallie's shop catalog and the `l` keypress into runExtract().

import type { Player } from '../world/world';
import { CROPS, CROP_KEYS } from './crops';
import { addItem, removeItem } from './economy';

/** Inventory key the player owns once they buy the kit. */
export const EXTRACTOR_INVENTORY_KEY = 'seed-extractor';

/** One-shot purchase price at Vallie's shop. */
export const EXTRACTOR_PRICE = 350;

/** Persisted extractor state. */
export interface ExtractorState {
  /** Number of successful extractions so far (drives the alternating yield). */
  uses: number;
}

/** Lazy reader. */
export function getExtractor(player: Player): ExtractorState {
  const p = player as Player & { extractor?: ExtractorState };
  if (!p.extractor) p.extractor = { uses: 0 };
  return p.extractor;
}

/** True iff the player owns at least one kit. */
export function hasExtractor(player: Player): boolean {
  return (player.inventory[EXTRACTOR_INVENTORY_KEY] ?? 0) > 0;
}

/** Outcome of a single runExtract() call. */
export type ExtractOutcome =
  | { kind: 'extracted'; cropKey: string; seedsAdded: number }
  | { kind: 'no-kit' }
  | { kind: 'no-harvest' };

/**
 * Choose the crop key to extract from. Picks the LARGEST normal-tier
 * `<crop>_harvest` stack the player owns. Returns null when the bag
 * has none. Silver/gold tiers stay reserved for the well + recipes —
 * the extractor never destroys premium produce.
 */
export function pickExtractTarget(player: Player): string | null {
  let best: { key: string; have: number } | null = null;
  for (const key of CROP_KEYS) {
    const have = player.inventory[`${key}_harvest`] ?? 0;
    if (have <= 0) continue;
    if (!best || have > best.have) {
      best = { key, have };
    }
  }
  return best ? best.key : null;
}

/**
 * Compute the seed yield for the next extraction. We alternate 1/2
 * deterministically so the player can rely on the rhythm. Odd uses
 * yield 2, even uses yield 1 — bias slightly toward 2 to reward
 * keeping the extractor full.
 */
export function nextYield(player: Player): number {
  return getExtractor(player).uses % 2 === 0 ? 2 : 1;
}

/**
 * Consume one of the most-abundant harvest and grant `nextYield()`
 * seeds of the same crop. Returns a tagged outcome so the engine
 * can route success into a toast + journal hook.
 */
export function runExtract(player: Player): ExtractOutcome {
  if (!hasExtractor(player)) return { kind: 'no-kit' };
  const cropKey = pickExtractTarget(player);
  if (!cropKey) return { kind: 'no-harvest' };
  if (!CROPS[cropKey]) return { kind: 'no-harvest' };
  const yieldN = nextYield(player);
  removeItem(player, `${cropKey}_harvest`, 1);
  addItem(player, cropKey, yieldN);
  getExtractor(player).uses += 1;
  return { kind: 'extracted', cropKey, seedsAdded: yieldN };
}

/** Convenience: total extractions performed across the run. */
export function totalExtractions(player: Player): number {
  return getExtractor(player).uses;
}
