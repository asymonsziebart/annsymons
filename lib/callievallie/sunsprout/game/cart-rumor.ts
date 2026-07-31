// Roving merchant rumor — Pip drops a deterministic hint each visit
// about the catalog row he plans to feature on his NEXT visit. The
// rumor is computed from (current season + 1) so the player can plan a
// gold pile across the season ahead without having to scrub-save.
//
// Wiring intent:
//   - dawn toast on Pip's visit day appends "Pip says: '<rumor>'"
//   - the cart menu footer shows "Next season's headliner: <label>"
//
// Mechanics intent:
//   - the hint references the SAME catalog Pip would normally sell;
//     no separate "rumor catalog" so players never feel teased into a
//     "look but can't buy" item.
//   - rumors rotate per season — the same season always picks the same
//     row, so reload-scumming a particular visit doesn't change it.
//   - decor rows (`decor-...`) are filtered out — the player has only
//     a few decor pieces and re-headlining the same wallpaper across
//     two consecutive seasons feels stale.
//   - the rumor row may or may not match what Pip's catalog actually
//     "features" — there's no upcharge or limited stock today. The
//     hint is pure flavor + light planning aid.
//
// Pure module: no IO, no canvas. The Game wires the dawn toast tail;
// the CartMenu draws the footer line.

import { CART_CATALOG, SPA_PASS_REFILL_KEY } from './cart';
import type { CartItem } from './cart';

/**
 * Deterministic hash mix of a season index into a [0..N) bucket.
 * Pulled out so tests can assert determinism without re-importing the
 * private constant. Pure 32-bit avalanche.
 */
function rumorHash(season: number): number {
  let h = ((season + 1) * 1903911167) ^ 0xdeadbeef;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Returns the CartItem Pip will tease THIS visit (i.e. the headliner
 * for his next visit, which lands in `season + 1`). Skips decor rows
 * so the same wallpaper doesn't headline two seasons in a row.
 *
 * Empty pool would never happen with the real catalog, but the guard
 * keeps tests happy if a future catalog change ever drops every
 * non-decor row.
 */
export function rumorItemForSeason(season: number): CartItem | null {
  // Pool of non-decor rows. Sort by key so the indexing stays stable
  // regardless of CART_CATALOG declaration order. Filters out the
  // spa-pass-refill row too — that row is gated by canRefillSpaPass()
  // and a fresh-game player who never bought a pass would see Pip
  // headline an item they're not allowed to buy. Decor rows already
  // get the same treatment for the wallpaper-spam reason.
  const pool = CART_CATALOG
    .filter((row) => !row.key.startsWith('decor-') && row.key !== SPA_PASS_REFILL_KEY)
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key));
  if (pool.length === 0) return null;
  const idx = rumorHash((season + 1) % 4) % pool.length;
  return pool[idx];
}

/**
 * The headliner Pip teased on the PREVIOUS visit — i.e. the one he
 * promised to "lead with" this season. Used by the gold-back perk:
 * buying THIS row at the cart pays a 5% rebate because the player
 * showed up for what Pip pre-announced.
 *
 * `season + 3` is congruent to `season - 1` mod 4, which feeds the
 * same `(season + 1) % 4` term used by rumorItemForSeason — keeps
 * the wraparound math single-sourced.
 */
export function currentSeasonHeadliner(season: number): CartItem | null {
  return rumorItemForSeason(season + 3);
}

/** True iff `itemKey` matches the headliner Pip teased last visit. */
export function isCurrentHeadlinerKey(season: number, itemKey: string): boolean {
  const headliner = currentSeasonHeadliner(season);
  return headliner !== null && headliner.key === itemKey;
}

/**
 * Percentage of the buy price refunded when the player buys the
 * headliner. 5% is enough to feel like a reward for paying attention,
 * not enough to make the headliner the only sensible buy each season.
 */
export const RUMOR_REBATE_PCT = 0.05;

/** Gold rebate (rounded down) for a buy of `buyPrice` on the headliner. */
export function rumorRebateAmount(buyPrice: number): number {
  return Math.floor(buyPrice * RUMOR_REBATE_PCT);
}

/**
 * Returns the headliner label Pip wants to tease this visit. Returns
 * an empty string when there's no eligible row.
 */
export function rumorHeadlineLabelFor(season: number): string {
  const row = rumorItemForSeason(season);
  return row ? row.label : '';
}

/**
 * Pretty in-quote rumor line for the dawn toast. Returns an empty
 * string when the pool is empty.
 */
export function rumorToastLine(season: number): string {
  const row = rumorItemForSeason(season);
  if (!row) return '';
  return `Pip says: "Eyes on the ${row.label} next season — I'll lead with it."`;
}

/** Pretty footer line for the cart menu. */
export function rumorFooterLine(season: number): string {
  const row = rumorItemForSeason(season);
  if (!row) return '';
  return `Next visit's headliner: ${row.label}`;
}

// ---------------------------------------------------------------------
// Rumor history — track the last RUMOR_HISTORY_CAP headliners and
// whether the player bought each one. Persists on the player as a
// small ring buffer so the cart menu can show "you snubbed the
// barometer two seasons ago" and the panel can list a season-by-
// season ledger.
//
// We use the cart-menu controller as the trigger point: every time
// Pip's cart opens, we capture the season's headliner into history
// (if it isn't already there), and the cart-buy hook stamps the
// matching entry as bought. A pure module — the engine wires the
// two stamps; no IO here.
// ---------------------------------------------------------------------

/** Max number of rumor history entries retained on the player. */
export const RUMOR_HISTORY_CAP = 4;

/** Single row in the player's rumor history. */
export interface RumorHistoryEntry {
  /** Season index Pip teased this headliner in (0..3). */
  season: number;
  /** Cart catalog key of the headliner. */
  itemKey: string;
  /** Pretty label snapshot — saves a CART_CATALOG re-lookup at render time. */
  label: string;
  /** Buy price snapshot. */
  buyPrice: number;
  /** True iff the player bought the row while it was the headliner. */
  bought: boolean;
}

/** Per-player rumor history (newest at the END). */
export interface RumorHistoryState {
  entries: RumorHistoryEntry[];
}

/** Lazy reader. Mirrors the lazy pattern in other game/* modules. */
export function getRumorHistory(player: object): RumorHistoryState {
  const p = player as { rumorHistory?: RumorHistoryState };
  if (!p.rumorHistory) p.rumorHistory = { entries: [] };
  return p.rumorHistory;
}

/**
 * Record THIS season's headliner into history if it isn't already
 * the last entry. Called by the cart-menu open hook so a single
 * visit produces a single entry regardless of how many times the
 * player open-closes the menu.
 *
 * Returns the entry that landed (or the already-present one). Idempotent.
 */
export function recordRumorVisit(
  player: object,
  season: number,
): RumorHistoryEntry | null {
  const row = currentSeasonHeadliner(season);
  if (!row) return null;
  const state = getRumorHistory(player);
  const last = state.entries[state.entries.length - 1];
  if (last && last.season === season && last.itemKey === row.key) {
    return last;
  }
  const entry: RumorHistoryEntry = {
    season,
    itemKey: row.key,
    label: row.label,
    buyPrice: row.buyPrice,
    bought: false,
  };
  state.entries.push(entry);
  // Trim from the FRONT so the newest RUMOR_HISTORY_CAP entries survive.
  if (state.entries.length > RUMOR_HISTORY_CAP) {
    state.entries.splice(0, state.entries.length - RUMOR_HISTORY_CAP);
  }
  return entry;
}

/**
 * Stamp the latest history entry as bought when (and only when) the
 * player buys the row that matches the current season's headliner.
 * Called by the cart buy path AFTER the buy succeeds. Idempotent on
 * a re-stamp of the same season's headliner.
 */
export function recordRumorBuy(
  player: object,
  season: number,
  itemKey: string,
): boolean {
  if (!isCurrentHeadlinerKey(season, itemKey)) return false;
  const state = getRumorHistory(player);
  // Walk backwards; the matching entry will almost always be the last,
  // but a player can hop seasons without buying and still want past
  // matches to remain accurate.
  for (let i = state.entries.length - 1; i >= 0; i--) {
    const e = state.entries[i];
    if (e.season === season && e.itemKey === itemKey) {
      e.bought = true;
      return true;
    }
  }
  return false;
}

/** Season-index → human label used for history lines. */
const RUMOR_SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/**
 * Pretty per-entry line — "Spring: Brass Barometer (300g) - bought"
 * or "...  skipped". Pure formatter.
 */
export function rumorHistoryEntryLine(entry: RumorHistoryEntry): string {
  const season = RUMOR_SEASON_NAMES[Math.abs(entry.season) % 4] ?? 'Spring';
  const stamp = entry.bought ? 'bought' : 'skipped';
  return `${season}: ${entry.label} (${entry.buyPrice}g) — ${stamp}`;
}

/**
 * Full history block as an array of lines (newest first), or a single
 * "No rumor history yet." line when the ring is empty. Used by the
 * cart-menu footer / lore panel / future rumor-history panel.
 */
export function rumorHistoryLines(player: object): string[] {
  const entries = getRumorHistory(player).entries;
  if (entries.length === 0) return ['No rumor history yet — Pip will start teasing soon.'];
  // Newest first feels more natural for a "what just happened" list.
  return entries.slice().reverse().map(rumorHistoryEntryLine);
}

/**
 * Short summary used inline somewhere we have limited room — e.g.
 * the dawn-toast tail when Pip arrives could fold the "you've
 * snubbed Pip's last 2 picks" into the existing flavour line.
 *
 * Returns the empty string when the ring is empty.
 */
export function rumorHistorySummary(player: object): string {
  const entries = getRumorHistory(player).entries;
  if (entries.length === 0) return '';
  let bought = 0;
  for (const e of entries) if (e.bought) bought += 1;
  return `Headliners: ${bought}/${entries.length} bought.`;
}

// ---------------------------------------------------------------------
// Rumor streak — buying three headliners in a row stacks a per-buy
// discount on the next headliner Pip teases. Rewards the player for
// actually paying attention to the rumor instead of skimming past it.
//
// The streak is derived purely from rumorHistory.entries[] — no extra
// persistence shape. Cycle:
//   - rumorStreakCount(player) walks back from the end while bought
//     stays true; stops at the first skip / start of history.
//   - rumorStreakDiscount(buyPrice, streak) returns the gold to
//     subtract from THIS visit's headliner buy. Tuned to be visible
//     without eclipsing the 5% rumor rebate.
//   - buyRumorStreakDiscount(player, season, buyPrice) is the one-call
//     entry point for the cart-buy hook: returns 0 when the row isn't
//     this season's headliner or the streak is below the floor.
// ---------------------------------------------------------------------

/** Streak floor — discount only applies once the player has bought
 * RUMOR_STREAK_MIN headliners in a row. */
export const RUMOR_STREAK_MIN = 3;

/** Per-streak-step gold discount cap — two steps of 5g each (10g cap).
 * Calibrated against RUMOR_HISTORY_CAP=4: the streak can never exceed
 * 4 trailing bought entries, so 2 steps over the floor of 3 lands the
 * cap right at the history limit. Past the cap the player still keeps
 * the streak (and the existing 5% rebate from rumor-rebate), but the
 * stacking discount doesn't grow infinitely. */
export const RUMOR_STREAK_DISCOUNT_STEP = 5;
export const RUMOR_STREAK_MAX_STEPS = 2;

/**
 * Number of trailing bought=true entries on the player's rumor
 * history. Returns 0 when the latest entry is a skip OR the history
 * is empty. Pure read.
 */
export function rumorStreakCount(player: object): number {
  const entries = getRumorHistory(player).entries;
  let n = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (!entries[i].bought) break;
    n += 1;
  }
  return n;
}

/**
 * Gold discount to subtract from a headliner buy at this streak
 * count. Returns 0 below RUMOR_STREAK_MIN; otherwise scales
 * 5g/streak step over the floor, capped at RUMOR_STREAK_MAX_STEPS
 * steps so the discount tops out at 15g.
 *
 * The discount also never exceeds buyPrice (a 5g item should never
 * cost a negative amount), and never goes below 0.
 */
export function rumorStreakDiscount(buyPrice: number, streak: number): number {
  if (streak < RUMOR_STREAK_MIN) return 0;
  const stepsOver = Math.min(streak - RUMOR_STREAK_MIN + 1, RUMOR_STREAK_MAX_STEPS);
  const raw = stepsOver * RUMOR_STREAK_DISCOUNT_STEP;
  return Math.max(0, Math.min(raw, buyPrice));
}

/**
 * Computes the streak discount THIS visit's headliner is eligible
 * for. Returns 0 when the player isn't buying the headliner OR the
 * streak is below the floor.
 *
 * The streak count read here is the count BEFORE the current buy
 * is recorded — recordRumorBuy fires AFTER the buy path, so a buy
 * that *crosses* the floor will see the post-cross discount on the
 * NEXT headliner, not this one. That matches the "earned by three
 * in a row, applied to the next" framing in the rumor-streak label.
 */
export function buyRumorStreakDiscount(
  player: object,
  season: number,
  itemKey: string,
  buyPrice: number,
): number {
  if (!isCurrentHeadlinerKey(season, itemKey)) return 0;
  const streak = rumorStreakCount(player);
  return rumorStreakDiscount(buyPrice, streak);
}

/**
 * Pretty footer chip — "streak: 4 bought (-15g on headliners)" or
 * "streak: 2 bought (1 to unlock)" for the cart-menu rumor footer.
 * Returns the empty string at streak=0 so a never-bought save stays
 * uncluttered.
 */
export function rumorStreakLine(player: object): string {
  const streak = rumorStreakCount(player);
  if (streak === 0) return '';
  if (streak < RUMOR_STREAK_MIN) {
    const need = RUMOR_STREAK_MIN - streak;
    return `streak: ${streak} bought (${need} to unlock).`;
  }
  // streak >= floor → compute the discount on a 100g reference price
  // (any nonzero buyPrice clears the cap math the same way).
  const disc = rumorStreakDiscount(100, streak);
  return `streak: ${streak} bought (-${disc}g on headliners).`;
}
