// Spouse module — what happens after the wedding.
//
// Once `player.marriage` is set (see marriage.ts), the spouse stops
// following their schedule and moves into the farmhouse. They stand
// at a fixed tile near the farmhouse door during day hours and inside
// the farmhouse footprint at night. They greet the player every
// morning with a small daily gift drawn from a rotating pool of cozy
// items (an egg, a fresh-cooked dish, a forage berry, or a small
// gold tip).
//
// The daily gift fires once at dawn (the day rollover hook). The pool
// rotates deterministically by day so each morning feels different
// without ever requiring real randomness. Items the spouse "owns" map
// loosely to their NPC role:
//
//   maple  — wheat/flower seeds + small gold
//   finn   — fresh fish + forage
//   rose   — a ready-to-eat dish + small gold
//   mayor  — a gem + small gold
//
// Pure module: no IO, no canvas. The Game wires the dawn hook into the
// existing day-rollover block and exposes a getter the renderer uses
// to draw a sprite at `spouseAnchor`.

import type { Player, World } from '../world/world';
import type { TimeOfDay } from './time';
import { spouseOf } from './marriage';
import { CANDIDATES } from './hearts';
import { addItem } from './economy';

/** Daytime hours when the spouse stands outside the farmhouse. */
export const SPOUSE_OUTDOOR_START = 8;
export const SPOUSE_OUTDOOR_END = 20;

/** Per-NPC daily gift pool. One entry awarded per day, rotated by `day % len`. */
export interface SpouseGift {
  /** Inventory key granted to the player. */
  itemKey?: string;
  /** Count of itemKey to grant. */
  count?: number;
  /** Bonus gold to drop alongside the item. */
  gold?: number;
  /** Pretty label for the dawn toast. */
  label: string;
}

const SPOUSE_GIFTS: Record<string, SpouseGift[]> = {
  maple: [
    { itemKey: 'wheat', count: 3, label: '3 wheat seeds tucked in your hat' },
    { itemKey: 'flower', count: 2, label: '2 flower seeds on the kitchen table' },
    { itemKey: 'tomato', count: 1, gold: 10, label: 'a tomato seed packet + 10g change' },
    { gold: 40, label: '40g from the shop till' },
  ],
  finn: [
    { itemKey: 'fish-minnow', count: 1, label: 'a fresh-caught minnow' },
    { itemKey: 'forage-berry', count: 2, label: '2 wild berries from the pond walk' },
    { itemKey: 'forage-herb', count: 2, label: '2 sage sprigs for tea' },
    { itemKey: 'fish-trout', count: 1, label: 'a glistening river trout' },
  ],
  rose: [
    { itemKey: 'dish-hearty-stew', count: 1, label: 'a bowl of hearty stew, still warm' },
    { itemKey: 'dish-herb-tea', count: 1, gold: 5, label: 'sage tea + a small tip' },
    { itemKey: 'dish-hot-cocoa', count: 1, label: 'a flask of hot cocoa' },
    { itemKey: 'egg', count: 2, label: '2 eggs from the inn pantry' },
  ],
  mayor: [
    { itemKey: 'gem-quartz', count: 1, label: 'a quartz from the council coffer' },
    { gold: 60, label: '60g civic stipend' },
    { itemKey: 'pumpkin', count: 1, gold: 20, label: 'a pumpkin seed + 20g' },
    { itemKey: 'gem-amethyst', count: 1, label: 'a polished amethyst' },
  ],
};

/** Per-spouse morning greeting line. Rotates by `day % len`. */
const SPOUSE_GREETINGS: Record<string, string[]> = {
  maple: [
    'Vallie kisses you awake: "I locked the shop early. Today is ours."',
    'Vallie slips a seed packet into your apron: "For luck."',
    'Vallie hums by the window: "Smells like a planting day."',
  ],
  finn: [
    'Finn ruffles your hair: "Bring the bait. I packed the rest."',
    'Finn already has tea on: "Caught us breakfast. The frog declined to be witness."',
    'Finn whispers: "Stay in bed five more minutes. The pond will wait."',
  ],
  rose: [
    'Callie hands you toast + honey: "Soup is on for tonight, love."',
    'Callie hums an old inn song: "Hearth\'s warm. So am I. Come back soon."',
    'Callie smiles over her cup: "Sleep well? You snored like a content cat."',
  ],
  mayor: [
    'Bramble adjusts your collar: "The council can wait. You eat first."',
    'Bramble reads aloud from the village ledger: "Page one — you."',
    'Bramble kisses your hand: "Off to draft the spring proclamation. Saved you tea."',
  ],
};

/** Coordinates we move the spouse to. */
export interface SpouseAnchor {
  x: number;
  y: number;
  /** True when the spouse is "inside" — used for renderer alpha + visibility. */
  inside: boolean;
}

/**
 * Where the spouse stands right now. Daytime: just south of the
 * farmhouse door so the player walks into them on their way to the
 * field. Night: the south-east corner of the footprint, "inside" the
 * house.
 */
export function spouseAnchor(world: World, time: TimeOfDay): SpouseAnchor | null {
  if (!world.player?.marriage) return null;
  const fh = world.buildings.find((b) => b.kind === 'farmhouse');
  if (!fh) return null;
  const isDay =
    time.hour >= SPOUSE_OUTDOOR_START && time.hour < SPOUSE_OUTDOOR_END;
  if (isDay) {
    // Stand just south of the door (which is at the south-centre of the footprint).
    return {
      x: fh.x + Math.floor(fh.w / 2),
      y: fh.y + fh.h,
      inside: false,
    };
  }
  // Night: SE corner of the footprint, "in the house".
  return {
    x: fh.x + fh.w - 1,
    y: fh.y + fh.h - 1,
    inside: true,
  };
}

/** Per-spouse morning greeting based on the current day. */
export function spouseGreeting(player: Player, day: number): string | null {
  const id = spouseOf(player);
  if (!id) return null;
  const pool = SPOUSE_GREETINGS[id];
  if (!pool || pool.length === 0) return null;
  return pool[Math.abs(day) % pool.length];
}

/** Storage block attached to the Player to track spouse state. */
export interface SpouseState {
  /** Last day the morning gift was dropped — gates re-firing on resumes. */
  lastGiftDay: number;
}

/** Lazy reader. */
export function getSpouseState(player: Player): SpouseState {
  const p = player as Player & { spouse?: SpouseState };
  if (!p.spouse) p.spouse = { lastGiftDay: -1 };
  return p.spouse;
}

/** Result of dawnSpouseGift(). */
export type SpouseGiftOutcome =
  | { kind: 'gifted'; itemKey?: string; count?: number; gold?: number; label: string; npcName: string }
  | { kind: 'not-married' }
  | { kind: 'already-today' };

/**
 * Drop the day's spouse gift into the player's bag. Idempotent per
 * in-game day — once `lastGiftDay === today` it short-circuits.
 *
 * Returns a tagged outcome the engine routes into a dawn toast and
 * (when gold > 0) a money-log entry. Items are grouped under the
 * `spouse:` reason prefix so the player can audit "what did Finn bring
 * me last Spring?" by scrolling the money log.
 */
export function dawnSpouseGift(player: Player, today: number): SpouseGiftOutcome {
  const id = spouseOf(player);
  if (!id) return { kind: 'not-married' };
  const state = getSpouseState(player);
  if (state.lastGiftDay === today) return { kind: 'already-today' };
  const pool = SPOUSE_GIFTS[id];
  if (!pool || pool.length === 0) return { kind: 'already-today' };
  const gift = pool[Math.abs(today) % pool.length];
  if (gift.itemKey && (gift.count ?? 0) > 0) {
    addItem(player, gift.itemKey, gift.count ?? 1);
  }
  if (gift.gold && gift.gold > 0) {
    player.gold += gift.gold;
  }
  state.lastGiftDay = today;
  return {
    kind: 'gifted',
    itemKey: gift.itemKey,
    count: gift.count,
    gold: gift.gold,
    label: gift.label,
    npcName: CANDIDATES[id]?.name ?? id,
  };
}

/** True iff the player has held the wedding (mirror of marriage.isMarried). */
export function hasSpouse(player: Player): boolean {
  return !!player.marriage;
}
