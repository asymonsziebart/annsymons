// Lore / bestiary panel — backtick (`) toggles the village discovery
// log. Each row is one entry in one of FOUR categories:
//
//   fish    — caught at least one of in the rod's `lastCatch` history
//             (we use the inventory `fish-<key>` count as the gate)
//   gems    — mined at least one (inventory `gem-<key>` count > 0)
//   forage  — picked at least one (inventory `forage-<key>` > 0)
//   crops   — sown at least once according to the journal
//   folk    — every NPC the player has chatted to (hearts row exists)
//
// Auto-discovery: rows light up whenever the underlying tally goes
// non-zero. There's no separate "save" of unlock state — we derive
// every panel render from the live counts so the bestiary always
// reflects current truth, and older saves with no codex history still
// surface their inventory naturally.
//
// Pure module — no IO, no canvas. The panel UI lives in ui/lore-panel.ts.

import type { Player } from '../world/world';
import { FISH, FISH_KEYS, type FishKey } from './fish';
import { GEMS, GEM_KEYS, gemInventoryKey, gemRarity, type GemKey } from './gems';
import { FORAGE, FORAGE_KEYS, forageInventoryKey } from './forage';
import { CROPS } from './crops';
import { CANDIDATES, getHearts } from './hearts';
import { buildJournal } from './crop-journal';
import { getRumorHistory, type RumorHistoryEntry } from './cart-rumor';
import { getMineHaul, haulBestRunLine, bestRunCompositionLine, bestRunSplitCompositionLine, lifetimeHaulCount, lifetimeHaulGold } from './mining-haul';
import { activeChainLength, owlFluencyTierColor, owlStampLine, owlStampsFor } from './owl-post';

/** Category labels — listed in panel display order. */
export const LORE_CATEGORIES = ['Fish', 'Gems', 'Forage', 'Crops', 'Folk', 'Rumors'] as const;
export type LoreCategory = (typeof LORE_CATEGORIES)[number];

/** One row in the lore panel. */
export interface LoreRow {
  category: LoreCategory;
  id: string;
  name: string;
  /** True iff the player has discovered this entry. */
  discovered: boolean;
  /** One-liner shown beneath the name (shown when discovered). */
  description: string;
  /** Short locked teaser shown until discovery. */
  teaser: string;
  /** Optional count for inventory-backed entries. */
  count?: number;
  /**
   * Optional tier-color hex for the row's progression badge — currently
   * set on Folk rows for the per-NPC owl-fluency tier (bronze /
   * silver / gold). Null when the row has no tier achieved (a casual
   * Folk friend the player has never owl-mailed). The panel draws a
   * small colored chip alongside the row text when this is set.
   */
  tierColor?: string | null;
}

/** Per-category teaser to fill in locked rows. */
function teaserFor(category: LoreCategory): string {
  switch (category) {
    case 'Fish':   return 'Cast a line into the pond.';
    case 'Gems':   return 'Mine the stone outcrop.';
    case 'Forage': return 'Wander the grass at dawn.';
    case 'Crops':  return 'Plant a seed and tend it.';
    case 'Folk':   return 'Greet someone in the village.';
    case 'Rumors': return 'Wait for Pip to roll into the village square.';
  }
}

/** Season-index → human label for the rumors tab. */
const RUMOR_SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/** True iff the player has caught at least one of `key`. */
function fishDiscovered(player: Player, key: FishKey): boolean {
  return (player.inventory[`fish-${key}`] ?? 0) > 0;
}

/** True iff the player has mined at least one of `key`. */
function gemDiscovered(player: Player, key: GemKey): boolean {
  return (player.inventory[gemInventoryKey(key)] ?? 0) > 0;
}

/** True iff the player has picked at least one of `key`. */
function forageDiscovered(player: Player, key: keyof typeof FORAGE): boolean {
  return (player.inventory[forageInventoryKey(key)] ?? 0) > 0;
}

/** Build the full lore catalogue, calling the discovery predicates. */
export function buildLoreRows(player: Player): LoreRow[] {
  const out: LoreRow[] = [];
  // Fish.
  for (const key of FISH_KEYS) {
    const def = FISH[key];
    const count = player.inventory[`fish-${key}`] ?? 0;
    out.push({
      category: 'Fish',
      id: key,
      name: def.name,
      discovered: fishDiscovered(player, key),
      description: `Sells for ${def.sellPrice}g. Catalogue weight ${def.weight}.`,
      teaser: teaserFor('Fish'),
      count,
    });
  }
  // Gems.
  for (const key of GEM_KEYS) {
    const def = GEMS[key];
    const count = player.inventory[gemInventoryKey(key)] ?? 0;
    out.push({
      category: 'Gems',
      id: key,
      name: def.name,
      discovered: gemDiscovered(player, key),
      description: `${gemRarity(key)} - sells for ${def.sellPrice}g.`,
      teaser: teaserFor('Gems'),
      count,
    });
  }
  // Forage.
  for (const key of FORAGE_KEYS) {
    const def = FORAGE[key];
    const count = player.inventory[forageInventoryKey(key)] ?? 0;
    out.push({
      category: 'Forage',
      id: key,
      name: def.name,
      discovered: forageDiscovered(player, key),
      description: `Sells for ${def.sellPrice}g. Wild grass spawn.`,
      teaser: teaserFor('Forage'),
      count,
    });
  }
  // Crops — derive discovery from the journal sown count.
  const journal = buildJournal(player);
  for (const r of journal) {
    const def = CROPS[r.key];
    if (!def) continue;
    out.push({
      category: 'Crops',
      id: r.key,
      name: def.name,
      discovered: r.sown > 0,
      description: `Grown ${r.normal + r.silver + r.gold} times; best streak ${r.bestStreak}.`,
      teaser: teaserFor('Crops'),
      count: r.normal + r.silver + r.gold,
    });
  }
  // Folk — every candidate the player has even one chat point with.
  if (player.hearts) {
    for (const id of Object.keys(CANDIDATES)) {
      const def = CANDIDATES[id];
      const hearts = getHearts(player.hearts, id);
      const row = player.hearts[id];
      const seen = (row?.points ?? 0) > 0 || (row?.lastTalkDay ?? -1) >= 0;
      const lovesPretty = def.loved
        .slice(0, 2)
        .map((k) => k.replace('_harvest', '').replace('fish-', ''))
        .join(', ');
      // Lifetime owl-post stamps — appended to the description when
      // the player has dispatched at least one owl to this NPC. Pure
      // tail; absent when count=0 so close-in-person friends don't
      // get a "Owl posts: 0." noise tag. The tail also carries a
      // per-NPC fluency tier label once the player crosses 5 owl
      // posts to this recipient (occasional / regular / favorite).
      const owlCount = owlStampsFor(player, id);
      const owlTail = owlCount > 0 ? ` ${owlStampLine(player, id)}` : '';
      // Active letter-chain indicator — surfaces ONLY when the player
      // is currently riding a consecutive-day owl-post chain with
      // THIS NPC and the chain has at least 2 links (a single-day
      // chain is the floor — no signal worth surfacing). Reads off
      // the same OwlStampBook.chain field that drove the dispatch
      // bonus, so a player who broke the streak by switching
      // recipients sees the new chain on the new NPC and the old
      // tail disappears the same dawn the chain breaks.
      const chainLen = activeChainLength(player, id);
      const chainTail = chainLen >= 2 ? ` Chain: ${chainLen} days.` : '';
      // Per-NPC owl fluency tier color — bronze / silver / gold chip
      // drawn alongside the row text by the panel UI when the player
      // has crossed at least one fluency tier with this NPC. Null
      // when the player is below the first tier so casual friends
      // don't get a misleading chip color.
      const tierColor = owlFluencyTierColor(player, id);
      out.push({
        category: 'Folk',
        id,
        name: def.name,
        discovered: seen,
        description: `Hearts ${hearts}/10. Loves ${lovesPretty}.${owlTail}${chainTail}`,
        teaser: teaserFor('Folk'),
        count: hearts,
        tierColor,
      });
    }
  }
  // Rumors — every entry in the rumor history ring buffer.
  // Newest at top so a glance reads "what just happened" first.
  // We treat each entry as "discovered" because Pip has explicitly
  // teased it — even a skipped headliner is something the player
  // saw. The bought/skipped state lands in the description so the
  // panel doubles as a ledger of "what did I follow through on".
  const rumorEntries = getRumorHistory(player).entries;
  for (let i = rumorEntries.length - 1; i >= 0; i--) {
    const entry: RumorHistoryEntry = rumorEntries[i];
    const seasonName = RUMOR_SEASON_NAMES[Math.abs(entry.season) % 4] ?? 'Spring';
    const stamp = entry.bought ? 'bought' : 'skipped';
    out.push({
      category: 'Rumors',
      id: `${entry.season}-${entry.itemKey}-${i}`,
      name: `${seasonName} - ${entry.label}`,
      discovered: true,
      description: `${entry.buyPrice}g headliner Pip teased - ${stamp}.`,
      teaser: teaserFor('Rumors'),
      count: entry.bought ? 1 : 0,
    });
  }
  return out;
}

/** Count of discovered rows per category. */
export interface LoreProgress {
  category: LoreCategory;
  discovered: number;
  total: number;
}

export function loreProgress(player: Player): LoreProgress[] {
  const rows = buildLoreRows(player);
  const buckets: Record<LoreCategory, LoreProgress> = {
    Fish: { category: 'Fish', discovered: 0, total: 0 },
    Gems: { category: 'Gems', discovered: 0, total: 0 },
    Forage: { category: 'Forage', discovered: 0, total: 0 },
    Crops: { category: 'Crops', discovered: 0, total: 0 },
    Folk: { category: 'Folk', discovered: 0, total: 0 },
    Rumors: { category: 'Rumors', discovered: 0, total: 0 },
  };
  for (const r of rows) {
    buckets[r.category].total += 1;
    if (r.discovered) buckets[r.category].discovered += 1;
  }
  return LORE_CATEGORIES.map((c) => buckets[c]);
}

/** Overall percentage of discoveries (0..1).
 *
 * The Rumors tab is excluded from the completion math because rumor
 * entries are a visit LOG, not a discovery catalogue — a player who
 * has never opened a rumor still has a perfectly complete bestiary
 * in spirit, and we don't want a skipped headliner to drag the
 * "discovered" percentage around as Pip rolls through. The tab still
 * surfaces its own per-tab progress count.
 */
export function loreCompletion(player: Player): number {
  const rows = buildLoreRows(player).filter((r) => r.category !== 'Rumors');
  if (rows.length === 0) return 0;
  const discovered = rows.filter((r) => r.discovered).length;
  return discovered / rows.length;
}

/**
 * A glance-level digest of the whole bestiary for the lore panel's header,
 * the same "surface the panel's shape" move the almanac count-summary and
 * quest-log %-complete headers make. Aggregates the per-tab progress into
 * overall discovered / total counts plus how many tabs are fully complete,
 * so a player opening the panel sees the big picture without tabbing
 * through every category. Pure — derives from loreProgress.
 *
 * The Rumors tab is EXCLUDED (mirroring loreCompletion): rumor entries are
 * a visit LOG, not a discovery catalogue, so a skipped headliner shouldn't
 * drag the completion digest around.
 */
export interface LoreCompletionSummary {
  discovered: number;
  total: number;
  /** Whole-percent discovered (0..100), 0 when there's nothing to discover. */
  pct: number;
  /** Catalogue tabs (Rumors excluded) that are fully discovered. */
  tabsComplete: number;
  /** Total catalogue tabs (Rumors excluded). */
  tabsTotal: number;
}

export function loreCompletionSummary(player: Player): LoreCompletionSummary {
  const tabs = loreProgress(player).filter((p) => p.category !== 'Rumors');
  let discovered = 0;
  let total = 0;
  let tabsComplete = 0;
  for (const t of tabs) {
    discovered += t.discovered;
    total += t.total;
    // A tab with rows all discovered is complete; an empty tab can't be.
    if (t.total > 0 && t.discovered === t.total) tabsComplete += 1;
  }
  const pct = total === 0 ? 0 : Math.floor((discovered / total) * 100);
  return { discovered, total, pct, tabsComplete, tabsTotal: tabs.length };
}

/**
 * One-line "discovered 18/40 (45%) - 2 tabs complete" caption for the lore
 * panel header, or '' when there's nothing to discover (the panel then
 * draws no caption). The "N tabs complete" tail only appears once at least
 * one tab is finished, so a fresh save reads as just the count + percent.
 * Pure.
 */
export function loreCompletionSummaryLine(s: LoreCompletionSummary): string {
  if (s.total === 0) return '';
  const base = `discovered ${s.discovered}/${s.total} (${s.pct}%)`;
  if (s.tabsComplete <= 0) return base;
  const noun = s.tabsComplete === 1 ? 'tab' : 'tabs';
  return `${base}  -  ${s.tabsComplete} ${noun} complete`;
}

/**
 * Per-tab footer line — currently surfaces the lifetime mining career
 * recap inside the Gems tab. Returns the empty string for tabs that
 * have nothing extra to say so the panel can render nothing without
 * a guard.
 *
 * Wording (Gems):
 *   "career: 142 gems / 3,820g  -  best run: 14 gems / 510g (day 23)"
 *   "career: 142 gems / 3,820g"                        (no run on record)
 *   "career: 0 gems"                                   (lifetime ledger empty)
 *
 * The best-run ribbon tail surfaces only when the player has actually
 * captured a run (bestRun.count > 0 or bestRun.gold > 0) so a save
 * that has lifetime gems from inventory-bumps but never slept after
 * mining doesn't get a misleading "best run: 0 gems" footer.
 *
 * Pulled out as a pure formatter so the lore-panel UI doesn't grow a
 * mining-haul import just to draw a footer.
 */
export function loreTabFooter(player: Player, category: LoreCategory): string {
  if (category !== 'Gems') return '';
  const state = getMineHaul(player);
  const count = lifetimeHaulCount(state);
  const gold = lifetimeHaulGold(state);
  const careerLine = count === 0
    ? 'career: 0 gems'
    : `career: ${count} gem${count === 1 ? '' : 's'} / ${gold.toLocaleString('en-US')}g`;
  const ribbon = haulBestRunLine(state);
  if (ribbon === '') return careerLine;
  return `${careerLine}  -  ${ribbon}`;
}

/**
 * Optional secondary detail line for a lore tab — currently the Gems
 * tab surfaces a per-gem breakdown of the bestRun composition under
 * the career + ribbon header. Returns the empty string when there's
 * nothing extra to surface so the panel can skip the draw without a
 * guard.
 *
 * Wording (Gems):
 *   single-record save:   "made of: 4 copper, 3 ruby, 2 emerald"
 *   split-record save:    "count run: 8 copper, 4 iron - gold run: 1 ruby, 1 emerald"
 *   no record yet:        ""
 *   older save (no comp): ""
 *
 * Composition is captured at sleep time inside resetMineHaul on the
 * dawn a record falls; older saves predating the composition fields
 * keep the bare aggregate (lore-tab footer) and silently skip this
 * secondary line.
 */
export function loreTabDetailLine(player: Player, category: LoreCategory): string {
  if (category !== 'Gems') return '';
  const state = getMineHaul(player);
  // Split-record path takes priority — when the count + gold leaders
  // were set on different days, the breakdown is more interesting
  // (two distinct runs, different gem mixes). Falls back to the
  // single-composition line when both axes share a day.
  const split = bestRunSplitCompositionLine(state);
  if (split !== '') return split;
  return bestRunCompositionLine(state);
}

// ---------------------------------------------------------------------
// Rumor history filter — three-way cycle on the Rumors tab. Sits on the
// lore panel controller (per-instance, not persisted) so reopening the
// panel resets to "all". Pure helper here so the panel UI can stay
// thin and the test suite can pin the filter behavior independently.
// ---------------------------------------------------------------------

/** Filter modes for the Rumors lore tab. */
export const RUMOR_FILTERS = ['all', 'bought', 'skipped'] as const;
export type RumorFilter = (typeof RUMOR_FILTERS)[number];

/** Cycle filter: all -> bought -> skipped -> all -> ... */
export function nextRumorFilter(filter: RumorFilter): RumorFilter {
  const idx = RUMOR_FILTERS.indexOf(filter);
  return RUMOR_FILTERS[(idx + 1) % RUMOR_FILTERS.length];
}

/**
 * Apply the rumor filter to a list of lore rows. Non-rumor rows pass
 * through unchanged; rumor rows are filtered by the entry's bought
 * stamp (the lore-row description encodes "bought" / "skipped").
 *
 * Pulled out as a pure helper so the panel UI can call it after
 * buildLoreRows() without having to re-derive the bought state from
 * the description string.
 */
export function applyRumorFilter(
  rows: LoreRow[],
  filter: RumorFilter,
): LoreRow[] {
  if (filter === 'all') return rows;
  return rows.filter((r) => {
    if (r.category !== 'Rumors') return true;
    // rumor entries set count=1 when bought, 0 when skipped (see
    // buildLoreRows above). This keeps the filter math single-sourced
    // through the same field the panel already renders.
    const bought = (r.count ?? 0) > 0;
    return filter === 'bought' ? bought : !bought;
  });
}

/**
 * Pretty label for the current filter — used in the panel chrome
 * ("filter: bought") and the close-hint footer.
 */
export function rumorFilterLabel(filter: RumorFilter): string {
  switch (filter) {
    case 'all':     return 'all';
    case 'bought':  return 'bought only';
    case 'skipped': return 'skipped only';
  }
}
