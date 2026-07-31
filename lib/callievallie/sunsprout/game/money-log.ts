// Money log — a small ring-buffer of the player's most recent gold deltas.
//
// The player's bank account never had any audit trail before. This module
// lets the engine layer record "I just paid you 12g for two wheats" or
// "I just charged you 200g for a bouquet" so the player can open the
// money log (`Q`) and see where the day's coin came from.
//
// We store at most `MAX_ENTRIES` rows in a ring buffer on the Player so
// the log stays tiny in saves. Each row is a JSON-safe object — no
// dates, no Map shenanigans.

import type { Player } from '../world/world';

/** Cap so the log never balloons in old saves. */
export const MAX_ENTRIES = 20;

/** One row in the log. Reason is a short tag the UI can colour-code. */
export interface MoneyLogEntry {
  delta: number;
  reason: string;
  /** In-game day the delta posted. */
  day: number;
}

/** Lazy accessor — creates an empty log on first read. */
export function getMoneyLog(player: Player): MoneyLogEntry[] {
  const p = player as Player & { moneyLog?: MoneyLogEntry[] };
  if (!p.moneyLog) p.moneyLog = [];
  return p.moneyLog;
}

/**
 * Record a delta. Positive numbers are credits (you earned), negative
 * are debits (you spent). Zero-amount calls are no-ops.
 *
 * The newest entry sits at the FRONT of the array so UI rendering is
 * trivial (no extra reverse pass). When the log grows past MAX_ENTRIES
 * we trim from the back.
 */
export function logGold(player: Player, delta: number, reason: string, day: number): void {
  if (delta === 0) return;
  const log = getMoneyLog(player);
  log.unshift({ delta, reason, day });
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
}

/** Total inflow recorded in the log (positive deltas summed). */
export function totalIn(player: Player): number {
  return getMoneyLog(player).reduce((s, e) => s + Math.max(0, e.delta), 0);
}

/** Total outflow recorded in the log (absolute of negative deltas). */
export function totalOut(player: Player): number {
  return getMoneyLog(player).reduce((s, e) => s + Math.max(0, -e.delta), 0);
}

/** Net change recorded in the log. */
export function netChange(player: Player): number {
  return totalIn(player) - totalOut(player);
}

/**
 * Coarse category for a ledger row, used by the money-log panel to draw a
 * per-row colour rail so a busy ledger scans by hue the way the toast
 * stack does. Three buckets:
 *   - `purchase`: money leaving the purse (shop buys, upgrades, soaks,
 *     owl fees, auto-restock). Every spend in the current economy posts a
 *     negative delta, so the sign alone identifies it unambiguously.
 *   - `sale`: a direct goods-sale at a counter (the well, the inn) or the
 *     fishing / mining grade bonus / cart breeder trade-in — income you
 *     earned by handing over produce.
 *   - `reward`: any other credit — streak tips, spouse/hangout gifts,
 *     board + tournament + quest payouts, compost recycle, rumor rebates.
 */
export type MoneyCategory = 'sale' | 'purchase' | 'reward';

/**
 * Reason prefixes that mark a positive delta as a direct goods-sale
 * rather than a reward. Anchored at the start so e.g. "cart: rumor rebate"
 * (a reward) doesn't get swept in by a loose "cart" match — only the
 * literal "cart: breeder trade" sale-back is a sale.
 */
const SALE_REASON_PATTERNS: readonly RegExp[] = [
  /^well:/,
  /^inn:/,
  /^fishing /,
  /^mining /,
  /^cart: breeder trade/,
];

/**
 * Classify a single ledger entry into its colour-rail bucket. Pure: reads
 * only the entry's signed delta + reason text, no player state.
 */
export function classifyMoneyEntry(entry: MoneyLogEntry): MoneyCategory {
  // Money out is always a purchase/spend in the current economy.
  if (entry.delta < 0) return 'purchase';
  // Money in: a counter goods-sale, else a reward/tip/payout.
  for (const re of SALE_REASON_PATTERNS) {
    if (re.test(entry.reason)) return 'sale';
  }
  return 'reward';
}

/**
 * Per-category totals across the whole logged window, derived through
 * classifyMoneyEntry so the breakdown always agrees with the per-row
 * colour rail. `sales` + `rewards` are positive inflows by category;
 * `spent` is the absolute outflow (always >= 0). The three are disjoint
 * and sum back to the gross flow: sales + rewards == totalIn, spent ==
 * totalOut. Pure — reads only the log.
 */
export interface MoneyCategoryTotals {
  sales: number;
  rewards: number;
  spent: number;
}

export function moneyCategoryTotals(player: Player): MoneyCategoryTotals {
  const totals: MoneyCategoryTotals = { sales: 0, rewards: 0, spent: 0 };
  for (const e of getMoneyLog(player)) {
    const cat = classifyMoneyEntry(e);
    if (cat === 'purchase') totals.spent += Math.abs(e.delta);
    else if (cat === 'sale') totals.sales += e.delta;
    else totals.rewards += e.delta;
  }
  return totals;
}

/**
 * One-line "savings rate" caption pairing the totals footer's gross figures
 * into a single read: what fraction of everything that came IN the player
 * kept rather than spent, e.g. "kept 35% of income" / "spent 110% of income"
 * (overspent the window) / "spent it all". Income is sales + rewards; the
 * rate is income-vs-spent so the player sees the SHAPE of the window without
 * mentally dividing the two numbers. '' when nothing has come in (no base to
 * compare against). Pure — derives from the same totals the footer draws.
 */
export function purseSavingsCaption(totals: MoneyCategoryTotals): string {
  const income = totals.sales + totals.rewards;
  if (income <= 0) return '';
  if (totals.spent <= 0) return 'kept all income';
  if (totals.spent >= income) {
    if (totals.spent === income) return 'spent it all';
    return `spent ${Math.round((totals.spent / income) * 100)}% of income`;
  }
  const keptPct = Math.round(((income - totals.spent) / income) * 100);
  return `kept ${keptPct}% of income`;
}

/** A kept/spent split of income, each 0..1, for the thrift mini-gauge. */
export interface PurseSavingsSplit {
  kept: number;
  spent: number;
}

/**
 * Split this window's income into kept-vs-spent fractions so the panel can
 * draw the savings caption's ratio as a tiny shape, not just text. kept =
 * the share of income that stayed in the purse (floored at 0 when the player
 * overspent), spent = the share that went out (capped at 1 so the gauge
 * never overflows on an over-budget window). null when no income (nothing to
 * split — the caption is '' too). Pure, derives from the same totals. */
export function purseSavingsSplit(
  totals: MoneyCategoryTotals,
): PurseSavingsSplit | null {
  const income = totals.sales + totals.rewards;
  if (income <= 0) return null;
  const spent = Math.max(0, Math.min(1, totals.spent / income));
  return { kept: 1 - spent, spent };
}

/**
 * Below this kept-share the window counts as an overspend the panel should
 * flag in colour: the player kept under a fifth of what came in, so the
 * thrift gauge's kept-half flips from sale-green to loss-red rather than just
 * reading as a thin sliver. A fixed threshold (not a gradient) so the cue is
 * an unambiguous on/off the way the seed-warning + reset-danger glyphs are.
 */
export const SAVINGS_LOW_KEPT = 0.2;

/**
 * Whether a savings split is a low-kept (overspend) window — true when the
 * kept share is at or under SAVINGS_LOW_KEPT, so the panel tints the gauge's
 * kept-half red to warn the player they barely banked any of the window's
 * income. null splits (no income) are never low (there's nothing to have
 * kept or spent). Pure: a threshold read over the same split the gauge draws.
 */
export function purseSavingsLow(split: PurseSavingsSplit | null): boolean {
  if (!split) return false;
  return split.kept <= SAVINGS_LOW_KEPT;
}

/**
 * A run of consecutive same-day ledger rows, for the panel's day dividers.
 * `net` is the signed sum of the run's deltas so the divider can carry a
 * tiny per-day subtotal ("Day 4   +85g").
 */
export interface MoneyLogDayGroup {
  day: number;
  net: number;
  entries: MoneyLogEntry[];
}

/**
 * Group the (newest-first) ledger into runs of consecutive same-day rows
 * so the panel can draw a small "Day N" divider above each run and the
 * ledger reads as dated buckets instead of one flat list. Because the log
 * is appended in chronological order (newest unshifted to the front) and
 * trimmed from the back, same-day rows are always contiguous, so a simple
 * consecutive-run split is correct — and stays robust if days ever
 * interleave (it just starts a new group). Each group carries its signed
 * net so the divider can show a per-day subtotal. Pure — reads only the
 * log; preserves the newest-first order.
 */
export function moneyLogDayGroups(player: Player): MoneyLogDayGroup[] {
  return groupMoneyEntriesByDay(getMoneyLog(player));
}

/**
 * Group an arbitrary (newest-first) entry list into consecutive same-day
 * runs — the reusable core behind moneyLogDayGroups, split out so the
 * panel can group a FILTERED slice of the ledger without the run-split
 * logic being duplicated. Pure; preserves input order.
 */
export function groupMoneyEntriesByDay(
  entries: readonly MoneyLogEntry[],
): MoneyLogDayGroup[] {
  const groups: MoneyLogDayGroup[] = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.day === e.day) {
      last.entries.push(e);
      last.net += e.delta;
    } else {
      groups.push({ day: e.day, net: e.delta, entries: [e] });
    }
  }
  return groups;
}

/**
 * Panel-local ledger filter so the player can answer "where did my gold
 * GO this week" without scanning a mixed list. Cycles all -> sales ->
 * rewards -> spending, each isolating one classifyMoneyEntry bucket (all
 * shows everything). The Q panel is non-blocking but has no movement
 * verbs, so a panel-local `f` cycle is safe (the global fishing `f` is
 * still guarded against it like the lore / almanac filters).
 */
export type MoneyFilter = 'all' | 'sales' | 'rewards' | 'spending';

/** Cycle order for the `f` keypress. */
export const MONEY_FILTERS: readonly MoneyFilter[] = [
  'all',
  'sales',
  'rewards',
  'spending',
] as const;

/** Advance to the next filter, wrapping at the end. Pure. */
export function cycleMoneyFilter(f: MoneyFilter): MoneyFilter {
  const i = MONEY_FILTERS.indexOf(f);
  return MONEY_FILTERS[(i + 1) % MONEY_FILTERS.length];
}

/** Short chip label for the active filter. Pure. */
export function moneyFilterLabel(f: MoneyFilter): string {
  return f; // 'all' / 'sales' / 'rewards' / 'spending' read fine as-is.
}

/** Map a filter to the classifyMoneyEntry category it isolates, or null for 'all'. */
function filterCategory(f: MoneyFilter): MoneyCategory | null {
  switch (f) {
    case 'sales':
      return 'sale';
    case 'rewards':
      return 'reward';
    case 'spending':
      return 'purchase';
    case 'all':
      return null;
  }
}

/**
 * Filter a ledger slice to the rows matching the active filter, classified
 * through classifyMoneyEntry so it always agrees with the per-row colour
 * rail. 'all' returns the input untouched (a new array for caller safety).
 * Pure.
 */
export function applyMoneyFilter(
  entries: readonly MoneyLogEntry[],
  filter: MoneyFilter,
): MoneyLogEntry[] {
  const cat = filterCategory(filter);
  if (cat === null) return entries.slice();
  return entries.filter((e) => classifyMoneyEntry(e) === cat);
}

/**
 * One ledger row paired with the gold-on-hand the player held immediately
 * AFTER that row posted, so the panel can draw a faint running-balance
 * column ("= 412g") letting the player trace how the purse reached its
 * current value.
 */
export interface MoneyBalanceRow {
  entry: MoneyLogEntry;
  /** Gold on hand right after this entry posted. */
  balance: number;
}

/**
 * Reconstruct each ledger row's running balance by anchoring on the
 * player's CURRENT gold and walking the newest-first log backwards: the
 * newest entry's balance is exactly `player.gold` (it's the most recent
 * change), and every older row's balance is the current gold minus the
 * sum of every delta that posted AFTER it. Because the log is capped at
 * MAX_ENTRIES the oldest visible balance is still exact — earlier trimmed
 * deltas are already baked into `player.gold`, so anchoring forward keeps
 * every shown figure honest even though we can't see past the window.
 *
 * Returns rows in the same newest-first order as the log, each carrying
 * its source entry so a filtered/grouped view can look its balance up by
 * reference (the filter + day-group pipeline preserves entry identity).
 * Pure: reads only the log + player.gold.
 */
export function runningBalances(player: Player): MoneyBalanceRow[] {
  const log = getMoneyLog(player);
  const out: MoneyBalanceRow[] = [];
  // `newerSum` accumulates the deltas of every row already visited (which
  // are all newer than the current one, since we walk front = newest).
  let newerSum = 0;
  for (const entry of log) {
    out.push({ entry, balance: player.gold - newerSum });
    newerSum += entry.delta;
  }
  return out;
}

/**
 * Build a reference-keyed lookup from ledger entry to its running balance,
 * so a panel walking a FILTERED or day-grouped slice (which preserves the
 * original entry object references) can fetch each row's true balance —
 * computed over the WHOLE log so hidden rows still count toward the
 * figure. Pure.
 */
export function runningBalanceMap(player: Player): Map<MoneyLogEntry, number> {
  const map = new Map<MoneyLogEntry, number>();
  for (const row of runningBalances(player)) map.set(row.entry, row.balance);
  return map;
}

/** Which way the purse moved across the logged window. */
export type PurseDirection = 'up' | 'down' | 'flat';

/**
 * Where the purse started + ended across the whole logged window, derived
 * from the running balances so it agrees with the per-row \"= Ng\" column.
 * The running-balance column shows the purse at each row; this distils it
 * into a one-line trend (\"320g -> 412g  +92g\") so the player reads the
 * NET direction of the window without eyeballing the top + bottom figures.
 */
export interface PurseTrend {
  /** Gold on hand just before the oldest logged row posted. */
  start: number;
  /** Gold on hand now (the newest row's balance == player.gold). */
  end: number;
  /** Signed net change across the window (end - start == netChange). */
  delta: number;
  direction: PurseDirection;
}

/**
 * Reconstruct the purse trend over the whole logged window. Anchors on the
 * running balances: `end` is the newest row's balance (the player's current
 * gold) and `start` is the OLDEST row's balance minus that row's own delta
 * — i.e. the purse just before the window's first recorded change. `delta`
 * is therefore the sum of every logged delta, identical to netChange(), but
 * paired with the endpoints so the panel can show \"start -> end\" alongside
 * the signed move.
 *
 * Returns null when the log has fewer than two rows: a single entry (or an
 * empty ledger) has no span to read a trend across, so the panel suppresses
 * the line rather than show a degenerate \"X -> X\". Pure: reads only the log
 * + player.gold.
 */
export function purseTrend(player: Player): PurseTrend | null {
  const rows = runningBalances(player);
  if (rows.length < 2) return null;
  const end = rows[0].balance; // newest == current gold
  const oldest = rows[rows.length - 1];
  const start = oldest.balance - oldest.entry.delta;
  const delta = end - start;
  const direction: PurseDirection = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return { start, end, delta, direction };
}

/** One vertex of the purse sparkline, normalised into a unit box. */
export interface PurseSparklinePoint {
  /** Horizontal position across the window: 0 (oldest) .. 1 (newest). */
  x: number;
  /** Normalised balance height: 0 (window low) .. 1 (window high). */
  y: number;
}

/**
 * Trace the purse's whole trajectory across the logged window as a
 * normalised polyline, so the money-log header can draw a tiny sparkline of
 * the SHAPE of the window on top of the start -> end endpoints purseTrend
 * already gives. Where purseTrend reports only \\\"320g -> 412g\\\", this shows
 * whether the purse climbed steadily, dipped then recovered, or spiked.
 *
 * Points run oldest-first (left) to newest (right). The first point is the
 * pre-window purse (== purseTrend.start) and each subsequent point is a
 * ledger row's running balance, ending at the newest row's balance (==
 * current gold == purseTrend.end), so the polyline spans EXACTLY the
 * start->end the header text names — N rows yield N+1 points.
 *
 * `x` is evenly spaced across [0,1]; `y` is min-max normalised across all
 * the points so the window's lowest balance sits at 0 and its highest at 1.
 * A perfectly flat window (every balance equal) pins every point at 0.5 so
 * it draws as a centred line rather than dividing by a zero span. Returns
 * null on < 2 rows — the same no-span gate purseTrend uses — so the panel
 * suppresses the sparkline in lock-step with the trend text. Pure: reads
 * only the log + player.gold.
 */
export function purseSparkline(player: Player): PurseSparklinePoint[] | null {
  const rows = runningBalances(player); // newest-first
  if (rows.length < 2) return null;
  // Chronological values: the pre-window start, then each row's balance
  // walked oldest -> newest (rows are newest-first, so iterate in reverse).
  const oldest = rows[rows.length - 1];
  const start = oldest.balance - oldest.entry.delta;
  const values: number[] = [start];
  for (let i = rows.length - 1; i >= 0; i--) values.push(rows[i].balance);
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;
  const n = values.length;
  return values.map((v, i) => ({
    x: n === 1 ? 0 : i / (n - 1),
    y: span === 0 ? 0.5 : (v - min) / span,
  }));
}

/** A marked extreme on the purse sparkline — the window's high or low. */
export interface PurseSparklineMarker {
  /** Normalised position on the sparkline (matches purseSparkline's points). */
  x: number;
  y: number;
  /** The raw gold balance at this vertex. */
  value: number;
}

/** The high + low balance points of the purse sparkline window. */
export interface PurseSparklineExtremes {
  peak: PurseSparklineMarker;
  low: PurseSparklineMarker;
}

/**
 * Find the highest + lowest balance vertices of the purse sparkline so the
 * panel can mark the window's extremes with a dot and name them ("peak Ng /
 * low Ng") rather than leaving the player to eyeball the polyline. Walks the
 * SAME chronological value series purseSparkline plots (pre-window start +
 * each row's running balance), and reports each extreme's normalised (x, y)
 * — identical to the matching purseSparkline point — plus its raw gold value.
 *
 * The FIRST occurrence wins on a tie (the earlier point in the window), so a
 * flat or repeated extreme marks one stable vertex. On a perfectly flat
 * window peak and low coincide at the same y (0.5, matching purseSparkline's
 * flat-pin) and the same value. Returns null on < 2 rows — the same no-span
 * gate purseSparkline uses — so the markers appear in lock-step with the
 * sparkline. Pure: reads only the log + player.gold.
 */
export function purseSparklineExtremes(player: Player): PurseSparklineExtremes | null {
  const points = purseSparkline(player);
  if (!points) return null;
  const rows = runningBalances(player);
  const oldest = rows[rows.length - 1];
  const start = oldest.balance - oldest.entry.delta;
  // Rebuild the same chronological value series purseSparkline plots, so a
  // marker's value lines up with its vertex.
  const values: number[] = [start];
  for (let i = rows.length - 1; i >= 0; i--) values.push(rows[i].balance);
  let peakI = 0;
  let lowI = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[peakI]) peakI = i;
    if (values[i] < values[lowI]) lowI = i;
  }
  return {
    peak: { x: points[peakI].x, y: points[peakI].y, value: values[peakI] },
    low: { x: points[lowI].x, y: points[lowI].y, value: values[lowI] },
  };
}

/**
 * Name the sparkline's marked extremes in plain figures so a colour-blind
 * player reads the window's best + worst purse moments without resolving
 * the bright/dim pips — "peak 412g / low 280g". Mirrors the dot markers
 * exactly (same PurseSparklineExtremes), so the caption can never disagree
 * with what the line shows. Collapses to just the value when peak == low (a
 * flat window) so it doesn't read as a redundant "412g / 412g". '' on a null
 * (no-span) extremes, in lock-step with the sparkline's own suppression.
 * Pure: a formatter, no canvas.
 */
export function purseExtremesCaption(extremes: PurseSparklineExtremes | null): string {
  if (!extremes) return '';
  if (extremes.peak.value === extremes.low.value) return `flat ${extremes.peak.value}g`;
  return `peak ${extremes.peak.value}g / low ${extremes.low.value}g`;
}

/** A pixel cell of a 5x5 purse-direction arrow glyph. */
export type PurseArrowCell = readonly [number, number];

/**
 * A tiny 5x5 arrow per purse direction so the trend reads up/down/flat from a
 * SHAPE, not the \"->\" text: an up-chevron when the window gained, a down-
 * chevron when it lost, a flat bar when it broke even. Drawn left of the
 * \"320g -> 412g\" endpoints in the direction's tint (green/red/dim) so a
 * colour-blind player still parses the move. Pure: a static bitmap the panel
 * paints one device pixel per cell, mirroring the almanac/journal glyph split.
 */
export function purseArrowGlyph(direction: PurseDirection): readonly PurseArrowCell[] {
  if (direction === 'up') {
    return [
      [2, 0],
      [1, 1], [2, 1], [3, 1],
      [0, 2], [2, 2], [4, 2],
      [2, 3],
      [2, 4],
    ];
  }
  if (direction === 'down') {
    return [
      [2, 0],
      [2, 1],
      [0, 2], [2, 2], [4, 2],
      [1, 3], [2, 3], [3, 3],
      [2, 4],
    ];
  }
  // Flat — a centred bar.
  return [
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
  ];
}
