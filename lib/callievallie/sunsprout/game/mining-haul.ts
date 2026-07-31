// Mining haul tally — what gems the player has pulled out of the
// cave so far on the current "run".
//
// "Run" here means "since you last slept". The player heads down to
// the cave entrance, strikes ore until they're out of stamina, then
// either drinks a tea or walks home. A tally that resets on sleep
// gives the player a clean ledger of "how productive was today's
// expedition" — useful both for celebrating a fat run (5 rubies in
// a morning!) and for spotting a frustrating one (8 strikes, all
// copper, time to swap pickaxe).
//
// Pure module: no IO, no canvas. The engine bumps the tally on
// every successful strike (via recordMined()) and resets it on
// sleep (via resetMineHaul()). The dawn toast surfaces the prior
// run's totals as a "yesterday's haul:" tail, and the bath-house /
// sleep summary can also read the running totals.
//
// Why a dedicated module rather than a field on Player.inventory:
// inventory is what's IN your bag; the haul tally has to survive a
// well-sell that empties the bag mid-day, so it's its own counter.

import type { Player } from '../world/world';
import type { GemKey } from './gems';
import { GEMS, GEM_KEYS } from './gems';
import { oneShotBrag } from './dawn-toast';

/** Per-(GemKey) tally of how many of that gem the player has mined this run. */
export interface MineHaulState {
  /**
   * Map of GemKey -> count mined this run. Missing keys mean 0; we
   * store only nonzero entries so a fresh save's tally object stays
   * empty and serialises tightly.
   */
  counts: Partial<Record<GemKey, number>>;
  /**
   * Tally of the PREVIOUS run — captured at sleep time so the dawn
   * toast can read "Yesterday's haul: ...". Reset to a fresh shape
   * (empty counts + 0 gold) on a save that's never slept.
   */
  lastRun: {
    counts: Partial<Record<GemKey, number>>;
    /** Sum of GEMS[k].sellPrice * counts[k] at sleep time. */
    gold: number;
  };
  /**
   * Lifetime per-gem tally — never resets, separate from `counts` so
   * the "what did I mine today" recap stays clean while a parallel
   * career counter accrues. Bumped alongside `counts` on every
   * recordMined call. Optional because older saves predate it; the
   * lazy reader fills it on first read.
   */
  lifetimeCounts?: Partial<Record<GemKey, number>>;
  /**
   * All-time heaviest single-run record. Captured at sleep time when
   * the just-completed run beats either the count OR the gold record
   * (independently — a pure-iron grind can hold the gold record while
   * a multi-copper run holds the count record). Optional because older
   * saves predate it; the lazy reader fills it on first read.
   *
   * The recorded `day` is the in-game day the run was captured (i.e.
   * the day the player slept), so the ribbon can read "best run ever:
   * 14 gems on day 23" without keeping a separate timestamp field.
   */
  bestRun?: {
    /** Highest total count ever recorded for one run. */
    count: number;
    /** Day of the count-leader run. */
    countDay: number;
    /**
     * Per-gem composition of the count-leader run. Lets the lore
     * Gems tab footer surface a breakdown ("best run was 4 copper,
     * 3 ruby, 2 emerald") rather than the bare aggregate. Optional
     * because older saves predate it — lazy reader fills the existing
     * `count` total but leaves `countComposition` undefined.
     */
    countComposition?: Partial<Record<GemKey, number>>;
    /** Highest total gold value ever recorded for one run. */
    gold: number;
    /** Day of the gold-leader run. */
    goldDay: number;
    /**
     * Per-gem composition of the gold-leader run. Same lazy-backfill
     * contract as countComposition — older saves keep `gold` but
     * leave `goldComposition` undefined.
     */
    goldComposition?: Partial<Record<GemKey, number>>;
  };
  /**
   * One-shot sticky flag: set to true inside resetMineHaul the FIRST
   * time a recap promotes bestRun past either deep-vein threshold.
   * The dawn-toast composer reads this flag, surfaces a celebratory
   * "Deep Vein unlocked" tail, and bumps `deepVeinBragFired` to keep
   * the brag from repeating on subsequent dawns.
   *
   * Two separate flags so the composer can decide "is the brag
   * pending?" (`deepVeinBragPending`) without reading or mutating
   * the "already fired" state, and the morning-after compose can
   * one-shot it cleanly. Optional because older saves predate them;
   * the lazy reader fills them in on first read.
   */
  deepVeinBragPending?: boolean;
  /**
   * Set the morning the brag tail fires. Stays true forever so a
   * future cap-promoting run doesn't fire the brag again — once the
   * player has been told "Deep Vein unlocked" the achievement is
   * theirs, and a bigger record afterward just lives in haulBestRunLine.
   */
  deepVeinBragFired?: boolean;
  /**
   * One-shot "your mining records just diverged onto two different
   * days" arm — set inside resetMineHaul the FIRST time bestRun
   * transitions from a same-day record (countDay === goldDay, i.e.
   * one run holds both leaderboards) into a split-record state
   * (countDay !== goldDay, i.e. two different runs hold the two
   * records).
   *
   * Why a separate brag rather than tucking the split-record signal
   * into the existing "best run ever!" tail: the split-record state
   * is a STRATEGIC milestone — it means the player has built up two
   * meaningfully distinct mining run shapes (a fat-quantity grind
   * and a value-density trip). The existing record-fell tail fires
   * on EVERY record bump, so the split-record moment would get
   * buried inside the normal record-fell celebration. A dedicated
   * one-shot brag the morning after the divergence first happens
   * surfaces the moment the player's mining career splits into two
   * strategies.
   *
   * Optional + lazy-backfill so older saves (single-day records OR
   * already-split records that pre-date the flag) backfill cleanly.
   * The pre-flag check inside resetMineHaul guards against a save
   * that was ALREADY split on first migration arming the brag — we
   * only arm on the dawn the split FIRST happens during play.
   */
  splitRecordBragPending?: boolean;
  /**
   * Audit flag set the morning the split-record brag fires for the
   * first time. Stays true forever so a future records-merge-back
   * (when a new single run blows past both records and re-unifies
   * them on the same day) followed by another split doesn't re-fire
   * the brag — once the player has been told "your mining career
   * has two specialised paths now," that observation has been made.
   * Optional + lazy-backfill on first read.
   */
  splitRecordBragFired?: boolean;
}

/** Threshold for the lifetime-mining achievement / "Rockhound II". */
export const LIFETIME_MINING_MILESTONE = 100;

/**
 * Per-gem floor for the `vein-connoisseur` achievement — the player
 * must have mined AT LEAST this many of EVERY gem type to earn the
 * badge.
 *
 * Tuned at 10 so the milestone reads as "you've worked every vein the
 * cave has to offer," not just "you got lucky once." 10 of each
 * across the five gem types (copper / iron / silver / gold / ruby) =
 * 50 total — half the LIFETIME_MINING_MILESTONE cave-veteran bar, so
 * a player chasing this badge can earn it while still tracking
 * toward cave-veteran. The threshold is per-gem rather than total
 * because the existing cave-veteran badge already covers the total-
 * mining grind; this badge specifically rewards BREADTH of the
 * mining work — you can't shortcut it with a one-gem grind.
 */
export const VEIN_CONNOISSEUR_PER_GEM = 10;

/** Lazy reader on the Player. */
export function getMineHaul(player: Player): MineHaulState {
  const p = player as Player & { mineHaul?: MineHaulState };
  if (!p.mineHaul) {
    p.mineHaul = { counts: {}, lastRun: { counts: {}, gold: 0 }, lifetimeCounts: {} };
  }
  // Older saves predate the lifetime field — backfill so reads are safe.
  if (!p.mineHaul.lifetimeCounts) p.mineHaul.lifetimeCounts = {};
  return p.mineHaul;
}

/**
 * Bump the haul tally by one for `gem`. Called from the engine's
 * mining strike branch right after a strike lands and the inventory
 * is credited. Bumps BOTH the current-run count and the lifetime
 * counter so the career milestone never has to be reconstructed.
 */
export function recordMined(player: Player, gem: GemKey): void {
  const state = getMineHaul(player);
  state.counts[gem] = (state.counts[gem] ?? 0) + 1;
  state.lifetimeCounts = state.lifetimeCounts ?? {};
  state.lifetimeCounts[gem] = (state.lifetimeCounts[gem] ?? 0) + 1;
}

/**
 * Total gems mined this run, across all gem types.
 */
export function haulCount(state: MineHaulState): number {
  let n = 0;
  for (const k of GEM_KEYS) n += state.counts[k] ?? 0;
  return n;
}

/**
 * Sum of GEMS[k].sellPrice * count for every gem in the haul. Pure
 * read — doesn't care whether the player has actually sold the haul
 * or is still carrying it, so the number on the toast matches the
 * "what could you get for this" calculation the player makes in their
 * head.
 */
export function haulGold(state: MineHaulState): number {
  let g = 0;
  for (const k of GEM_KEYS) g += (state.counts[k] ?? 0) * GEMS[k].sellPrice;
  return g;
}

/**
 * Lifetime total gems mined across the player's career, across all
 * gem types. Backed by lifetimeCounts which is bumped on every
 * recordMined call.
 */
export function lifetimeHaulCount(state: MineHaulState): number {
  const life = state.lifetimeCounts ?? {};
  let n = 0;
  for (const k of GEM_KEYS) n += life[k] ?? 0;
  return n;
}

/**
 * Lifetime gem-sell value: sum of GEMS[k].sellPrice * lifetimeCounts[k].
 * Useful for an "all-time-haul" tag in the lore panel without storing
 * a redundant gold field.
 */
export function lifetimeHaulGold(state: MineHaulState): number {
  const life = state.lifetimeCounts ?? {};
  let g = 0;
  for (const k of GEM_KEYS) g += (life[k] ?? 0) * GEMS[k].sellPrice;
  return g;
}

/**
 * True iff the lifetime tally has crossed the LIFETIME_MINING_MILESTONE
 * threshold. Wired into the achievements catalog.
 */
export function lifetimeMiningMilestoneReached(state: MineHaulState): boolean {
  return lifetimeHaulCount(state) >= LIFETIME_MINING_MILESTONE;
}

/**
 * True iff the lifetime tally has reached VEIN_CONNOISSEUR_PER_GEM of
 * EVERY gem type. Reads the existing lifetimeCounts map populated by
 * recordMined — no new persisted state. Backfills via the lazy reader
 * (lifetimeCounts is initialized to an empty object on first read),
 * so older saves walk this predicate cleanly and return false until
 * the player has earned enough of every gem.
 *
 * Lazy-ledger pattern — same shape as cave-veteran (lifetime total),
 * deep-vein (single-run records), and the compost / owl / cooking
 * lifetime predicates. Wired into the achievements catalog.
 */
export function veinConnoisseurMilestoneReached(state: MineHaulState): boolean {
  const life = state.lifetimeCounts ?? {};
  for (const k of GEM_KEYS) {
    if ((life[k] ?? 0) < VEIN_CONNOISSEUR_PER_GEM) return false;
  }
  return true;
}

/**
 * Single-run milestone thresholds for the `deep-vein` achievement —
 * unlock when EITHER bestRun.count crosses DEEP_VEIN_COUNT OR
 * bestRun.gold crosses DEEP_VEIN_GOLD. Either dimension lights it
 * up so a quantity grind (20+ copper run) and a value grind (one fat
 * ruby trip) both have a path to the badge.
 *
 * Tuning intent: DEEP_VEIN_COUNT=20 is roughly 2x the mining-run
 * \"fat haul\" milestone (10), and DEEP_VEIN_GOLD=1000 is 2x the
 * \"cart's full\" gold milestone (500). The single-run ribbon is the
 * mid-game checkpoint between the per-run milestones (which fire
 * mid-cave) and the lifetime cave-veteran badge (100 gems total).
 */
export const DEEP_VEIN_COUNT = 20;
export const DEEP_VEIN_GOLD = 1000;

/**
 * True iff the player has captured a bestRun that crosses EITHER the
 * count threshold OR the gold threshold. Reads bestRun off the same
 * lazy field captured at sleep so the badge doesn't need its own
 * persisted counter. Returns false on saves that have never recorded
 * a run (bestRun absent), so a fresh save reads quiet.
 */
export function deepVeinMilestoneReached(state: MineHaulState): boolean {
  const best = state.bestRun;
  if (!best) return false;
  return best.count >= DEEP_VEIN_COUNT || best.gold >= DEEP_VEIN_GOLD;
}

/**
 * Snapshot the current run into lastRun and clear the running
 * tally. Called from the sleep path so "yesterday's haul" reads
 * the run the player just slept off, not the one they're starting.
 *
 * Also updates the all-time `bestRun` ribbon when the just-completed
 * run beats either the count or gold record (independently). The
 * `day` arg is captured into bestRun.countDay / goldDay so the
 * ribbon line can name the day the record was set. Defaults to 0
 * for callers that pre-date the day-aware path — older saves and
 * unit fixtures keep working with no behavioral change.
 *
 * Returns the previous run's totals as a convenience to callers that
 * want to surface a "you mined N gems for Xg yesterday" toast right
 * after sleep without a second helper call.
 */
export function resetMineHaul(
  player: Player,
  day: number = 0,
): {
  counts: Partial<Record<GemKey, number>>;
  gold: number;
  total: number;
} {
  const state = getMineHaul(player);
  const counts = { ...state.counts };
  const gold = haulGold(state);
  const total = haulCount(state);
  state.lastRun = { counts, gold };
  state.counts = {};
  // Update the all-time ribbon. Skip on empty runs so a sleep on a
  // no-mining day doesn't reset the day field of a real record.
  if (total > 0 || gold > 0) {
    const ribbon = state.bestRun ?? { count: 0, countDay: 0, gold: 0, goldDay: 0 };
    // Capture the pre-update threshold state so we can detect a FRESH
    // crossing — the brag tail fires only the first time bestRun moves
    // past either deep-vein threshold, so a player who is well past the
    // bar and breaks their own record AGAIN doesn't re-fire the brag.
    const wasPastDeepVein =
      ribbon.count >= DEEP_VEIN_COUNT || ribbon.gold >= DEEP_VEIN_GOLD;
    // Capture the pre-update split-record state too. A "split-record"
    // is when countDay !== goldDay AND both fields are non-zero (a
    // fresh save with both at 0 is not a "split" — neither record has
    // been set yet). We only arm splitRecordBragPending on the FIRST
    // transition from same-day to split, so a record that's already
    // split before this resetMineHaul call doesn't re-arm.
    const wasSplit =
      ribbon.count > 0 && ribbon.gold > 0 && ribbon.countDay !== ribbon.goldDay;
    if (total > ribbon.count) {
      ribbon.count = total;
      ribbon.countDay = day;
      // Snapshot the composition so the lore Gems-tab footer can
      // surface a per-gem breakdown of the count-leader run rather
      // than just the aggregate.
      ribbon.countComposition = { ...counts };
    }
    if (gold > ribbon.gold) {
      ribbon.gold = gold;
      ribbon.goldDay = day;
      ribbon.goldComposition = { ...counts };
    }
    state.bestRun = ribbon;
    // Fresh deep-vein crossing — set the one-shot pending flag if the
    // brag hasn't already fired before. The dawn composer reads + bumps
    // deepVeinBragFired separately so a save reloaded after the brag
    // fired stays quiet.
    const nowPastDeepVein =
      ribbon.count >= DEEP_VEIN_COUNT || ribbon.gold >= DEEP_VEIN_GOLD;
    if (!wasPastDeepVein && nowPastDeepVein && !state.deepVeinBragFired) {
      state.deepVeinBragPending = true;
    }
    // Fresh split-record state — arm the brag iff we just transitioned
    // from same-day records to split-day records AND both records are
    // non-zero (i.e. a real record exists on each axis). The
    // splitRecordBragFired audit gates re-firing.
    const nowSplit =
      ribbon.count > 0 && ribbon.gold > 0 && ribbon.countDay !== ribbon.goldDay;
    if (!wasSplit && nowSplit && !state.splitRecordBragFired) {
      state.splitRecordBragPending = true;
    }
  }
  return { counts, gold, total };
}

/**
 * Pretty status line for the dawn toast. Returns the empty string
 * when the player didn't mine anything yesterday so the dawn toast
 * stays uncluttered on quiet days.
 *
 * Wording: "Yesterday's haul: 3 copper, 1 ruby (worth 164g)."
 *
 * When the just-recapped run BEAT either the count or gold record
 * (matching state.bestRun.countDay / goldDay on day-aware callers),
 * the line gains a " - best run ever!" suffix so the player gets
 * direct feedback that a record fell. Pure tail — silent on every
 * other dawn so a normal day doesn't carry the brag.
 *
 * When the just-recapped run did NOT beat the record but came close
 * (>= RECORD_GAP_NAG_MIN_PCT of either axis), the line gains a
 * " — N% of your best" tail so the player tracking the record gets
 * one-glance context on the gap. Silent on tiny runs (well under
 * the threshold) so a quiet day stays quiet.
 */
export function haulYesterdayLine(state: MineHaulState): string {
  const { counts, gold } = state.lastRun;
  let total = 0;
  for (const k of GEM_KEYS) total += counts[k] ?? 0;
  if (total === 0) return '';
  const parts: string[] = [];
  // Walk GEM_KEYS in catalog order so the line reads consistently.
  for (const k of GEM_KEYS) {
    const c = counts[k] ?? 0;
    if (c > 0) parts.push(`${c} ${GEMS[k].name.toLowerCase()}`);
  }
  const base = `Yesterday's mine haul: ${parts.join(', ')} (worth ${gold}g).`;
  // Record tail — only when the just-recapped lastRun matches the
  // current best on either dimension. We use exact equality (not
  // >=) so the tail fires only when a NEW record was just captured
  // by resetMineHaul; reading the same lastRun on a subsequent
  // dawn (after another sleep that didn't move the bar) stays
  // quiet. count and gold are checked independently so a
  // pure-iron grind that breaks the gold record without touching
  // the count record still fires the celebration.
  const best = state.bestRun;
  if (best && (best.count === total || best.gold === gold)) {
    const tag =
      best.count === total && best.gold === gold
        ? 'best run ever — count + gold!'
        : best.count === total
          ? 'best run ever for count!'
          : 'best run ever for gold!';
    return `${base} - ${tag}`;
  }
  // Gap-to-best nag — only fires when the player actually HAS a
  // captured bestRun on either axis, and yesterday's run was close
  // enough (>= RECORD_GAP_NAG_MIN_PCT) to be worth surfacing. We
  // pick the higher of the two percentages (count% vs gold%) so
  // a run that's a near-record on gold but weak on count still
  // surfaces the encouraging number. Silent when both percentages
  // sit below the nag floor so a one-copper-pity-run stays quiet.
  const nag = recordGapNagLine(state);
  if (nag) return `${base} - ${nag}`;
  return base;
}

/**
 * Halfway nag floor — only surface the "X% of your best" tail when
 * yesterday's run sits at or above this fraction of the captured
 * best. Below that the player is too far off the record for the
 * gap to feel motivating; above it, the close-but-not-quite signal
 * is precisely the encouragement we want to provide.
 *
 * Tuned at 50% so a half-as-productive day still gets a callout —
 * generous enough that most mining runs trigger it once the player
 * has built up a real record, restrictive enough that a one-copper
 * day after a 14-gem PB stays silent.
 */
export const RECORD_GAP_NAG_MIN_PCT = 50;

/**
 * Pretty "N% of your best" tail for the dawn toast. Returns the
 * empty string when:
 *   - bestRun is absent (fresh save)
 *   - lastRun already broke the record (haulYesterdayLine handles
 *     the brag tail in that case — we don't double-surface)
 *   - the closer of (count%, gold%) sits below RECORD_GAP_NAG_MIN_PCT
 *
 * Pure tail; reads only from `state` so the caller doesn't have to
 * thread anything new.
 */
export function recordGapNagLine(state: MineHaulState): string {
  const best = state.bestRun;
  if (!best) return '';
  const { counts, gold } = state.lastRun;
  let total = 0;
  for (const k of GEM_KEYS) total += counts[k] ?? 0;
  if (total === 0) return '';
  // If we just MATCHED either record this is a "best ever" run; the
  // brag tail in haulYesterdayLine handles it.
  if (best.count === total || best.gold === gold) return '';
  const countPct = best.count > 0 ? Math.floor((total / best.count) * 100) : 0;
  const goldPct = best.gold > 0 ? Math.floor((gold / best.gold) * 100) : 0;
  // Pick the higher of the two percentages so a near-record on one
  // axis still surfaces the encouragement.
  const top = Math.max(countPct, goldPct);
  if (top < RECORD_GAP_NAG_MIN_PCT) return '';
  // Cap at 99% — exact 100% lands in the "record matched" branch
  // above (which we already early-returned from).
  const pct = Math.min(99, top);
  return `${pct}% of your best run`;
}

/**
 * Pretty all-time ribbon line — surfaces the current bestRun record
 * regardless of whether yesterday's run beat it. Useful as a passive
 * stat line on a stats panel or the lore Gems tab footer. Returns
 * the empty string when the player has never recorded a run, so a
 * fresh save reads quiet.
 *
 * Wording:
 *   - same run holds both records:    "best run: 14 gems / 510g (day 23)"
 *   - split records:                   "best run: 14 gems (day 23) / 510g (day 31)"
 */
export function haulBestRunLine(state: MineHaulState): string {
  const best = state.bestRun;
  if (!best || (best.count === 0 && best.gold === 0)) return '';
  // Treat "day 0" as "unknown day" — fall back to a no-day variant so
  // older saves that captured a ribbon before the day field existed
  // still read sensibly.
  const countDayTag = best.countDay > 0 ? ` (day ${best.countDay})` : '';
  const goldDayTag = best.goldDay > 0 ? ` (day ${best.goldDay})` : '';
  if (best.countDay === best.goldDay) {
    return `best run: ${best.count} gem${best.count === 1 ? '' : 's'} / ${best.gold}g${countDayTag}`;
  }
  return `best run: ${best.count} gem${best.count === 1 ? '' : 's'}${countDayTag} / ${best.gold}g${goldDayTag}`;
}

/**
 * Pretty status line for the running haul — shown when the player
 * presses E at the cave entrance to peek at the day so far. Empty
 * when nothing has been mined yet.
 */
export function haulStatusLine(state: MineHaulState): string {
  const total = haulCount(state);
  if (total === 0) return 'Today\'s haul is empty. Strike some ore.';
  const gold = haulGold(state);
  const parts: string[] = [];
  for (const k of GEM_KEYS) {
    const c = state.counts[k] ?? 0;
    if (c > 0) parts.push(`${c} ${GEMS[k].name.toLowerCase()}`);
  }
  return `Today's haul: ${parts.join(', ')} (worth ${gold}g).`;
}

// ---------------------------------------------------------------------
// Mid-run milestone callouts — when the player crosses an interesting
// total gem count this run, surface a fleeting toast so the player
// gets celebratory feedback without having to walk back to the dawn
// recap. Pure helpers; the engine layer reads previous-count and
// current-count and asks `crossedMilestone(prev, next)` for the
// matching tier, then surfaces a toast.
//
// Why tiered rather than a generic "every 5 gems": the gem economy
// rewards rare gems much more than copper. The tiers are tuned around
// the median per-gem sell price so 3 / 6 / 10 maps to "starting to
// score", "solid morning", "outright fat run". The toast uses
// haulStatusLine() so the player sees the SPECIFIC composition that
// just crossed the bar.
// ---------------------------------------------------------------------

/** Tier thresholds — counts (not gold). Stable order, smallest first. */
export const MINING_RUN_MILESTONES = [3, 6, 10] as const;
export type MiningRunMilestone = (typeof MINING_RUN_MILESTONES)[number];

/** Per-tier label injected into the toast. */
const MILESTONE_LABEL: Record<MiningRunMilestone, string> = {
  3: 'Solid start',
  6: 'Run going strong',
  10: 'Fat haul',
};

/**
 * True iff (prev, next) brackets one of MINING_RUN_MILESTONES — i.e.
 * the player has just crossed a milestone count this strike. Returns
 * the crossed tier or null. When multiple tiers are crossed in a
 * single bump (impossible with the existing +1-per-strike loop but
 * defended for safety), returns the HIGHEST crossed tier.
 *
 * Pure — doesn't read state, doesn't bump counts.
 */
export function crossedMilestone(prev: number, next: number): MiningRunMilestone | null {
  let hit: MiningRunMilestone | null = null;
  for (const tier of MINING_RUN_MILESTONES) {
    if (prev < tier && next >= tier) hit = tier;
  }
  return hit;
}

/**
 * Pretty toast for a milestone cross. Pairs the label with the
 * current haul status line so the player sees both "Run going
 * strong!" and "today's haul: 4 copper, 2 ruby (worth 218g)" in
 * one message. Returns the empty string when no milestone crossed.
 */
export function milestoneToastLine(
  state: MineHaulState,
  milestone: MiningRunMilestone | null,
): string {
  if (milestone === null) return '';
  const status = haulStatusLine(state);
  return `${MILESTONE_LABEL[milestone]}! ${status}`;
}

// ---------------------------------------------------------------------
// Mid-run GOLD milestone callouts — pair the count milestones above
// with a parallel gold-value tier so a pure-iron grind (low count,
// high gold) still surfaces a celebration as the haul value swells.
//
// Why the gold pair: the count milestones are great for "I'm still
// in the cave, gimme dopamine" — but a player striking iron after
// iron after iron can spend a long stretch under 3 gems while the
// gold value runs past 200g. The gold callout closes that gap so
// "fat haul, ALL of it copper" and "fat haul, two cave rubies"
// both light up the strike toast.
//
// The two milestone systems are independent — a single strike CAN
// cross both the count tier AND the gold tier in the same bump
// (rare gem on the 6th-gem strike). The engine layer composes both
// tails onto the strike toast; the gold tail follows the count tail
// so display order matches "count first, value second".
//
// Tiers tuned around the median per-gem sell value (copper=12g) so
// 100g lands roughly when the count tier 6 fires for a balanced
// haul; 250g lands when the haul is rich with iron/silver; 500g
// captures the late-game "ruby spike" most pure-quantity haul
// graphs never reach.
// ---------------------------------------------------------------------

/** Tier thresholds — haul gold value. Stable order, smallest first. */
export const MINING_RUN_GOLD_MILESTONES = [100, 250, 500] as const;
export type MiningRunGoldMilestone = (typeof MINING_RUN_GOLD_MILESTONES)[number];

/** Per-tier label injected into the gold-milestone toast. */
const GOLD_MILESTONE_LABEL: Record<MiningRunGoldMilestone, string> = {
  100: 'Pockets clinking',
  250: 'Now we\'re cooking',
  500: 'Cart\'s full',
};

/**
 * True iff (prev, next) brackets one of MINING_RUN_GOLD_MILESTONES — i.e.
 * the player has just crossed a gold-value milestone this strike. Returns
 * the crossed tier or null. When multiple tiers are crossed in a single
 * bump (rare gem lifts the value over two tiers at once), returns the
 * HIGHEST crossed tier so the celebration matches the biggest leap.
 *
 * Pure — doesn't read state, doesn't bump counts.
 */
export function crossedGoldMilestone(
  prev: number,
  next: number,
): MiningRunGoldMilestone | null {
  let hit: MiningRunGoldMilestone | null = null;
  for (const tier of MINING_RUN_GOLD_MILESTONES) {
    if (prev < tier && next >= tier) hit = tier;
  }
  return hit;
}

/**
 * Pretty toast for a gold milestone cross. Pairs the label with the
 * current haul gold value so the player sees both "Pockets clinking!"
 * and "haul value: 124g" in one message. Returns the empty string
 * when no tier crossed.
 *
 * Wording is deliberately distinct from the count tiers ("solid
 * start" / "fat haul") so when both fire at once the player sees
 * two clearly different celebrations rather than redundant phrasing.
 */
export function goldMilestoneToastLine(
  state: MineHaulState,
  milestone: MiningRunGoldMilestone | null,
): string {
  if (milestone === null) return '';
  const gold = haulGold(state);
  return `${GOLD_MILESTONE_LABEL[milestone]}! Haul value: ${gold}g.`;
}

// ---------------------------------------------------------------------
// Deep Vein dawn brag — one-shot celebratory tail the morning AFTER
// the player's bestRun crossed either deep-vein threshold for the
// first time. The badge gets granted by tickAchievements every-frame
// and posts its own "Achievement unlocked" toast, but that single
// toast competes with the dawn-toast composition AND doesn't give the
// player the specific composition that earned it. The dawn brag is a
// dedicated tail naming the gem-count and gold value of the record
// run, surfaced on the dawn-toast chain so it lives alongside the
// haulYesterdayLine + ribbon brag rather than racing against them.
//
// Design: the flag is set inside resetMineHaul on the sleep that
// captures the fresh crossing, so the SAME dawn that surfaces the
// haulYesterdayLine + "best run ever!" brag also surfaces the deep-
// vein brag tail. One-shot: bumps deepVeinBragFired so re-reading
// the helper after the brag has fired returns the empty string.
// ---------------------------------------------------------------------

/**
 * Returns the deep-vein dawn-brag tail, or the empty string if there's
 * no fresh crossing to celebrate. ONE-SHOT — bumps `deepVeinBragFired`
 * on the state as a side effect, so a re-call returns empty.
 *
 * Wording (depends on which axis hit first):
 *   count-only crossing:  "Deep Vein unlocked — N gems pulled out in one run."
 *   gold-only crossing:   "Deep Vein unlocked — Ng of ore in one run."
 *   both axes at once:    "Deep Vein unlocked — N gems / Ng in one run."
 *
 * The composer naming the SPECIFIC numbers from the just-captured
 * bestRun is the whole point of having a dedicated tail rather than
 * relying on the generic "Achievement unlocked" toast: the player
 * gets to see the run that did it. Reads bestRun.count + .gold off
 * the state — never re-derives them from the inventory or lastRun,
 * which would be wrong on a "best gold run dwarfed the count run"
 * split-record save where the deep-vein bar was crossed via gold.
 */
export function deepVeinDawnBrag(state: MineHaulState): string {
  return oneShotBrag(
    state as unknown as Record<string, unknown>,
    'deepVeinBragPending',
    'deepVeinBragFired',
    () => {
      const best = state.bestRun;
      if (!best) return '';
      const countHit = best.count >= DEEP_VEIN_COUNT;
      const goldHit = best.gold >= DEEP_VEIN_GOLD;
      if (countHit && goldHit) {
        return `Deep Vein unlocked - ${best.count} gems / ${best.gold}g in one run.`;
      }
      if (countHit) {
        return `Deep Vein unlocked - ${best.count} gem${best.count === 1 ? '' : 's'} pulled out in one run.`;
      }
      // gold-only crossing — name only the gold so the player knows
      // which axis tripped the bar (a 3-ruby trip might be only 4
      // gems but 1500g).
      return `Deep Vein unlocked - ${best.gold}g of ore in one run.`;
    },
  );
}

// ---------------------------------------------------------------------
// Split-record dawn brag — one-shot celebratory tail the morning AFTER
// the player's bestRun transitions from a same-day record (one run
// holds both count + gold leaderboards) into a split-record state
// (countDay !== goldDay, two different runs hold the two records).
//
// The split-record state is a STRATEGIC milestone: it means the player
// has built up two meaningfully distinct mining run shapes — a fat-
// quantity grind (many copper, lots of total ore) holds the count
// record, while a value-density trip (one ruby, one emerald, few
// strikes) holds the gold record. The dedicated brag fires once on
// the dawn the two records diverge for the first time, surfacing the
// "your mining career has two specialisations now" observation.
//
// Wording: "Split mining records - count run on day N, gold run on day M."
//
// One-shot via the generic oneShotBrag helper. splitRecordBragFired
// stays true forever so a future merge-back (one new fat run that
// blows past both records) followed by another split doesn't
// re-fire — once the player has been told their career has split
// strategies, that observation has been made.
// ---------------------------------------------------------------------

/**
 * Returns the split-record dawn-brag tail, or the empty string if there's
 * no fresh split-record crossing to celebrate. ONE-SHOT — clears
 * splitRecordBragPending and sets splitRecordBragFired so a re-call
 * returns empty.
 *
 * Wording: "Split mining records - count run on day N, gold run on day M."
 *
 * Returns the empty string when:
 *   - splitRecordBragPending is falsy (no fresh transition)
 *   - bestRun is somehow missing (defensive — the arming logic only
 *     fires when bestRun is present, but the read-side check defends
 *     against a save with a stale pending flag and a wiped record)
 */
export function splitRecordDawnBrag(state: MineHaulState): string {
  return oneShotBrag(
    state as unknown as Record<string, unknown>,
    'splitRecordBragPending',
    'splitRecordBragFired',
    () => {
      const best = state.bestRun;
      if (!best) return '';
      return `Split mining records - count run on day ${best.countDay}, gold run on day ${best.goldDay}.`;
    },
  );
}

// ---------------------------------------------------------------------
// Best-run composition formatter — surfaces the per-gem breakdown of
// the captured bestRun ribbon for the lore Gems-tab footer. The
// breakdown lives alongside the aggregate haulBestRunLine: the
// aggregate reads "best run: 14 gems / 510g (day 23)", the breakdown
// reads "made of: 4 copper, 3 ruby, 2 emerald" so the player gets
// both the headline and the receipts.
//
// Two compositions are tracked independently — countComposition for
// the count-leader run and goldComposition for the gold-leader run.
// They might be the same run (most common) or two different runs
// (split-record save). The formatter prefers the count-leader when
// both axes share a day; on a split-record save it shows the
// count-leader breakdown so the "fat haul" composition is the
// surfaced one (the player can still see the gold record's day from
// haulBestRunLine).
// ---------------------------------------------------------------------

/**
 * Returns a pretty per-gem breakdown of the bestRun composition, or
 * the empty string when no record has been captured yet OR the
 * composition wasn't snapshotted (older saves predate the
 * composition fields). Wording:
 *
 *   "made of: 4 copper, 3 ruby, 2 emerald"
 *
 * Walks GEM_KEYS in catalog order so the line reads consistently
 * across calls (no key-iteration order surprises). Pure — doesn't
 * mutate state.
 */
export function bestRunCompositionLine(state: MineHaulState): string {
  const best = state.bestRun;
  if (!best) return '';
  // Prefer the count-leader composition; fall back to the gold-leader
  // if the count-leader's composition wasn't snapshotted (e.g. older
  // save with a count record from before the composition field
  // existed). Empty when both are missing.
  const comp = best.countComposition ?? best.goldComposition;
  if (!comp) return '';
  const parts: string[] = [];
  for (const k of GEM_KEYS) {
    const c = comp[k] ?? 0;
    if (c > 0) parts.push(`${c} ${GEMS[k].name.toLowerCase()}`);
  }
  if (parts.length === 0) return '';
  return `made of: ${parts.join(', ')}`;
}

/**
 * Returns the split-record composition line, surfacing BOTH the
 * count-leader composition AND the gold-leader composition when the
 * two records were set on different days (countDay !== goldDay).
 * Empty string when the two records were set on the same day (only
 * one composition exists) OR when no record is captured.
 *
 * Wording on a split-record save:
 *
 *   "count run: 8 copper, 4 iron · gold run: 1 ruby, 1 emerald"
 *
 * Useful for the journal page where the player can see why a 3-gem
 * "gold run" outweighs a 12-gem "count run" — the breakdown shows
 * the gem mix that drove each record.
 */
export function bestRunSplitCompositionLine(state: MineHaulState): string {
  const best = state.bestRun;
  if (!best) return '';
  if (best.countDay === best.goldDay) return '';
  const countComp = best.countComposition;
  const goldComp = best.goldComposition;
  if (!countComp || !goldComp) return '';
  const countParts: string[] = [];
  const goldParts: string[] = [];
  for (const k of GEM_KEYS) {
    const cc = countComp[k] ?? 0;
    if (cc > 0) countParts.push(`${cc} ${GEMS[k].name.toLowerCase()}`);
    const gc = goldComp[k] ?? 0;
    if (gc > 0) goldParts.push(`${gc} ${GEMS[k].name.toLowerCase()}`);
  }
  if (countParts.length === 0 || goldParts.length === 0) return '';
  return `count run: ${countParts.join(', ')} - gold run: ${goldParts.join(', ')}`;
}


