// Quest board — village notice board posting one rotating fetch quest
// per in-game week. The board sits on the path just south of the well
// at (BOARD_X, BOARD_Y). Pressing E adjacent to it opens a tiny
// interaction:
//   - if no quest is active   : the board posts the week's task
//   - if requirements met     : the board accepts the turn-in
//   - otherwise               : shows the current task + progress
//
// One "week" is a single season's days (SEASON_LENGTH=7). The active
// quest rotates deterministically by (season * 7 + week-counter) so
// across a save the player sees the same task on the same day no
// matter what time they check.
//
// Pure module: no IO, no canvas. The Game wires the E-press and uses
// returned outcomes to surface toasts + apply rewards.

import type { Player } from '../world/world';
import type { TimeOfDay } from './time';
import { addItem, removeItem, hasItem } from './economy';

/** Board tile — sits south of the well on the village path. */
export const BOARD_X = 19;
export const BOARD_Y = 11;

/** Chebyshev interaction radius. */
export const BOARD_INTERACT_RADIUS = 1;

/** True when the player is close enough to read the board. */
export function nearBoard(px: number, py: number): boolean {
  return (
    Math.abs(px - BOARD_X) <= BOARD_INTERACT_RADIUS &&
    Math.abs(py - BOARD_Y) <= BOARD_INTERACT_RADIUS
  );
}

/** One row in the rotating quest catalog. */
export interface WeeklyQuest {
  /** Stable id (also the inbox key when active). */
  id: string;
  /** Pretty task label shown on the board. */
  label: string;
  /** Required inventory key the player must turn in. */
  requireKey: string;
  /** Required count. */
  requireCount: number;
  /** Gold paid on completion. */
  rewardGold: number;
  /** Optional bonus item awarded on top of the gold. */
  rewardItems?: Array<{ key: string; count: number }>;
  /** One-line flavour shown under the title. */
  flavor: string;
}

/** Catalog of every weekly that can rotate in. Stable order. */
export const BOARD_QUESTS: WeeklyQuest[] = [
  {
    id: 'wheat-batch',
    label: 'Mill Order: 10 Wheat',
    requireKey: 'wheat_harvest',
    requireCount: 10,
    rewardGold: 140,
    flavor: 'The mill has a wedding to bake for. Bring grain.',
  },
  {
    id: 'tomato-crate',
    label: 'Inn Crate: 6 Tomatoes',
    requireKey: 'tomato_harvest',
    requireCount: 6,
    rewardGold: 220,
    rewardItems: [{ key: 'flower', count: 2 }],
    flavor: 'Callie wants tomatoes for the autumn stew.',
  },
  {
    id: 'pumpkin-fair',
    label: 'Fair Donation: 2 Pumpkins',
    requireKey: 'pumpkin_harvest',
    requireCount: 2,
    rewardGold: 320,
    flavor: 'The town fair needs orange centrepieces.',
  },
  {
    id: 'flower-altar',
    label: 'Well Altar: 8 Flowers',
    requireKey: 'flower_harvest',
    requireCount: 8,
    rewardGold: 180,
    rewardItems: [{ key: 'bouquet', count: 1 }],
    flavor: 'Decorate the well for the seasonal blessing.',
  },
  {
    id: 'eggs-bakery',
    label: 'Bakery Order: 6 Eggs',
    requireKey: 'egg',
    requireCount: 6,
    rewardGold: 160,
    flavor: 'Vallie promised an egg bread for the council.',
  },
  {
    id: 'minnow-bait',
    label: 'Bait Restock: 4 Minnows',
    requireKey: 'fish-minnow',
    requireCount: 4,
    rewardGold: 120,
    rewardItems: [{ key: 'forage-herb', count: 2 }],
    flavor: 'Finn lost his bait bag again. Help him out.',
  },
  {
    id: 'berry-jam',
    label: 'Jam Drive: 8 Berries',
    requireKey: 'forage-berry',
    requireCount: 8,
    rewardGold: 200,
    flavor: 'Callie is making winter jam. The kitchen smells red.',
  },
  {
    id: 'mushroom-soup',
    label: 'Soup Pot: 6 Mushrooms',
    requireKey: 'forage-mushroom',
    requireCount: 6,
    rewardGold: 180,
    flavor: 'The pot is warm. The mushrooms are not.',
  },
  {
    id: 'quartz-foundation',
    label: 'Foundation Repair: 3 Quartz',
    requireKey: 'gem-quartz',
    requireCount: 3,
    rewardGold: 240,
    flavor: 'The well shaft needs reinforcing. Bring crystal.',
  },
];

/** Persisted board state on the Player. */
export interface BoardState {
  /** Quest id currently posted on the board, or null when between weeks. */
  activeId: string | null;
  /** (season, day) the active quest was posted on — used for week rollover. */
  postedSeason: number;
  postedDay: number;
  /** Number of weekly quests completed across the run. */
  completedCount: number;
  /** Most-recent five completed quest ids (newest first) for the panel/badge. */
  recent: string[];
}

/** Lazy reader. */
export function getBoard(player: Player): BoardState {
  const p = player as Player & { board?: BoardState };
  if (!p.board) {
    p.board = {
      activeId: null,
      postedSeason: -1,
      postedDay: -1,
      completedCount: 0,
      recent: [],
    };
  }
  return p.board;
}

/** Pick this week's quest deterministically from the catalog. */
export function questForWeek(time: TimeOfDay): WeeklyQuest {
  // Each in-game week = one season. Use season as the rotation index.
  const idx = Math.abs(time.season) % BOARD_QUESTS.length;
  return BOARD_QUESTS[idx];
}

/**
 * Make sure a quest is posted for the current week. Called once when
 * the player interacts with the board. Returns the active quest after
 * the call so the UI doesn't need a second lookup.
 */
export function refreshBoard(player: Player, time: TimeOfDay): WeeklyQuest {
  const state = getBoard(player);
  const wantedSeason = time.season;
  // Post-on-day-1 rule: new season + day 1 wipes the old quest and posts
  // a fresh one. We also lazily post when the player has never visited
  // the board before (postedSeason === -1).
  if (state.postedSeason !== wantedSeason || state.activeId === null) {
    const fresh = questForWeek(time);
    state.activeId = fresh.id;
    state.postedSeason = wantedSeason;
    state.postedDay = time.day;
  }
  return BOARD_QUESTS.find((q) => q.id === state.activeId) ?? questForWeek(time);
}

/** Outcome of a turnIn() call. */
export type BoardTurnInOutcome =
  | { kind: 'completed'; quest: WeeklyQuest; goldEarned: number }
  | { kind: 'not-enough'; quest: WeeklyQuest; have: number; need: number }
  | { kind: 'no-active' };

/**
 * Attempt to turn in the posted week's quest. If the player has the
 * required items, consume them, pay the reward, mark the quest done,
 * and clear the active slot so refreshBoard re-arms it next week.
 */
export function turnIn(player: Player, time: TimeOfDay): BoardTurnInOutcome {
  const quest = refreshBoard(player, time);
  if (!quest) return { kind: 'no-active' };
  const have = player.inventory[quest.requireKey] ?? 0;
  if (have < quest.requireCount) {
    return { kind: 'not-enough', quest, have, need: quest.requireCount };
  }
  // Consume + reward.
  removeItem(player, quest.requireKey, quest.requireCount);
  player.gold += quest.rewardGold;
  if (quest.rewardItems) {
    for (const r of quest.rewardItems) addItem(player, r.key, r.count);
  }
  // Mark done — clear activeId so the next week posts the next quest.
  const state = getBoard(player);
  state.activeId = null;
  state.completedCount += 1;
  state.recent.unshift(quest.id);
  if (state.recent.length > 5) state.recent.length = 5;
  return { kind: 'completed', quest, goldEarned: quest.rewardGold };
}

/** Convenience: progress on the currently posted quest (0..goal). */
export function boardProgress(player: Player, time: TimeOfDay): { have: number; need: number; quest: WeeklyQuest } {
  const quest = refreshBoard(player, time);
  return {
    have: player.inventory[quest.requireKey] ?? 0,
    need: quest.requireCount,
    quest,
  };
}

/** True iff the player meets the requirement for the active quest. */
export function canTurnIn(player: Player, time: TimeOfDay): boolean {
  const quest = refreshBoard(player, time);
  return hasItem(player, quest.requireKey, quest.requireCount);
}

// ---------------------------------------------------------------------
// Procedural sprite
// ---------------------------------------------------------------------

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, w), Math.max(1, h));
}

/**
 * Draws a small village notice-board on a wooden post at (cx, cy).
 * (cx, cy) is the centre of the tile. The board reads "BOARD" in
 * thin pixel font so it's legible from a distance.
 */
export function drawBoardSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  const post = '#6E4A22';
  const postDark = '#3A2810';
  const wood = '#C29A60';
  const woodDark = '#7A5A2A';
  const paper = '#F5E9D4';
  const ink = '#3B2A1A';
  // Post (centre vertical bar).
  px(ctx, cx - 1, cy - 4, 2, 14, post);
  px(ctx, cx - 1, cy + 8, 2, 2, postDark);
  // Board face — 18x10 with shadow trim.
  const bx = cx - 9;
  const by = cy - 12;
  px(ctx, bx, by, 18, 10, wood);
  px(ctx, bx, by, 18, 1, woodDark);
  px(ctx, bx, by + 9, 18, 1, woodDark);
  px(ctx, bx, by, 1, 10, woodDark);
  px(ctx, bx + 17, by, 1, 10, woodDark);
  // Paper notice pinned to the board.
  px(ctx, bx + 3, by + 2, 12, 6, paper);
  // Two faux text lines so the player reads it as a notice.
  px(ctx, bx + 4, by + 4, 8, 1, ink);
  px(ctx, bx + 4, by + 6, 6, 1, ink);
  // Pins (top corners of the paper).
  px(ctx, bx + 3, by + 2, 1, 1, ink);
  px(ctx, bx + 14, by + 2, 1, 1, ink);
}
