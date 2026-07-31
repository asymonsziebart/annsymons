// Achievements — earned badges for hitting cozy-life milestones.
//
// The catalog is data-driven: each entry declares its name, a teaser
// description, and a `check(player, world, time)` predicate that returns
// true once the milestone is met. The runtime calls `tickAchievements()`
// every day rollover (and once on demand from the achievements panel)
// to grant any newly-completed badges.
//
// Earned achievements live on Player.achievements as an array of
// `{id, earnedDay}`. Order in the panel follows catalog declaration.
//
// Pure module — no IO, no canvas. The wiring + panel sit in their own
// files. Persistence is handled in persistence.ts.

import type { Player, World } from '../world/world';
import type { TimeOfDay } from './time';
import { CANDIDATES, getHearts } from './hearts';
import { GEM_KEYS, gemInventoryKey } from './gems';
import {
  totalDishesCooked,
  recipesCooked,
  breedersBowlMilestoneReached,
  BREEDERS_BOWL_MILESTONE,
} from './cooking-history';
import { RECIPE_KEYS } from './cooking';
import { buildJournal } from './crop-journal';
import { unreadCount } from './mail';
import { getDog } from './farm-dog';
import { getCoops } from './coop';
import { getGreenhouses } from './greenhouse';
import { getChests } from './chest';
import { getSprinklers } from './sprinklers';
import {
  getMineHaul,
  lifetimeMiningMilestoneReached,
  LIFETIME_MINING_MILESTONE,
  deepVeinMilestoneReached,
  DEEP_VEIN_COUNT,
  DEEP_VEIN_GOLD,
  veinConnoisseurMilestoneReached,
  VEIN_CONNOISSEUR_PER_GEM,
} from './mining-haul';
import {
  compostMasterMilestoneReached,
  COMPOST_MASTER_MILESTONE_GOLD,
  compostMasterSashMilestoneReached,
  COMPOST_MASTER_SASH_MILESTONE_GOLD,
  pulperMilestoneReached,
  PULPER_MILESTONE_BAGS,
  rareMasterMilestoneReached,
  RARE_MASTER_MILESTONE_BAGS,
} from './compost';
import {
  owlFluentMilestoneReached,
  OWL_FLUENT_MILESTONE,
} from './owl-post';
import {
  festivalRegularMilestoneReached,
  FESTIVAL_REGULAR_MILESTONE,
  tournamentChampionMilestoneReached,
  TOURNAMENT_CHAMPION_GOLD_RIBBONS,
} from './tournament';

/** Identifier — stable strings so persisted records survive rebalances. */
export type AchievementId =
  | 'first-steps'
  | 'green-thumb'
  | 'master-farmer'
  | 'star-grower'
  | 'pantry-cook'
  | 'recipe-collector'
  | 'wealthy'
  | 'rich'
  | 'tycoon'
  | 'pen-pal'
  | 'best-friend'
  | 'wedding-bells'
  | 'rockhound'
  | 'menagerie'
  | 'farm-decorator'
  | 'cave-veteran'
  | 'compost-master'
  | 'breeders-bowl'
  | 'fluent-with-the-owl'
  | 'pulper'
  | 'deep-vein'
  | 'festival-regular'
  | 'tournament-champion'
  | 'compost-master-sash'
  | 'rare-master'
  | 'vein-connoisseur';

export interface AchievementDef {
  id: AchievementId;
  name: string;
  /** Short teaser shown before the badge is earned. */
  hint: string;
  /** Final description shown once earned. */
  done: string;
  check: (player: Player, world: World, time: TimeOfDay) => boolean;
}

/** Catalog of all achievements in display order. */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    hint: 'Plant your very first seed.',
    done: 'Planted your first seed.',
    check: (p) => Object.values(buildJournal(p)).some((r) => r.sown > 0),
  },
  {
    id: 'green-thumb',
    name: 'Green Thumb',
    hint: 'Harvest 20 crops of any kind.',
    done: 'Brought in 20 crops.',
    check: (p) =>
      buildJournal(p).reduce((s, r) => s + r.normal + r.silver + r.gold, 0) >= 20,
  },
  {
    id: 'master-farmer',
    name: 'Master Farmer',
    hint: 'Harvest 100 crops.',
    done: 'Reaped 100 crops over your career.',
    check: (p) =>
      buildJournal(p).reduce((s, r) => s + r.normal + r.silver + r.gold, 0) >= 100,
  },
  {
    id: 'star-grower',
    name: 'Star Grower',
    hint: 'Bring in your first gold-star crop.',
    done: 'Grew a perfect gold-star crop.',
    check: (p) => buildJournal(p).some((r) => r.gold > 0),
  },
  {
    id: 'pantry-cook',
    name: 'Pantry Cook',
    hint: 'Cook 10 dishes at the inn.',
    done: 'Stirred up 10 dishes.',
    check: (p) => totalDishesCooked(p) >= 10,
  },
  {
    id: 'recipe-collector',
    name: 'Recipe Collector',
    hint: 'Cook at least one of every recipe.',
    done: 'Discovered every recipe in the book.',
    check: (p) => recipesCooked(p) >= RECIPE_KEYS.length,
  },
  {
    id: 'wealthy',
    name: 'Wealthy',
    hint: 'Hold 1,000g at once.',
    done: 'First time holding 1,000g.',
    check: (p) => p.gold >= 1000,
  },
  {
    id: 'rich',
    name: 'Rich',
    hint: 'Hold 5,000g at once.',
    done: 'First time holding 5,000g.',
    check: (p) => p.gold >= 5000,
  },
  {
    id: 'tycoon',
    name: 'Valley Tycoon',
    hint: 'Hold 20,000g at once.',
    done: 'First time holding 20,000g.',
    check: (p) => p.gold >= 20000,
  },
  {
    id: 'pen-pal',
    name: 'Pen Pal',
    hint: 'Receive your first letter from a villager.',
    done: 'Got your first villager letter.',
    check: (p) => {
      const mail = (p as Player & { mail?: { inbox: unknown[] } }).mail;
      // Any letter in the box (unread or read) qualifies.
      const inbox = mail?.inbox ?? [];
      // Also count unread, in case the player hasn't opened the letter yet.
      return inbox.length > 0 || unreadCount(p) > 0;
    },
  },
  {
    id: 'best-friend',
    name: 'Best Friend',
    hint: 'Reach 6 hearts with any villager.',
    done: 'Reached 6 hearts with a villager.',
    check: (p) => {
      if (!p.hearts) return false;
      for (const id of Object.keys(CANDIDATES)) {
        if (getHearts(p.hearts, id) >= 6) return true;
      }
      return false;
    },
  },
  {
    id: 'wedding-bells',
    name: 'Wedding Bells',
    hint: 'Hold a wedding at the village well.',
    done: 'Married someone special.',
    check: (p) => Boolean((p as Player).marriage),
  },
  {
    id: 'rockhound',
    name: 'Rockhound',
    hint: 'Mine at least one of every gem.',
    done: 'Mined every gem tier.',
    check: (p) => GEM_KEYS.every((g) => (p.inventory[gemInventoryKey(g)] ?? 0) > 0),
  },
  {
    id: 'menagerie',
    name: 'Menagerie',
    hint: 'Own a dog and at least one chicken coop.',
    done: 'Built a farm zoo.',
    check: (p, w) => getDog(w).owned && getCoops(w).length > 0,
  },
  {
    id: 'farm-decorator',
    name: 'Farm Decorator',
    hint: 'Place a greenhouse, an extra chest, and a sprinkler.',
    done: 'Decked out the farm.',
    check: (_p, w) =>
      getGreenhouses(w).length > 0 &&
      getChests(w).length >= 2 &&
      getSprinklers(w).length > 0,
  },
  {
    id: 'cave-veteran',
    name: 'Cave Veteran',
    hint: `Mine ${LIFETIME_MINING_MILESTONE} gems over your career.`,
    done: `Pulled ${LIFETIME_MINING_MILESTONE}+ gems out of the cave.`,
    check: (p) => lifetimeMiningMilestoneReached(getMineHaul(p)),
  },
  {
    id: 'compost-master',
    name: 'Compost Master',
    hint: `Recycle ${COMPOST_MASTER_MILESTONE_GOLD}g back from fertilizer bags.`,
    done: `Pulped ${COMPOST_MASTER_MILESTONE_GOLD}+ gold from fertilizer bags.`,
    check: (p) => compostMasterMilestoneReached(p),
  },
  {
    id: 'breeders-bowl',
    name: "Breeder's Bowl",
    hint: `Cook ${BREEDERS_BOWL_MILESTONE} premium (breeder-egg) dishes.`,
    done: `Plated ${BREEDERS_BOWL_MILESTONE}+ premium dishes from breeder eggs.`,
    check: (p) => breedersBowlMilestoneReached(p),
  },
  {
    id: 'fluent-with-the-owl',
    name: 'Fluent with the Owl',
    hint: `Dispatch ${OWL_FLUENT_MILESTONE} owl-post gifts across the village.`,
    done: `Sent ${OWL_FLUENT_MILESTONE}+ owl-post gifts — the owl knows your handwriting now.`,
    check: (p) => owlFluentMilestoneReached(p),
  },
  {
    id: 'pulper',
    name: 'Pulper',
    hint: `Apply ${PULPER_MILESTONE_BAGS} fertilizer bags to your fields.`,
    done: `Pulped ${PULPER_MILESTONE_BAGS}+ fertilizer bags into the soil.`,
    check: (p) => pulperMilestoneReached(p),
  },
  {
    id: 'deep-vein',
    name: 'Deep Vein',
    hint: `Pull ${DEEP_VEIN_COUNT} gems or ${DEEP_VEIN_GOLD}g of ore out of the cave in a single run.`,
    done: `Brought home a single-run haul of ${DEEP_VEIN_COUNT}+ gems or ${DEEP_VEIN_GOLD}+g of ore.`,
    check: (p) => deepVeinMilestoneReached(getMineHaul(p)),
  },
  {
    id: 'festival-regular',
    name: 'Festival Regular',
    hint: `Enter every seasonal village tournament at least once (${FESTIVAL_REGULAR_MILESTONE} total).`,
    done: `Showed up to every seasonal tournament — flower show, fishing derby, harvest weigh-in, and cook-off.`,
    check: (p) => festivalRegularMilestoneReached(p),
  },
  {
    id: 'tournament-champion',
    name: 'Tournament Champion',
    hint: `Win the gold ribbon at ${TOURNAMENT_CHAMPION_GOLD_RIBBONS} different seasonal tournaments.`,
    done: `Cleared the gold ribbon at ${TOURNAMENT_CHAMPION_GOLD_RIBBONS}+ seasonal tournaments — three quarters of the calendar at the top tier.`,
    check: (p) => tournamentChampionMilestoneReached(p),
  },
  {
    id: 'compost-master-sash',
    name: 'Compost Master Sash',
    hint: `Recycle ${COMPOST_MASTER_SASH_MILESTONE_GOLD}g back from fertilizer bags — past the Compost Master rank.`,
    done: `Pulped ${COMPOST_MASTER_SASH_MILESTONE_GOLD}+ gold back from bags — wear the sash with pride.`,
    check: (p) => compostMasterSashMilestoneReached(p),
  },
  {
    id: 'rare-master',
    name: 'Rare Master',
    hint: `Apply ${RARE_MASTER_MILESTONE_BAGS} RARE fertilizer bags — only mintable on each season's rare-day.`,
    done: `Applied ${RARE_MASTER_MILESTONE_BAGS}+ rare fertilizer bags — you've mastered the rare-day compost timing.`,
    check: (p) => rareMasterMilestoneReached(p),
  },
  {
    id: 'vein-connoisseur',
    name: 'Vein Connoisseur',
    hint: `Mine ${VEIN_CONNOISSEUR_PER_GEM} of every gem type across your career.`,
    done: `Pulled ${VEIN_CONNOISSEUR_PER_GEM}+ of every gem out of the cave — copper, iron, silver, gold, and ruby.`,
    check: (p) => veinConnoisseurMilestoneReached(getMineHaul(p)),
  },
];

/** One earned-badge record stored on the player. */
export interface EarnedAchievement {
  id: AchievementId;
  earnedDay: number;
}

/** Lazy accessor — creates the array on first use. */
export function getEarned(player: Player): EarnedAchievement[] {
  const p = player as Player & { achievements?: EarnedAchievement[] };
  if (!p.achievements) p.achievements = [];
  return p.achievements;
}

/** True iff the player has earned this achievement. */
export function isEarned(player: Player, id: AchievementId): boolean {
  return getEarned(player).some((e) => e.id === id);
}

/** Returns the array of newly-earned ids (often empty). */
export function tickAchievements(
  player: Player,
  world: World,
  time: TimeOfDay,
): AchievementId[] {
  const earned = getEarned(player);
  const newly: AchievementId[] = [];
  for (const a of ACHIEVEMENTS) {
    if (earned.some((e) => e.id === a.id)) continue;
    if (a.check(player, world, time)) {
      earned.push({ id: a.id, earnedDay: time.day });
      newly.push(a.id);
    }
  }
  return newly;
}

/** Pure summary row for the panel. */
export interface AchievementRow {
  id: AchievementId;
  name: string;
  description: string;
  earned: boolean;
  earnedDay: number | null;
}

/** Snapshot every achievement with current earn state. */
export function buildAchievements(player: Player): AchievementRow[] {
  const earned = getEarned(player);
  return ACHIEVEMENTS.map((a) => {
    const e = earned.find((x) => x.id === a.id);
    return {
      id: a.id,
      name: a.name,
      description: e ? a.done : a.hint,
      earned: Boolean(e),
      earnedDay: e ? e.earnedDay : null,
    };
  });
}

/** Tiny progress helper: how many achievements are done. */
export function earnedCount(player: Player): number {
  return getEarned(player).length;
}

/**
 * Glance-level "what's next" digest for the achievements panel header —
 * the summary cousin of the quest-log %-complete + relationship summary.
 * Names the next locked badge (in catalog/display order, the natural
 * "up next" the panel scrolls toward) plus the earned/remaining tally so
 * the player has a goal without scanning the whole list. `nextName` is
 * null once every badge is earned. Pure: reads the built rows.
 */
export interface AchievementsNextUp {
  earned: number;
  total: number;
  remaining: number;
  /** Name of the next locked badge, or null when all are earned. */
  nextName: string | null;
}

export function achievementsNextUp(
  rows: readonly AchievementRow[],
): AchievementsNextUp {
  const earned = rows.filter((r) => r.earned).length;
  const next = rows.find((r) => !r.earned) ?? null;
  return {
    earned,
    total: rows.length,
    remaining: rows.length - earned,
    nextName: next ? next.name : null,
  };
}

/**
 * Render the next-up digest as one caption line:
 *   "7 earned, 19 to go - next: Star Grower"
 * Drops the "next:" clause once everything is earned ("26 earned - all
 * done!"). '' when the catalog is somehow empty. Pure.
 */
export function achievementsNextUpLine(n: AchievementsNextUp): string {
  if (n.total === 0) return '';
  if (n.nextName === null) return `${n.earned} earned - all done!`;
  return `${n.earned} earned, ${n.remaining} to go - next: ${n.nextName}`;
}

/** Earn-state bucket for the panel's section dividers. */
export type AchievementSectionKey = 'earned' | 'locked';

/** A contiguous run of achievement rows under one divider header. */
export interface AchievementSection {
  key: AchievementSectionKey;
  /** Divider label, e.g. "EARNED". */
  header: string;
  rows: AchievementRow[];
}

/** Header text per earn-state, in display order. */
const ACHIEVEMENT_SECTION_HEADER: Record<AchievementSectionKey, string> = {
  earned: 'EARNED',
  locked: 'LOCKED',
};

/**
 * Group achievement rows into EARNED / LOCKED sections so the badge list
 * reads as "what I've unlocked / what's still ahead" instead of one flat
 * scroll where the only signal is a pip colour. Earned first (celebrate
 * the wins), locked last. Each section keeps the input's catalog order;
 * empty sections are omitted so a fresh save doesn't show a bare EARNED
 * header and a fully-completed save doesn't show a bare LOCKED one. Pure
 * — mirrors codexSections / almanacSections.
 */
export function achievementSections(
  rows: readonly AchievementRow[],
): AchievementSection[] {
  const order: AchievementSectionKey[] = ['earned', 'locked'];
  const out: AchievementSection[] = [];
  for (const key of order) {
    const group = rows.filter((r) => (key === 'earned' ? r.earned : !r.earned));
    if (group.length > 0) {
      out.push({ key, header: ACHIEVEMENT_SECTION_HEADER[key], rows: group });
    }
  }
  return out;
}

/**
 * Panel-local achievements filter so a player deep into the catalog can
 * isolate just the badges they've earned (to admire) or just what's still
 * locked (to chase) without scanning past the other group. Cycles
 * all -> earned -> locked, each keeping one earn-state ('all' keeps
 * everything). The achievements panel is a non-blocking read-while-walking
 * overlay with no a/d nav, so a panel-local `f` cycle is the right shape
 * (mirrors the recipe-codex / quest-log filters); the global fishing `f`
 * is guarded against the open panel. The EARNED / LOCKED section dividers
 * still group within whatever the filter shows.
 */
export type AchievementFilter = 'all' | 'earned' | 'locked';

/** Cycle order for the `f` keypress. */
export const ACHIEVEMENT_FILTERS: readonly AchievementFilter[] = [
  'all',
  'earned',
  'locked',
] as const;

/** Advance to the next filter, wrapping at the end. Pure. */
export function cycleAchievementFilter(f: AchievementFilter): AchievementFilter {
  const i = ACHIEVEMENT_FILTERS.indexOf(f);
  return ACHIEVEMENT_FILTERS[(i + 1) % ACHIEVEMENT_FILTERS.length];
}

/** Short chip label for the active filter. Pure. */
export function achievementFilterLabel(f: AchievementFilter): string {
  return f; // 'all' / 'earned' / 'locked' read fine as-is.
}

/**
 * Keep only the achievement rows matching the active filter, by earn
 * state. 'all' returns the input untouched (a fresh array for caller
 * safety), preserving catalog order in every case. Pure.
 */
export function applyAchievementFilter(
  rows: readonly AchievementRow[],
  filter: AchievementFilter,
): AchievementRow[] {
  if (filter === 'all') return rows.slice();
  const wantEarned = filter === 'earned';
  return rows.filter((r) => r.earned === wantEarned);
}
