// Friendship tournament — a seasonal village competition.
//
// Once per season on day 6 (the day before each festival), the village
// hosts a friendly contest at the well. The kind rotates with the
// season:
//
//   Spring -> Flower Show       (count `flower_harvest`)
//   Summer -> Fishing Derby     (count every `fish-*` in the bag)
//   Fall   -> Harvest Weigh-In  (count every `_harvest`)
//   Winter -> Cooking Cook-Off  (count every `dish-*`)
//
// The contest runs 14:00-18:00. The player walks to the well in that
// window and presses E to ENTER — the count is read RIGHT THEN (the
// items stay in their bag, that's a feature, not a bug). The score
// is compared to fixed thresholds:
//
//   Bronze (>=  3)  → +100g + bronze ribbon
//   Silver (>=  8)  → +250g + silver ribbon
//   Gold   (>= 18)  → +500g + gold ribbon
//
// A player can enter ONCE per tournament. Re-entering the same season
// shows a "you already won X" toast instead of paying twice.
//
// Pure module: no IO, no canvas. The engine wires the E-press at the
// well + a dawn toast on day 6 announcing the day's event.

import type { Player } from '../world/world';
import type { TimeOfDay } from './time';
import { CROPS, CROP_KEYS } from './crops';
import { FISH_KEYS } from './fish';
import { RECIPE_KEYS, dishInventoryKey } from './cooking';

/** Day of the season the tournament runs. */
export const TOURNAMENT_DAY = 6;
/** Hours the contest is open at the well. */
export const TOURNAMENT_OPEN_HOUR = 14;
export const TOURNAMENT_CLOSE_HOUR = 18;

/** Tournament kinds keyed by season index. */
export const TOURNAMENT_KINDS = ['flower-show', 'fishing-derby', 'harvest-weigh-in', 'cook-off'] as const;
export type TournamentKind = (typeof TOURNAMENT_KINDS)[number];

/** Pretty label per kind for toasts and the future panel. */
export const TOURNAMENT_LABELS: Record<TournamentKind, string> = {
  'flower-show': 'Spring Flower Show',
  'fishing-derby': 'Summer Fishing Derby',
  'harvest-weigh-in': 'Fall Harvest Weigh-In',
  'cook-off': 'Winter Cooking Cook-Off',
};

/** Inventory key of the trophy ribbon for each tier. */
export const RIBBONS = {
  bronze: 'ribbon-bronze',
  silver: 'ribbon-silver',
  gold: 'ribbon-gold',
} as const;

export type RibbonTier = keyof typeof RIBBONS;

/** Thresholds the player must clear for each tier. Tuned cozy. */
export const TIER_THRESHOLD: Record<RibbonTier, number> = {
  bronze: 3,
  silver: 8,
  gold: 18,
};

/** Gold paid per tier. */
export const TIER_GOLD: Record<RibbonTier, number> = {
  bronze: 100,
  silver: 250,
  gold: 500,
};

/** Per-Player record of past entries. */
export interface TournamentState {
  /** Map: `${season}-${kind}` -> { day, tier, score }. */
  entries: Record<string, { day: number; tier: RibbonTier | 'none'; score: number }>;
}

/** Lazy reader. */
export function getTournament(player: Player): TournamentState {
  const p = player as Player & { tournament?: TournamentState };
  if (!p.tournament) p.tournament = { entries: {} };
  return p.tournament;
}

/** Pick the day's tournament kind from the season index. */
export function tournamentKindToday(time: TimeOfDay): TournamentKind | null {
  if (time.day !== TOURNAMENT_DAY) return null;
  return TOURNAMENT_KINDS[time.season];
}

/** True when the contest is currently open at the well. */
export function tournamentOpen(time: TimeOfDay): boolean {
  if (tournamentKindToday(time) === null) return false;
  return time.hour >= TOURNAMENT_OPEN_HOUR && time.hour < TOURNAMENT_CLOSE_HOUR;
}

/** Stable key used in the entries map. */
function entryKey(season: number, kind: TournamentKind): string {
  return `${season}-${kind}`;
}

/** True iff the player already entered this season's contest. */
export function alreadyEntered(player: Player, time: TimeOfDay): boolean {
  const kind = tournamentKindToday(time);
  if (!kind) return false;
  return entryKey(time.season, kind) in getTournament(player).entries;
}

/** Sum the player's inventory across the keys relevant to the given kind. */
export function scoreFor(player: Player, kind: TournamentKind): number {
  let n = 0;
  if (kind === 'flower-show') {
    n += player.inventory['flower_harvest'] ?? 0;
    n += player.inventory['flower_harvest_silver'] ?? 0;
    n += player.inventory['flower_harvest_gold'] ?? 0;
  } else if (kind === 'fishing-derby') {
    for (const fk of FISH_KEYS) {
      n += player.inventory[`fish-${fk}`] ?? 0;
    }
  } else if (kind === 'harvest-weigh-in') {
    for (const ck of CROP_KEYS) {
      if (!CROPS[ck]) continue;
      n += player.inventory[`${ck}_harvest`] ?? 0;
      n += player.inventory[`${ck}_harvest_silver`] ?? 0;
      n += player.inventory[`${ck}_harvest_gold`] ?? 0;
    }
  } else if (kind === 'cook-off') {
    for (const rk of RECIPE_KEYS) {
      n += player.inventory[dishInventoryKey(rk)] ?? 0;
    }
  }
  return n;
}

/** Highest tier the score earns, or 'none' if below bronze. */
export function tierFor(score: number): RibbonTier | 'none' {
  if (score >= TIER_THRESHOLD.gold) return 'gold';
  if (score >= TIER_THRESHOLD.silver) return 'silver';
  if (score >= TIER_THRESHOLD.bronze) return 'bronze';
  return 'none';
}

/** Outcome of an enter() call. */
export type TournamentOutcome =
  | { kind: 'won'; tier: RibbonTier; score: number; gold: number; ribbon: string; label: string }
  | { kind: 'entered-no-prize'; score: number; label: string }
  | { kind: 'already-entered'; tier: RibbonTier | 'none'; score: number; label: string }
  | { kind: 'not-open' };

/**
 * Enter today's tournament. Reads the relevant score, computes the
 * tier, drops the ribbon + gold into the player's bag, and records
 * the entry so a re-press returns 'already-entered'.
 */
export function enterTournament(player: Player, time: TimeOfDay): TournamentOutcome {
  if (!tournamentOpen(time)) return { kind: 'not-open' };
  const kind = tournamentKindToday(time)!;
  const label = TOURNAMENT_LABELS[kind];
  if (alreadyEntered(player, time)) {
    const prev = getTournament(player).entries[entryKey(time.season, kind)];
    return { kind: 'already-entered', tier: prev.tier, score: prev.score, label };
  }
  const score = scoreFor(player, kind);
  const tier = tierFor(score);
  const state = getTournament(player);
  state.entries[entryKey(time.season, kind)] = { day: time.day, tier, score };
  if (tier === 'none') {
    return { kind: 'entered-no-prize', score, label };
  }
  const ribbon = RIBBONS[tier];
  const gold = TIER_GOLD[tier];
  player.gold += gold;
  player.inventory[ribbon] = (player.inventory[ribbon] ?? 0) + 1;
  return { kind: 'won', tier, score, gold, ribbon, label };
}

/** Total ribbons earned across the whole run, by tier. */
export function ribbonCounts(player: Player): Record<RibbonTier, number> {
  return {
    bronze: player.inventory[RIBBONS.bronze] ?? 0,
    silver: player.inventory[RIBBONS.silver] ?? 0,
    gold: player.inventory[RIBBONS.gold] ?? 0,
  };
}

/** A one-line dawn announcement on tournament day. */
export function tournamentDawnLine(time: TimeOfDay): string | null {
  const kind = tournamentKindToday(time);
  if (!kind) return null;
  return `${TOURNAMENT_LABELS[kind]} at the well ${TOURNAMENT_OPEN_HOUR}-${TOURNAMENT_CLOSE_HOUR}h!`;
}

/**
 * Personal-best score for THIS tournament KIND across the player's
 * history. We scan every entries[] record for matching kinds and
 * return the highest score. Returns 0 when the player has never
 * entered this kind.
 *
 * Why kind-keyed rather than (season, kind)-keyed: the player's
 * Spring flower-show PB and their following Spring flower-show PB
 * should compete with each other. The seasonal rotation means there
 * are four flower shows possible per save year, but always THE SAME
 * KIND of contest each Spring.
 */
export function personalBestFor(player: Player, kind: TournamentKind): {
  score: number;
  tier: RibbonTier | 'none';
} {
  const state = getTournament(player);
  let bestScore = 0;
  let bestTier: RibbonTier | 'none' = 'none';
  for (const key of Object.keys(state.entries)) {
    if (!key.endsWith(`-${kind}`)) continue;
    const entry = state.entries[key];
    if (entry.score > bestScore) {
      bestScore = entry.score;
      bestTier = entry.tier;
    }
  }
  return { score: bestScore, tier: bestTier };
}

/**
 * Today's score in the bag IF the player walked up to the well right
 * now. Defers to scoreFor(); a wrapper so callers don't have to know
 * which tournament kind today is.
 */
export function scoreTodayFor(player: Player, time: TimeOfDay): number {
  const kind = tournamentKindToday(time);
  if (!kind) return 0;
  return scoreFor(player, kind);
}

/**
 * Dawn-toast hint that pairs the tournament announce with the
 * player's PB + today's count + the next tier they could clear.
 * Examples:
 *   "Spring Flower Show at the well 14-18h! Carrying 6 — silver
 *    needs 8. (PB: silver at 12.)"
 *   "Summer Fishing Derby at the well 14-18h! No PB yet — bronze
 *    needs 3."
 *
 * Designed to land on the SAME dawn the existing tournamentDawnLine
 * fires, so the player gets the strategic context "what should I
 * be chasing today" alongside the bare event announcement.
 */
export function tournamentNudgeLine(player: Player, time: TimeOfDay): string {
  const kind = tournamentKindToday(time);
  if (!kind) return '';
  const today = scoreFor(player, kind);
  const pb = personalBestFor(player, kind);
  const nextTier = nextTierToClear(today);
  const carryFrag = today > 0 ? `Carrying ${today}` : 'Carrying nothing yet';
  const tierFrag = nextTier
    ? `${nextTier.tier} needs ${nextTier.threshold}`
    : 'maxed (gold) — go for the cleanest sweep';
  const pbFrag = pb.score > 0
    ? `(PB: ${pb.tier === 'none' ? 'no ribbon' : pb.tier} at ${pb.score}.)`
    : '(no PB yet.)';
  return `${carryFrag} — ${tierFrag}. ${pbFrag}`;
}

/**
 * Returns the next tier ABOVE the player's current score, or null
 * when they've already cleared gold. Pure: doesn't read player state.
 */
export function nextTierToClear(score: number): {
  tier: RibbonTier;
  threshold: number;
} | null {
  if (score < TIER_THRESHOLD.bronze) {
    return { tier: 'bronze', threshold: TIER_THRESHOLD.bronze };
  }
  if (score < TIER_THRESHOLD.silver) {
    return { tier: 'silver', threshold: TIER_THRESHOLD.silver };
  }
  if (score < TIER_THRESHOLD.gold) {
    return { tier: 'gold', threshold: TIER_THRESHOLD.gold };
  }
  return null;
}

// ---------------------------------------------------------------------
// Tournament career recap — pulls the whole entries[] map down into a
// one-line "what have I done across the save" recap line. Surfaces on
// the tournament-dawn-line so a player who has never entered any
// tournament before reads "Career: first entry. Take the bronze!"
// and a seasoned cook reads "Career: 12 entries - 4 gold / 3 silver
// / 5 bronze. Best: 24 (Fall Harvest Weigh-In)."
//
// Pure module-side helper so the engine just appends the line to the
// existing tournamentNudgeLine without growing its own bookkeeping.
// ---------------------------------------------------------------------

/** Aggregate stats across every tournament entry in the player's save. */
export interface TournamentCareer {
  /** Total entries across every season. */
  entries: number;
  /** Per-tier ribbon counts (won prizes, not catalog ribbons). */
  ribbons: Record<RibbonTier, number>;
  /** Highest score ever recorded — null when zero entries. */
  bestScore: number | null;
  /** Kind that scored bestScore — null when zero entries. */
  bestKind: TournamentKind | null;
}

/**
 * Walk the entries[] map and roll up totals + best-ever entry. Returns
 * a fresh aggregate that callers can render into a recap line. The
 * map keys carry the season + kind, so we can pull the bestKind label
 * straight out of the key by parsing.
 *
 * Pure read — doesn't mutate state.
 */
export function tournamentCareer(player: Player): TournamentCareer {
  const state = getTournament(player);
  const career: TournamentCareer = {
    entries: 0,
    ribbons: { bronze: 0, silver: 0, gold: 0 },
    bestScore: null,
    bestKind: null,
  };
  for (const key of Object.keys(state.entries)) {
    const entry = state.entries[key];
    career.entries += 1;
    if (entry.tier !== 'none') {
      career.ribbons[entry.tier] += 1;
    }
    if (career.bestScore === null || entry.score > career.bestScore) {
      career.bestScore = entry.score;
      // Key shape: `${season}-${kind}` — strip the leading "<season>-"
      // off the key to recover the kind suffix.
      const dash = key.indexOf('-');
      if (dash >= 0) {
        const kindStr = key.slice(dash + 1);
        // Tighten the type — only accept valid TournamentKind tags.
        if ((TOURNAMENT_KINDS as readonly string[]).includes(kindStr)) {
          career.bestKind = kindStr as TournamentKind;
        }
      }
    }
  }
  return career;
}

/**
 * Pretty recap line for the dawn-toast career footer. Returns a
 * "first entry" prompt when the player has never entered any
 * tournament so they get a positive on-ramp, otherwise rolls up
 * the gold/silver/bronze tallies and names the best-ever score +
 * kind.
 *
 * Wording examples:
 *   zero entries:        "Career: first entry — take the bronze!"
 *   one prize so far:    "Career: 1 entry - 1 bronze."
 *   several prizes:      "Career: 5 entries - 2 gold / 1 silver / 1 bronze. Best: 22 (Spring Flower Show)."
 *   only no-prize tries: "Career: 3 entries - no ribbons yet. Best: 2 (Summer Fishing Derby)."
 *
 * Pure tail; reads only from `player` via tournamentCareer.
 */
export function tournamentCareerLine(player: Player): string {
  const career = tournamentCareer(player);
  if (career.entries === 0) {
    return `Career: first entry — take the bronze!`;
  }
  const entryNoun = career.entries === 1 ? 'entry' : 'entries';
  const ribbonParts: string[] = [];
  if (career.ribbons.gold > 0) ribbonParts.push(`${career.ribbons.gold} gold`);
  if (career.ribbons.silver > 0) ribbonParts.push(`${career.ribbons.silver} silver`);
  if (career.ribbons.bronze > 0) ribbonParts.push(`${career.ribbons.bronze} bronze`);
  const ribbonStr = ribbonParts.length > 0 ? ribbonParts.join(' / ') : 'no ribbons yet';
  const bestFrag = career.bestScore !== null && career.bestScore > 0 && career.bestKind
    ? ` Best: ${career.bestScore} (${TOURNAMENT_LABELS[career.bestKind]}).`
    : '';
  return `Career: ${career.entries} ${entryNoun} - ${ribbonStr}.${bestFrag}`;
}

/**
 * Extends tournamentNudgeLine with a career-recap tail. The base
 * nudge line surfaces today's strategy ("Carrying 6 - silver needs
 * 8."); the career tail layers the all-time view on top so the
 * player gets BOTH the immediate goal AND the long-term context in
 * one dawn toast.
 *
 * Returns the empty string when it's not a tournament day so the
 * dawn-toast flavor tail stays clean on every other dawn.
 */
export function tournamentNudgeWithCareer(player: Player, time: TimeOfDay): string {
  const nudge = tournamentNudgeLine(player, time);
  if (!nudge) return '';
  const career = tournamentCareerLine(player);
  return `${nudge} ${career}`;
}

// ---------------------------------------------------------------------
// Festival Regular achievement — a career-entries milestone that lights
// up once the player has entered at least FESTIVAL_REGULAR_MILESTONE
// village tournaments across the save.
//
// 4 entries is the natural ceiling: one tournament per season, the
// entries map is keyed by `${season}-${kind}` and enterTournament
// returns 'already-entered' on a re-press in the same season slot
// (year 2 Spring can't add a second entry over year 1 Spring). So
// 4 entries = "you've entered every kind at least once — full
// calendar of festival attendance". Tuned to reward the player who
// has rounded out the four seasonal events rather than only farming
// the one they're best at (e.g. only flower-show every Spring while
// skipping Summer/Fall/Winter).
//
// Predicate reads tournamentCareer().entries off the existing
// aggregate so no new persisted field is needed; the entries map
// already round-trips through serializeGame.
// ---------------------------------------------------------------------

/**
 * Career-entry threshold for the `festival-regular` achievement.
 * Tuned at 4 = the full calendar of tournaments (Spring flower-show,
 * Summer fishing-derby, Fall harvest-weigh-in, Winter cook-off).
 * Below the floor the player is still discovering the festival
 * rotation; above it they've rounded out every season at least once.
 */
export const FESTIVAL_REGULAR_MILESTONE = 4;

/**
 * True iff the player has entered at least FESTIVAL_REGULAR_MILESTONE
 * tournaments across their save. Reads tournamentCareer().entries —
 * no new persisted counter to maintain.
 */
export function festivalRegularMilestoneReached(player: Player): boolean {
  return tournamentCareer(player).entries >= FESTIVAL_REGULAR_MILESTONE;
}

// ---------------------------------------------------------------------
// Tournament Champion achievement — career gold-ribbon milestone that
// lights up once the player has cleared the gold tier on 3 different
// seasonal tournaments. Distinct from Festival Regular (which counts
// raw entries regardless of tier) — Champion is for the player who
// has rounded out the "actually won gold" half of the calendar.
//
// 3 / 4 seasons is the sweet spot: requires a real grind (gold tier
// is the highest threshold at 18, vs bronze at 3), but isn't the
// all-four sweep that would be a perfectionist run gate. Tournament
// entries are slot-capped (one per (season,kind) for the save), so
// `ribbons.gold` can never exceed 4 — making 3 a meaningful but
// achievable target.
//
// Pure lazy-ledger pattern: reads tournamentCareer().ribbons.gold
// off the existing entries map. No new persisted field, no new
// per-day counter, no extra serialize hook. The achievements catalog
// auto-checks it every day rollover.
// ---------------------------------------------------------------------

/**
 * Career gold-ribbon threshold for the `tournament-champion`
 * achievement. Tuned at 3 because:
 *   - 1 gold ribbon = the lucky-day starter
 *   - 2 gold ribbons = a solid two-season run
 *   - 3 gold ribbons = "champion across the calendar" — a deliberate
 *     campaign across most of the year
 *   - 4 gold ribbons = the perfectionist sweep; rare, but a 4-bar
 *     would gate too many players out of the badge
 *
 * 3 reads cleanly against the natural ceiling (4 = one gold per
 * seasonal slot) so a save that's done its homework lights it up
 * without needing the literal-impossible "every single season at
 * gold tier" run.
 */
export const TOURNAMENT_CHAMPION_GOLD_RIBBONS = 3;

/**
 * True iff the player has cleared the gold tier at least
 * TOURNAMENT_CHAMPION_GOLD_RIBBONS times across the save. Reads off
 * the existing tournamentCareer().ribbons.gold aggregate — no new
 * persisted counter to maintain.
 */
export function tournamentChampionMilestoneReached(player: Player): boolean {
  return tournamentCareer(player).ribbons.gold >= TOURNAMENT_CHAMPION_GOLD_RIBBONS;
}
