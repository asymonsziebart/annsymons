// Almanac — a forward-looking schedule of village events, aggregated for
// the `0` planner panel. The game already scatters "what's coming up" across
// several systems (festivals, NPC birthdays, Pip's seasonal cart, the
// friendship tournament) but the player had no single place to see the
// next two weeks at a glance. This module pulls every dated event into one
// sorted list of "in N days" entries so the panel can render a clean agenda.
//
// Pure module: consumes the calendar helpers from each system and the
// current TimeOfDay. No canvas, no IO. The 28-day wrap (4 seasons x 7 days)
// mirrors the daysUntil math already used by birthdays.ts / festivals.ts.

import type { TimeOfDay } from './time';
import { SEASONS } from './time';
import type { Player } from '../world/world';
import { birthdayCalendar } from './birthdays';
import { festivalCalendar } from './festivals';
import { CART_VISIT_DAY } from './cart';
import { TOURNAMENT_DAY, TOURNAMENT_KINDS, TOURNAMENT_LABELS } from './tournament';
import { getInvites, HANGOUT_HOUR_START, HANGOUT_HOUR_END } from './hangouts';
import { CANDIDATES } from './hearts';

/** How many days ahead the almanac looks. Two full in-game weeks. */
export const ALMANAC_HORIZON_DAYS = 14;

export type AlmanacKind = 'festival' | 'birthday' | 'cart' | 'tournament' | 'personal';

export interface AlmanacEntry {
  /** Days from today; 0 = today, 1 = tomorrow, ... */
  daysUntil: number;
  /** Category, used for the panel's colour-coding + icon. */
  kind: AlmanacKind;
  /** Short headline, e.g. "Vallie's birthday". */
  title: string;
  /** Optional second-line detail, e.g. "Gifts count 8x". */
  detail: string;
  /** Season index of the event date. */
  season: number;
  /** Day-of-season (1..7) of the event. */
  day: number;
}

/** Calendar index 0..27 for a (season, day-of-season) pair. */
function calIndex(season: number, day: number): number {
  return season * 7 + (day - 1);
}

/** Days from `time` until the next occurrence of (season, day). 0 = today. */
function daysUntil(time: TimeOfDay, season: number, day: number): number {
  const today = calIndex(time.season, time.day);
  const target = calIndex(season, day);
  return (target - today + 28) % 28;
}

/** Season + day for an offset of N days ahead of `time`. */
function dateInDays(time: TimeOfDay, n: number): { season: number; day: number } {
  const idx = (calIndex(time.season, time.day) + n) % 28;
  return { season: Math.floor(idx / 7), day: (idx % 7) + 1 };
}

/**
 * Every dated event within ALMANAC_HORIZON_DAYS of `time`, sorted by how
 * soon it arrives (today first), ties broken by a stable kind order so the
 * agenda reads consistently. Events are de-duplicated only within their own
 * system; two different systems landing on the same day each get a row.
 */
export function buildAlmanac(
  time: TimeOfDay,
  horizon: number = ALMANAC_HORIZON_DAYS,
  player?: Player,
): AlmanacEntry[] {
  const entries: AlmanacEntry[] = [];

  // Festivals (Spring d7 planting fair, Fall d7 harvest festival).
  for (const f of festivalCalendar(time)) {
    if (f.daysUntil > horizon) continue;
    entries.push({
      daysUntil: f.daysUntil,
      kind: 'festival',
      title: f.name,
      detail: f.season === 0 ? 'Seeds half-price' : 'Crops sell 1.5x',
      season: f.season,
      day: f.day,
    });
  }

  // NPC birthdays.
  for (const b of birthdayCalendar(time)) {
    if (b.daysUntil > horizon) continue;
    entries.push({
      daysUntil: b.daysUntil,
      kind: 'birthday',
      title: `${b.name}'s birthday`,
      detail: 'Gifts count 8x',
      season: b.season,
      day: b.day,
    });
  }

  // Pip's travelling cart — day 3 of every season.
  for (let s = 0; s < 4; s++) {
    const d = daysUntil(time, s, CART_VISIT_DAY);
    if (d > horizon) continue;
    entries.push({
      daysUntil: d,
      kind: 'cart',
      title: 'Pip the Peddler visits',
      detail: 'Rare seeds & curios, 9am-6pm',
      season: s,
      day: CART_VISIT_DAY,
    });
  }

  // Friendship tournament — day 6 of every season, kind rotates by season.
  for (let s = 0; s < 4; s++) {
    const d = daysUntil(time, s, TOURNAMENT_DAY);
    if (d > horizon) continue;
    const kind = TOURNAMENT_KINDS[s];
    entries.push({
      daysUntil: d,
      kind: 'tournament',
      title: TOURNAMENT_LABELS[kind],
      detail: 'Friendship contest at the well, 2-6pm',
      season: s,
      day: TOURNAMENT_DAY,
    });
  }

  // Personal commitments — the player's own pending NPC hangout dates.
  // Unlike the village-wide events above, these are deadlines the player
  // accepted (heart-4 invites carry a concrete (season, day) + evening
  // window), so they belong on the planner front-and-centre. Only present
  // when a player is supplied; reuses the same 28-day wrap as everything
  // else. Hour window comes from the hangout constants.
  if (player) {
    for (const iv of getInvites(player)) {
      const d = daysUntil(time, iv.season, iv.day);
      if (d > horizon) continue;
      const name = CANDIDATES[iv.npcId]?.name ?? iv.npcId;
      entries.push({
        daysUntil: d,
        kind: 'personal',
        title: `Hangout with ${name}`,
        detail: `Meet up, ${formatHourWindow(HANGOUT_HOUR_START, HANGOUT_HOUR_END)}`,
        season: iv.season,
        day: iv.day,
      });
    }
  }

  const kindOrder: Record<AlmanacKind, number> = {
    personal: 0,
    festival: 1,
    tournament: 2,
    cart: 3,
    birthday: 4,
  };
  entries.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return kindOrder[a.kind] - kindOrder[b.kind];
  });
  return entries;
}

/** Format a 24h hour window into a cozy "6-8pm" style label. */
function formatHourWindow(startHour: number, endHour: number): string {
  const fmt = (h: number) => {
    const ampm = h < 12 ? 'am' : 'pm';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}${ampm}`;
  };
  return `${fmt(startHour)}-${fmt(endHour)}`;
}

/** Human label for a daysUntil value: "Today", "Tomorrow", "in N days". */
export function whenLabel(daysUntil: number): string {
  if (daysUntil <= 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `in ${daysUntil} days`;
}

/** "Spring 7" style date stamp for an entry. */
export function dateLabel(season: number, day: number): string {
  return `${SEASONS[season] ?? '?'} ${day}`;
}

/**
 * A tiny 5x5 pixel glyph per almanac kind, so each agenda row leads with a
 * recognisable symbol (a cake for a birthday, a tent for a festival, a cart
 * for Pip, a rosette for the tournament, a heart for a personal hangout)
 * instead of a one-letter tag (B/F/P/T/M) the player has to decode. The
 * panel draws each filled cell in the kind's rail colour, matching the bag /
 * quest glyph language. This module OWNS the shape (a pure bitmap of [col,
 * row] pixels on a 5x5 grid); the panel owns the pixels. Pure: a static
 * lookup, no canvas.
 */
export type AlmanacGlyphCell = readonly [number, number];

const ALMANAC_KIND_GLYPH: Record<AlmanacKind, readonly AlmanacGlyphCell[]> = {
  // Birthday — a cake: a candle flame on top, a body with a frosting line.
  birthday: [
    [2, 0],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
    [0, 3], [2, 3], [4, 3],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
  ],
  // Festival — a tent / bunting peak: a triangle on a base line.
  festival: [
    [2, 0],
    [1, 1], [2, 1], [3, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
    [0, 3], [2, 3], [4, 3],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
  ],
  // Cart — Pip's wagon: a box on two wheels.
  cart: [
    [0, 0], [1, 0], [2, 0], [3, 0],
    [0, 1], [3, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
    [1, 3], [3, 3],
    [1, 4], [3, 4],
  ],
  // Tournament — a rosette / award: a round medal over two ribbon tails.
  tournament: [
    [1, 0], [2, 0], [3, 0],
    [0, 1], [2, 1], [4, 1],
    [1, 2], [2, 2], [3, 2],
    [1, 3], [3, 3],
    [0, 4], [4, 4],
  ],
  // Personal — a heart: the classic two-lobe silhouette tapering to a point.
  personal: [
    [1, 0], [3, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
    [1, 3], [2, 3], [3, 3],
    [2, 4],
  ],
};

/** The 5x5 pixel cells for a kind's agenda glyph, in the kind's rail colour. Pure. */
export function almanacKindGlyph(kind: AlmanacKind): readonly AlmanacGlyphCell[] {
  return ALMANAC_KIND_GLYPH[kind];
}

/** Grouping bucket for the planner's agenda dividers. */
export type AlmanacSectionKey = 'today' | 'week' | 'later';

/** A contiguous run of almanac entries under one divider header. */
export interface AlmanacSection {
  key: AlmanacSectionKey;
  /** Divider label, e.g. "TODAY". */
  header: string;
  entries: AlmanacEntry[];
}

/** Inclusive upper bound (in daysUntil) of the "this week" bucket. */
export const ALMANAC_WEEK_MAX_DAYS = 6;

/**
 * Kind-filter for the planner so a player hunting one type of event ("when
 * is the next birthday?") isn't scanning every row. A small, complete
 * cycle that covers every AlmanacKind without a six-state slog:
 *   - all:       everything (the default)
 *   - village:   the village-wide scheduled happenings — festivals, Pip's
 *                cart, and the friendship tournament
 *   - birthdays: NPC birthdays
 *   - personal:  the player's own accepted hangout commitments
 * Mirrors the lore Rumors `f`-filter shape (a fixed cycle + a chip + the
 * shared empty state when a filter matches nothing).
 */
export type AlmanacFilter = 'all' | 'village' | 'birthdays' | 'personal';

/** Filter cycle order — `f` advances through these, wrapping at the end. */
export const ALMANAC_FILTERS: readonly AlmanacFilter[] = ['all', 'village', 'birthdays', 'personal'] as const;

/** Which AlmanacKinds each filter admits. 'all' admits everything. */
const FILTER_KINDS: Record<Exclude<AlmanacFilter, 'all'>, readonly AlmanacKind[]> = {
  village: ['festival', 'cart', 'tournament'],
  birthdays: ['birthday'],
  personal: ['personal'],
};

/** Advance to the next filter in the cycle, wrapping at the end. Pure. */
export function nextAlmanacFilter(filter: AlmanacFilter): AlmanacFilter {
  const i = ALMANAC_FILTERS.indexOf(filter);
  return ALMANAC_FILTERS[(i + 1) % ALMANAC_FILTERS.length];
}

/**
 * The AlmanacKinds a filter admits, in the panel's stable rail order, so the
 * panel can draw small per-kind colour pips beside the filter chip — a
 * preview of WHAT each filter shows before the player cycles to it. 'all'
 * returns every kind; the narrowing filters return just their admitted set.
 * Mirrors applyAlmanacFilter's membership exactly (it's derived from the
 * same FILTER_KINDS map) so the pips never drift from what the filter
 * actually keeps. Pure.
 */
export function almanacFilterKinds(filter: AlmanacFilter): AlmanacKind[] {
  const admitted: readonly AlmanacKind[] =
    filter === 'all'
      ? (Object.keys(KIND_NOUN) as AlmanacKind[])
      : FILTER_KINDS[filter];
  // Project onto the stable summary order so the pips read consistently
  // regardless of how the source arrays happen to be ordered.
  return SUMMARY_KIND_ORDER.filter((k) => admitted.includes(k));
}

/** Short chip label for the active filter, e.g. "birthdays". Pure. */
export function almanacFilterLabel(filter: AlmanacFilter): string {
  switch (filter) {
    case 'all':
      return 'all';
    case 'village':
      return 'village';
    case 'birthdays':
      return 'birthdays';
    case 'personal':
      return 'personal';
  }
}

/**
 * Keep only the entries a filter admits, preserving the input order
 * (already soonest-first). 'all' returns the list untouched. Pure.
 */
export function applyAlmanacFilter(
  entries: readonly AlmanacEntry[],
  filter: AlmanacFilter,
): AlmanacEntry[] {
  if (filter === 'all') return [...entries];
  const kinds = FILTER_KINDS[filter];
  return entries.filter((e) => kinds.includes(e.kind));
}

/** A single "{count} {noun}" segment of the per-kind summary line. */
export interface AlmanacCountPart {
  kind: AlmanacKind;
  count: number;
  /** Pre-pluralised phrase, e.g. "2 birthdays" / "1 festival". */
  text: string;
}

/** Singular noun per kind for the count summary. Pluralised with a trailing s. */
const KIND_NOUN: Record<AlmanacKind, string> = {
  personal: 'hangout',
  festival: 'festival',
  tournament: 'tournament',
  cart: 'cart visit',
  birthday: 'birthday',
};

/**
 * Order the summary parts read in, so the line is stable regardless of how
 * the entries happened to sort. Mirrors the panel's row-rail priority.
 */
const SUMMARY_KIND_ORDER: readonly AlmanacKind[] = [
  'personal',
  'festival',
  'tournament',
  'cart',
  'birthday',
];

/**
 * Tally a (possibly filtered) almanac list into one "{n} {noun}" part per
 * kind that actually appears, in a stable display order. Lets the panel
 * surface "2 birthdays, 1 festival, 1 hangout in view" so the player sees
 * the SHAPE of the fortnight at a glance, not just the soonest row. Kinds
 * with zero entries are omitted. Pure — reads only the passed list, so it
 * honours whatever filter the caller already applied.
 */
export function almanacCountParts(
  entries: readonly AlmanacEntry[],
): AlmanacCountPart[] {
  const counts = new Map<AlmanacKind, number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const parts: AlmanacCountPart[] = [];
  for (const kind of SUMMARY_KIND_ORDER) {
    const count = counts.get(kind) ?? 0;
    if (count <= 0) continue;
    const noun = KIND_NOUN[kind];
    const text = `${count} ${noun}${count === 1 ? '' : 's'}`;
    parts.push({ kind, count, text });
  }
  return parts;
}

/**
 * One-line "2 birthdays, 1 festival, 1 hangout in view" summary, or '' when
 * the list is empty (the header then renders nothing). Joins the parts with
 * commas and tacks on " in view" so it reads as a glanceable shape-of-the-
 * fortnight caption. Pure.
 */
export function almanacCountSummary(entries: readonly AlmanacEntry[]): string {
  const parts = almanacCountParts(entries);
  if (parts.length === 0) return '';
  return `${parts.map((p) => p.text).join(', ')} in view`;
}

/**
 * Split a soonest-first almanac list into TODAY / THIS WEEK / LATER
 * sections so the planner reads as a grouped agenda instead of one long
 * countdown. Buckets by daysUntil:
 *   - today: 0 (lands today)
 *   - week:  1..ALMANAC_WEEK_MAX_DAYS (the rest of the current in-game week)
 *   - later: beyond that, out to the horizon
 * Empty buckets are omitted so a quiet stretch never shows a bare header.
 * Order within a bucket is preserved from the input (already soonest-first).
 * Pure.
 */
export function almanacSections(entries: readonly AlmanacEntry[]): AlmanacSection[] {
  const today: AlmanacEntry[] = [];
  const week: AlmanacEntry[] = [];
  const later: AlmanacEntry[] = [];
  for (const e of entries) {
    if (e.daysUntil <= 0) today.push(e);
    else if (e.daysUntil <= ALMANAC_WEEK_MAX_DAYS) week.push(e);
    else later.push(e);
  }
  const out: AlmanacSection[] = [];
  if (today.length) out.push({ key: 'today', header: 'TODAY', entries: today });
  if (week.length) out.push({ key: 'week', header: 'THIS WEEK', entries: week });
  if (later.length) out.push({ key: 'later', header: 'LATER', entries: later });
  return out;
}

/**
 * The single most-imminent event within `maxDays` of `time`, or null when
 * the next two weeks open with nothing that close. Used by the HUD chip so
 * the player sees the planner's top row ("Tomorrow: Vallie's birthday")
 * without opening the `0` panel. buildAlmanac already returns soonest-first
 * so the first row inside the window is the highlight; ties resolve by the
 * same stable kind order the panel uses.
 */
export function almanacHighlight(
  time: TimeOfDay,
  maxDays: number = 1,
  player?: Player,
): AlmanacEntry | null {
  for (const e of buildAlmanac(time, ALMANAC_HORIZON_DAYS, player)) {
    if (e.daysUntil <= maxDays) return e;
  }
  return null;
}

/**
 * One-line chip text for an almanac highlight: "Today: <title>" or
 * "Tomorrow: <title>". Only meaningful for daysUntil <= 1 (the chip never
 * surfaces anything further out), so the prefix is always Today/Tomorrow.
 */
export function highlightChipText(e: AlmanacEntry): string {
  const when = e.daysUntil <= 0 ? 'Today' : 'Tomorrow';
  return `${when}: ${e.title}`;
}

/**
 * The soonest scheduled event that sits BEYOND the normal 14-day horizon,
 * honouring the active kind-filter, by scanning the rest of the 28-day
 * calendar wrap. Used by the planner when the (possibly filtered) two-week
 * agenda is empty so the `0` panel can still point at what's next ("next:
 * Vallie's birthday in 19 days") instead of a dead calm screen. The
 * unfiltered fortnight is essentially never empty (Pip's cart alone visits
 * every 7 days), so in practice this earns its keep on a FILTERED view —
 * e.g. the player narrows to birthdays and none land this fortnight.
 * Returns null when nothing of the filtered kind is scheduled anywhere in
 * the cycle. buildAlmanac returns soonest-first, so the first matching
 * entry past the horizon is the answer. Pure.
 */
export function almanacLookAhead(
  time: TimeOfDay,
  filter: AlmanacFilter = 'all',
  player?: Player,
): AlmanacEntry | null {
  // 27 is the farthest a daysUntil can be (mod-28 wrap), so this sees the
  // entire calendar without double-counting today.
  const all = buildAlmanac(time, 27, player);
  for (const e of applyAlmanacFilter(all, filter)) {
    if (e.daysUntil > ALMANAC_HORIZON_DAYS) return e;
  }
  return null;
}

/**
 * "next: Vallie's birthday in 19 days" caption for a look-ahead entry, or ''
 * when there's nothing further out. Always reads "in N days" since the
 * look-ahead only surfaces events beyond the 14-day horizon. Pure.
 */
export function almanacLookAheadLine(e: AlmanacEntry | null): string {
  if (!e) return '';
  return `next: ${e.title} in ${e.daysUntil} days`;
}

/**
 * The kind of the soonest event happening TODAY (daysUntil <= 0) from a
 * built-and-filtered agenda, so the planner can paint that kind's glyph as
 * a faint watermark behind the TODAY band — tying "right now" to its
 * cake/tent/cart/rosette/heart icon. Reads the first entry whose daysUntil
 * is non-positive (entries arrive soonest-first), or null when nothing
 * lands today (the band then draws no watermark). Pure.
 */
export function almanacTodayGlyphKind(
  entries: readonly AlmanacEntry[],
): AlmanacKind | null {
  for (const e of entries) {
    if (e.daysUntil <= 0) return e.kind;
  }
  return null;
}

/**
 * How many events land TODAY (daysUntil <= 0) across the built-and-filtered
 * agenda — the count behind the TODAY section. Lets the panel surface a tiny
 * "N today" weight chip on a busy day so the player reads the day's load
 * without counting rows. Pure: scans the same list almanacSections buckets.
 */
export function almanacTodayCount(entries: readonly AlmanacEntry[]): number {
  let n = 0;
  for (const e of entries) {
    if (e.daysUntil <= 0) n += 1;
  }
  return n;
}

/**
 * "N today" chip text when 2+ events stack on the current day, '' otherwise
 * (a single TODAY row already reads its weight plainly, so the chip stays
 * quiet below 2). Pure formatter over the count.
 */
export function almanacTodayChip(count: number): string {
  return count >= 2 ? `${count} today` : '';
}

/**
 * Per-section weight chip for the THIS WEEK / LATER dividers, mirroring the
 * TODAY chip: "N this week" / "N later" once 2+ events stack in a bucket,
 * '' below that (one row reads its own weight). The TODAY bucket keeps its
 * own chip wording, so this only labels the forward buckets. Pure formatter
 * over a section key + its row count.
 */
export function almanacSectionChip(
  key: AlmanacSectionKey,
  count: number,
): string {
  if (count < 2) return '';
  if (key === 'week') return `${count} this week`;
  if (key === 'later') return `${count} later`;
  return '';
}

/**
 * The dominant kind in a section's entries, so the panel can lead the
 * THIS WEEK / LATER weight chip with that kind's glyph — the chip then says
 * WHAT the bucket is mostly made of (a fortnight of birthdays vs a run of
 * festivals), not only how many rows. Counts per kind and returns the
 * busiest; ties break by the stable SUMMARY_KIND_ORDER (personal first) so
 * the icon is deterministic. null on an empty section (no glyph to lead
 * with — the chip stays text-only). Pure: tallies the passed entries.
 */
export function almanacSectionBusiestKind(
  entries: readonly AlmanacEntry[],
): AlmanacKind | null {
  if (entries.length === 0) return null;
  const counts = new Map<AlmanacKind, number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  let best: AlmanacKind | null = null;
  let bestCount = 0;
  // Walk in the stable summary order so a tie resolves to the earlier kind.
  for (const kind of SUMMARY_KIND_ORDER) {
    const c = counts.get(kind) ?? 0;
    if (c > bestCount) {
      best = kind;
      bestCount = c;
    }
  }
  return best;
}

/**
 * The kind of a look-ahead entry, so an EMPTY agenda can echo that event's
 * glyph faint behind the \"next: X in N days\" line the same way a busy TODAY
 * band watermarks its soonest event. null when there's no look-ahead at all
 * (nothing of the filtered kind anywhere in the cycle), so the empty panel
 * draws no watermark. A trivial pass-through, but kept as a named seam so the
 * panel + tests share the \"which glyph to echo\" decision. Pure.
 */
export function almanacLookAheadGlyphKind(
  entry: AlmanacEntry | null,
): AlmanacKind | null {
  return entry ? entry.kind : null;
}

// Re-export for the panel + tests that want to project an arbitrary offset.
export { dateInDays };
