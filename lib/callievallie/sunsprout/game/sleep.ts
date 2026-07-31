// Sleep — fast-forward to dawn + capture a "Day Summary" snapshot.
//
// Press `B` while standing on/adjacent to the farmhouse. Sleep:
//   1. Captures a snapshot of "before" stats (gold, harvest counts,
//      hearts, dishes) so the next day's wake-up overlay can diff.
//   2. Advances the clock to 06:00 of the next in-game day. The
//      world's per-day rollover (crop growth) is triggered exactly
//      once via advanceDay(world).
//   3. Returns a DaySummary describing what changed during the slept
//      day. Sleep cannot be triggered if it's already early morning
//      (the player would be skipping nothing) — call it then to get
//      'too-early' and surface a toast instead.
//
// Pure state module: no UI, no input wiring, no DOM coupling. The
// future overlay (sleep-summary.ts UI) renders the returned summary.

import type { World, Player } from '../world/world';
import type { TimeOfDay } from './time';
import { advanceDay } from './farming';
import { CANDIDATES, getHearts } from './hearts';
import { DAY_START } from './time';
import { applyRain, weatherTomorrow, WEATHER } from './weather';

/** Hours at or below this count as "morning" — sleep refuses. */
export const MORNING_CUTOFF_HOUR = 7;

/** What was true the moment the player went to sleep. */
export interface PreSleepStats {
  day: number;
  gold: number;
  /** Sum of every `*_harvest` count in the player's bag. */
  harvestCount: number;
  /** Per-NPC heart values keyed by NPC id. */
  hearts: Record<string, number>;
  /** Sum of every `dish-*` count. */
  dishesCount: number;
}

/** What changed over the slept day, surfaced as the summary overlay. */
export interface DaySummary {
  prevDay: number;
  newDay: number;
  goldDelta: number;
  harvestDelta: number;
  dishesDelta: number;
  /** Per-NPC heart deltas (only entries with a positive delta). */
  heartGains: Array<{ npcId: string; name: string; delta: number }>;
  /** Optional flavour line ("a quiet night", "the rain pattered…"). */
  flavor: string;
}

export type SleepOutcome =
  | { kind: 'slept'; summary: DaySummary }
  | { kind: 'too-early'; until: number }
  | { kind: 'not-at-farmhouse' };

/** Sum every `_harvest`, `_harvest_silver`, and `_harvest_gold` inventory key. Used for the day-summary diff. */
export function harvestTotal(player: Player): number {
  let total = 0;
  for (const [k, v] of Object.entries(player.inventory)) {
    if (
      k.endsWith('_harvest') ||
      k.endsWith('_harvest_silver') ||
      k.endsWith('_harvest_gold')
    ) {
      total += v;
    }
  }
  return total;
}

/** Sum every `dish-*` inventory key. Used for the day-summary diff. */
export function dishesTotal(player: Player): number {
  let total = 0;
  for (const [k, v] of Object.entries(player.inventory)) {
    if (k.startsWith('dish-')) total += v;
  }
  return total;
}

/** Snapshot the relevant pre-sleep stats so we can diff after the rollover. */
export function snapshotPreSleep(player: Player, time: TimeOfDay): PreSleepStats {
  const hearts: Record<string, number> = {};
  if (player.hearts) {
    for (const id of Object.keys(CANDIDATES)) {
      hearts[id] = getHearts(player.hearts, id);
    }
  }
  return {
    day: time.day,
    gold: player.gold,
    harvestCount: harvestTotal(player),
    hearts,
    dishesCount: dishesTotal(player),
  };
}

/** Is the player on or adjacent (Chebyshev radius 1) to the farmhouse footprint? */
export function isAtFarmhouse(world: World): boolean {
  const p = world.player;
  const px = Math.round(p.x);
  const py = Math.round(p.y);
  const fh = world.buildings.find((b) => b.kind === 'farmhouse');
  if (!fh) return false;
  return (
    px >= fh.x - 1 &&
    px <= fh.x + fh.w &&
    py >= fh.y - 1 &&
    py <= fh.y + fh.h
  );
}

/**
 * Attempt to sleep. On 'slept' the world has been rolled forward by one
 * in-game day and the clock is at 06:00 of the new day; the returned
 * summary is ready to be handed to the UI overlay.
 */
export function sleep(world: World, time: TimeOfDay): SleepOutcome {
  if (!isAtFarmhouse(world)) return { kind: 'not-at-farmhouse' };
  if (time.hour < MORNING_CUTOFF_HOUR) {
    return { kind: 'too-early', until: MORNING_CUTOFF_HOUR };
  }
  const pre = snapshotPreSleep(world.player, time);
  // Apply tomorrow's rain BEFORE advancing the world day, so crops get
  // watered before the growth tick. Sleep skips the day, so we use
  // weatherTomorrow() (the calendar day the player is waking up into).
  const incoming = weatherTomorrow(time);
  const rained = applyRain(world, incoming);
  // Roll the world forward exactly one day.
  advanceDay(world);
  // Bump the clock day counter manually — TimeOfDay.tick() handles this
  // when real time passes, but sleep is an instant jump.
  time.day += 1;
  // Season rollover mirror of TimeOfDay logic.
  // (SEASON_LENGTH lives in time.ts; we re-derive the rule to avoid coupling.)
  // We rely on the same 7-day rule TimeOfDay uses internally.
  if (time.day > 7) {
    time.day = 1;
    time.season = (((time.season + 1) % 4) as 0 | 1 | 2 | 3);
  }
  time.hour = DAY_START;
  time.minute = 0;
  // Internal _elapsedSec is reset by setting hour back via constructor-style.
  // Direct field write is fine here because TimeOfDay.tick rebuilds hour/minute
  // from _elapsedSec on the next call. So we also reset it explicitly:
  (time as unknown as { _elapsedSec: number })._elapsedSec = 0;

  const post = snapshotPreSleep(world.player, time);
  const heartGains: DaySummary['heartGains'] = [];
  for (const id of Object.keys(pre.hearts)) {
    const delta = (post.hearts[id] ?? 0) - (pre.hearts[id] ?? 0);
    if (delta > 0) {
      heartGains.push({ npcId: id, name: CANDIDATES[id]?.name ?? id, delta });
    }
  }
  return {
    kind: 'slept',
    summary: {
      prevDay: pre.day,
      newDay: time.day,
      goldDelta: post.gold - pre.gold,
      harvestDelta: post.harvestCount - pre.harvestCount,
      dishesDelta: post.dishesCount - pre.dishesCount,
      heartGains,
      flavor: rained > 0 ? WEATHER[incoming].flavor : pickFlavor(pre.day),
    },
  };
}

const FLAVORS = [
  'You wake to birdsong and the smell of soil.',
  'The hearth was still warm when you opened your eyes.',
  'You dreamed of pumpkins the size of carts.',
  'The rooster next door announced the dawn — loudly.',
  'A soft rain pattered all night. The fields drank it in.',
  'You woke to find a wildflower on the windowsill. No card.',
];

function pickFlavor(seed: number): string {
  const idx = Math.abs(Math.floor(seed)) % FLAVORS.length;
  return FLAVORS[idx];
}
