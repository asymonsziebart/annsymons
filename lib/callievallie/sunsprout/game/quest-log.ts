// Quest log panel — `'` toggles a view of every quest the player has.
//
// Three buckets, in order:
//   - active     : not complete yet; show progress/goal + the next hint.
//   - completed  : done; show the reward earned and "Done" badge.
//   - locked     : not yet seeded (future-proofing — currently none).
//
// The hint line teases the next thing the player should do without
// outright spoiling. E.g. "Plant your first seed" stays as-is until
// completion, then becomes "Reward: 10g". This mirrors the cozy genre
// convention of not over-explaining each quest while still showing
// progress.
//
// Pure module + a controller class for the panel — same shape as
// AchievementsPanel / MoneyLogPanel / SettingsPanel so the engine can
// wire it in with no surprises.

import type { Player } from '../world/world';
import type { Quest, QuestReward } from './quests';

/** Bucket a quest sits in for the panel. */
export type QuestStatus = 'active' | 'completed';

/** Pure summary row used by the panel and tests. */
export interface QuestLogEntry {
  id: string;
  name: string;
  description: string;
  status: QuestStatus;
  /** 0..goal. */
  progress: number;
  /** Always >= 1; surfaces "0/5" until first tick. */
  goal: number;
  /** Pre-formatted reward line ("+10g", "+50g, +3 tomato", etc.). */
  rewardLine: string;
  /** Glyph kinds for the reward, in the same order formatReward lists them. */
  rewardGlyphs: RewardGlyphKind[];
  /** Short hint line shown under the title. */
  hint: string;
}

/**
 * The little pixel pip drawn beside a quest's reward line so a board scans
 * like the bag instead of reading every \"+50g, +3 tomato\" string. One pip
 * per reward SEGMENT, matching formatReward's output:
 *   - `gold`:     a coin (the `gold` amount)
 *   - `item`:     a crate (each `items` entry — produce/ingredient payout)
 *   - `cosmetic`: a star (the `cosmetic` unlock)
 */
export type RewardGlyphKind = 'gold' | 'item' | 'cosmetic';

/**
 * Derive the ordered reward-glyph kinds for a quest reward, one per segment
 * formatReward emits and in the SAME order (gold, then each item, then the
 * cosmetic), so the pips line up with the text the player reads. An empty
 * reward yields no pips (the panel then draws the bare \"—\" line). Pure —
 * reads only the reward shape, mirroring formatReward's branching so the
 * two never drift.
 */
export function questRewardGlyphs(reward: QuestReward): RewardGlyphKind[] {
  const out: RewardGlyphKind[] = [];
  if (reward.gold) out.push('gold');
  if (reward.items) {
    for (const _ of Object.keys(reward.items)) out.push('item');
  }
  if (reward.cosmetic) out.push('cosmetic');
  return out;
}

/**
 * Per-kind tint for the reward pips, drawn from the same toast-rail palette
 * the money-log uses: a coin is gold, an item crate is green, a cosmetic
 * star is violet. Tinting each pip by its KIND (rather than mono-tinting the
 * whole cluster to one row colour) lets the player read \"this pays gold +
 * an item\" from the hues alone — the reward TYPE scans by colour the way the
 * money-log rails classify a ledger row.
 */
export const REWARD_GLYPH_COLOR: Record<RewardGlyphKind, string> = {
  gold: '#F0C24A',
  item: '#A3D77A',
  cosmetic: '#C8A0E8',
};

/**
 * Uniform dim tint for a COMPLETED quest's reward pips, so a finished reward
 * reads muted (matching the row's dimmed text) instead of shouting its kind
 * colours after the work is done.
 */
export const REWARD_GLYPH_DONE_COLOR = 'rgba(245, 233, 212, 0.42)';

/**
 * The colour to draw a single reward pip in. While the quest is still
 * `active` each pip takes its KIND hue (gold/green/violet) so the reward
 * type scans by colour; once `completed` every pip drops to one dim tint so
 * the earned reward recedes. Pure: a static palette lookup keyed on the kind
 * + the done flag.
 */
export function rewardGlyphColor(kind: RewardGlyphKind, done: boolean): string {
  return done ? REWARD_GLYPH_DONE_COLOR : REWARD_GLYPH_COLOR[kind];
}

/**
 * A small "xN" tag for a busy reward pip cluster, so a player reads HOW MANY
 * payouts a quest gives without counting the pips. Returns "x4" once a reward
 * stacks 3+ pips (e.g. gold + two item types + a cosmetic), '' for the common
 * 1-2 pip rewards where the pips are trivially countable. Pure: just the pip
 * count — never disagrees with questRewardGlyphs since it reads its length.
 */
export function rewardGlyphCountTag(glyphs: readonly RewardGlyphKind[]): string {
  return glyphs.length >= 3 ? `x${glyphs.length}` : '';
}

/**
 * Format a quest's reward block as a single line.
 *   `{gold:50, items:{tomato:3}}` → "+50g, +3 tomato"
 *   `{gold:10}`                   → "+10g"
 *   `{cosmetic:'sunhat'}`         → "+sunhat"
 */
export function formatReward(reward: QuestReward): string {
  const parts: string[] = [];
  if (reward.gold) parts.push(`+${reward.gold}g`);
  if (reward.items) {
    for (const [k, v] of Object.entries(reward.items)) {
      parts.push(`+${v} ${k.replace('_harvest', '')}`);
    }
  }
  if (reward.cosmetic) parts.push(`+${reward.cosmetic}`);
  return parts.length === 0 ? '—' : parts.join(', ');
}

/** A short \"what to do next\" hint per quest description. Falls back to the description. */
export function questHint(q: Quest): string {
  if (q.complete) return 'Done.';
  // Use the existing description as the next-step hint; it already
  // reads as an instruction ("Plant your first seed.").
  return q.description;
}

/** Build the full panel snapshot from the player's quests. */
export function buildQuestLog(player: Player): QuestLogEntry[] {
  const quests = (player.quests as Quest[]) ?? [];
  // Active first, then completed. Within each, preserve catalog order.
  const out: QuestLogEntry[] = [];
  for (const q of quests) {
    if (!q.complete) {
      out.push({
        id: q.id,
        name: q.name,
        description: q.description,
        status: 'active',
        progress: q.progress,
        goal: q.goal,
        rewardLine: formatReward(q.reward),
        rewardGlyphs: questRewardGlyphs(q.reward),
        hint: questHint(q),
      });
    }
  }
  for (const q of quests) {
    if (q.complete) {
      out.push({
        id: q.id,
        name: q.name,
        description: q.description,
        status: 'completed',
        progress: q.goal,
        goal: q.goal,
        rewardLine: formatReward(q.reward),
        rewardGlyphs: questRewardGlyphs(q.reward),
        hint: 'Done.',
      });
    }
  }
  return out;
}

/** Totals for the panel header. */
export function questCounts(player: Player): { active: number; completed: number; total: number } {
  const quests = (player.quests as Quest[]) ?? [];
  let active = 0;
  let completed = 0;
  for (const q of quests) {
    if (q.complete) completed++;
    else active++;
  }
  return { active, completed, total: quests.length };
}

/** A glanceable progress digest for the quest-log header. */
export interface QuestProgressSummary {
  /** Whole-percent of quests completed (0..100), 0 when there are none. */
  completedPct: number;
  /**
   * The active quest nearest completion — highest progress/goal fraction,
   * ties broken by FEWER steps remaining, then catalog order. Null when
   * every quest is done (or there are none), so the header can fall back
   * to a plain "all done" note.
   */
  closest: { name: string; progress: number; goal: number } | null;
}

/**
 * Digest the quest board for the header: an overall completion percentage
 * plus the active quest nearest to done, so a player opening the log sees
 * BOTH how far along the whole board is and what they're about to finish —
 * the same "surface the shape" move the almanac count summary makes. Pure:
 * reads only player.quests. The percentage floors to a whole number; the
 * "closest" pick maximises progress/goal (a quest with no goal can't
 * occur — goals are always >= 1), tie-breaks to the one with the fewest
 * remaining steps, then keeps catalog order via a stable scan.
 */
export function questProgressSummary(player: Player): QuestProgressSummary {
  const quests = (player.quests as Quest[]) ?? [];
  const total = quests.length;
  const completed = quests.filter((q) => q.complete).length;
  const completedPct = total === 0 ? 0 : Math.floor((completed / total) * 100);

  let closest: { name: string; progress: number; goal: number } | null = null;
  let bestFrac = -1;
  let bestRemaining = Infinity;
  for (const q of quests) {
    if (q.complete) continue;
    const goal = Math.max(1, q.goal);
    const frac = q.progress / goal;
    const remaining = goal - q.progress;
    // Strictly-greater keeps the first-seen (catalog order) on a tie of
    // fraction; within an equal fraction prefer fewer remaining steps.
    if (frac > bestFrac || (frac === bestFrac && remaining < bestRemaining)) {
      bestFrac = frac;
      bestRemaining = remaining;
      closest = { name: q.name, progress: q.progress, goal: q.goal };
    }
  }
  return { completedPct, closest };
}

/**
 * Whole-board progress as a single fraction: the sum of every quest's
 * progress over the sum of every quest's goal, so a partly-done board reads
 * as ONE shape rather than only a count of finished quests. Where
 * questProgressSummary.completedPct is binary per quest (done or not), this
 * blends the in-flight quests in: a board where two quests are 90% along
 * shows real momentum even though zero are complete. Completed quests count
 * full progress (== goal). Returns {done,total} so the panel can draw a thin
 * overall bar and a "47 / 80 steps" caption. total is always >= 0; a board
 * with no quests (or all-zero goals) yields {done:0,total:0} and the panel
 * suppresses the bar. Pure: reads only player.quests.
 */
export interface QuestBoardProgress {
  /** Summed progress across all quests, clamped to each goal. */
  done: number;
  /** Summed goal across all quests. */
  total: number;
}

export function questBoardProgress(player: Player): QuestBoardProgress {
  const quests = (player.quests as Quest[]) ?? [];
  let done = 0;
  let total = 0;
  for (const q of quests) {
    const goal = Math.max(0, q.goal);
    total += goal;
    done += Math.min(goal, Math.max(0, q.progress));
  }
  return { done, total };
}

/** Whole-board progress as a 0..1 fraction; 0 when there's nothing to do. Pure. */
export function questBoardFraction(progress: QuestBoardProgress): number {
  return progress.total <= 0 ? 0 : progress.done / progress.total;
}

/** The work LEFT on the board: how many active quests and steps remain. */
export interface QuestRemaining {
  /** Active (incomplete) quests still on the board. */
  quests: number;
  /** Summed remaining steps (goal - clamped progress) across active quests. */
  steps: number;
}

/**
 * Pair the whole-board progress bar with the work that's actually LEFT: the
 * count of still-active quests and the total steps remaining across them, so
 * the player reads remaining effort as a figure rather than eyeballing the
 * bar's empty tail. Completed quests contribute zero remaining steps; an
 * over-progressed quest clamps to its goal so steps never go negative. Pure:
 * reads only player.quests.
 */
export function questActiveRemaining(player: Player): QuestRemaining {
  const quests = (player.quests as Quest[]) ?? [];
  let active = 0;
  let steps = 0;
  for (const q of quests) {
    if (q.complete) continue;
    active += 1;
    const goal = Math.max(0, q.goal);
    steps += Math.max(0, goal - Math.min(goal, Math.max(0, q.progress)));
  }
  return { quests: active, steps };
}

/**
 * "3 quests, 11 steps left" caption for the active remaining work, pluralised
 * cleanly, or '' when the board is fully clear (nothing active) so the panel
 * collapses the line. Pure.
 */
export function questRemainingLabel(r: QuestRemaining): string {
  if (r.quests <= 0) return '';
  const q = `${r.quests} quest${r.quests === 1 ? '' : 's'}`;
  const s = `${r.steps} step${r.steps === 1 ? '' : 's'} left`;
  return `${q}, ${s}`;
}

/** Earn-state bucket for the panel's section dividers. */
export type QuestSectionKey = 'active' | 'completed';

/** A contiguous run of quest rows under one divider header. */
export interface QuestSection {
  key: QuestSectionKey;
  /** Divider label, e.g. "ACTIVE". */
  header: string;
  rows: QuestLogEntry[];
}

/** Header text per status, in display order. */
const QUEST_SECTION_HEADER: Record<QuestSectionKey, string> = {
  active: 'ACTIVE',
  completed: 'DONE',
};

/**
 * Group quest rows into ACTIVE / DONE sections so the log reads as "what
 * I'm working on / what I've finished" instead of one flat scroll keyed
 * only by a pip colour. Active first (the live work), done last. buildQuestLog
 * already emits active-then-completed in catalog order, so each section
 * keeps that order; empty sections are omitted so a board with no completed
 * quests doesn't show a bare DONE header. Pure — mirrors achievementSections.
 */
export function questLogSections(rows: readonly QuestLogEntry[]): QuestSection[] {
  const order: QuestSectionKey[] = ['active', 'completed'];
  const out: QuestSection[] = [];
  for (const key of order) {
    const status: QuestStatus = key === 'active' ? 'active' : 'completed';
    const group = rows.filter((r) => r.status === status);
    if (group.length > 0) {
      out.push({ key, header: QUEST_SECTION_HEADER[key], rows: group });
    }
  }
  return out;
}

/**
 * Panel-local quest filter so a player on a long board can isolate just
 * the active work (or just review what they've finished) without scanning
 * past the other group. Cycles all -> active -> done, each keeping one
 * QuestStatus (all keeps everything). The quest log is a non-blocking
 * read-while-walking overlay with no a/d nav, so a panel-local `f` cycle
 * is the right shape (mirrors the money-log / almanac / codex filters);
 * the global fishing `f` is guarded against the open panel.
 */
export type QuestFilter = 'all' | 'active' | 'done';

/** Cycle order for the `f` keypress. */
export const QUEST_FILTERS: readonly QuestFilter[] = ['all', 'active', 'done'] as const;

/** Advance to the next filter, wrapping at the end. Pure. */
export function cycleQuestFilter(f: QuestFilter): QuestFilter {
  const i = QUEST_FILTERS.indexOf(f);
  return QUEST_FILTERS[(i + 1) % QUEST_FILTERS.length];
}

/** Short chip label for the active filter. Pure. */
export function questFilterLabel(f: QuestFilter): string {
  return f; // 'all' / 'active' / 'done' read fine as-is.
}

/**
 * Keep only the quest rows matching the active filter, by status. 'all'
 * returns the input untouched (a fresh array for caller safety),
 * preserving the active-then-done order in every case. Pure.
 */
export function applyQuestFilter(
  rows: readonly QuestLogEntry[],
  filter: QuestFilter,
): QuestLogEntry[] {
  if (filter === 'all') return rows.slice();
  const status: QuestStatus = filter === 'active' ? 'active' : 'completed';
  return rows.filter((r) => r.status === status);
}
