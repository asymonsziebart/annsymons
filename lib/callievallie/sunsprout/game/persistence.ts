// Persistence — JSON snapshot of the player's game state to localStorage.
//
// Sunsprout has always been "play, refresh, lose everything" — the README's
// v0.1.0 feature list literally calls out "save system — not yet". This
// module fills that gap with a tiny, browser-only snapshot/load pair:
//
//   serializeGame()  → SaveSnapshot   (pure; safe to call any frame)
//   applySnapshot()  → mutates Game   (pure; safe to call once on boot)
//   saveToStorage()  → writes JSON to localStorage
//   loadFromStorage() → reads + parses; null on miss or schema mismatch
//
// Schema is versioned. If we ever ship a breaking change to Player /
// World / hearts / engagement / marriage, bump SAVE_VERSION and the old
// blob is ignored on load (we prefer a fresh save over a wrong-shape
// crash). A `clearSave()` helper is exposed for the future settings panel.
//
// Intentionally narrow scope: we only snapshot the player + clock + world
// crops/tiles. NPCs, buildings, dialogue state, and multiplayer are
// regenerated from constructors on every boot, so re-storing them would
// just be noise — the player's farm is what they actually want preserved.

import type { Player, Tile, Crop as RenderCrop } from '../world/world';
import type { Game } from '../engine/game';
import type { HeartsState } from './hearts';
import type { Engagement } from './engagement';
import type { Marriage } from './marriage';
import type { Quest } from './quests';
import { getSprinklers, type PlacedSprinkler } from './sprinklers';
import { getScarecrows, type PlacedScarecrow } from './scarecrow';
import { getForage, type PlacedForage } from './forage';
import { getCoops, type PlacedCoop } from './coop';
import { defaultDogState, getDog, type FarmDogState } from './farm-dog';
import { defaultCatState, getCat, type FarmCatState } from './farm-cat';
import { getGreenhouses, type PlacedGreenhouse } from './greenhouse';
import { getMailbox, type Mailbox } from './mail';
import { getChests, type PlacedChest } from './chest';
import { defaultStaminaState, getStamina, type StaminaState } from './stamina';
import { getRestock, type AutoRestockState } from './auto-restock';
import { getDecor, type DecorState } from './decor';
import { getSpouseState, type SpouseState } from './spouse';
import { getBoard, type BoardState } from './board';
import { getExtractor, type ExtractorState } from './seed-extractor';
import { getTournament, type TournamentState } from './tournament';
import { getStorm, type StormState } from './storm';
import { getBath, getSpaPass, type BathState, type SpaPassState } from './bath-house';
import { getMineHaul, type MineHaulState } from './mining-haul';
import { getRumorHistory, type RumorHistoryState } from './cart-rumor';
import { getPond, type PondState } from './fish-pond';
import { getHatcheries, type PlacedHatchery } from './hatchery';
import { getComposts, getCompostLedger, type PlacedCompost, type CompostLedgerState } from './compost';
import { getShelters, type PlacedShelter } from './storm-shelter';
import { getOwlStamps, type OwlStampBook } from './owl-post';

/** Localstorage key. Versioned so a manual `localStorage.clear()` is reversible-ish. */
export const SAVE_KEY = 'callievallie.save.v1';

/** Bump whenever the SaveSnapshot shape changes incompatibly. */
export const SAVE_VERSION = 1;

/** Minimal per-tile snapshot — type + variant only. */
export interface TileSnapshot {
  type: Tile['type'];
  variant?: number;
}

/** Minimal per-crop snapshot — captures everything the renderer + farming need. */
export interface CropSnapshot {
  tx: number;
  ty: number;
  crop: string;
  kind: RenderCrop['kind'];
  stage: number;
  watered: boolean;
  daysSinceWater: number;
  growth: number;
  /** Consecutive watered-days streak — decides the harvest's star tier. */
  waterStreak?: number;
}

/** Full save payload. */
export interface SaveSnapshot {
  version: number;
  /** Player snapshot — position, facing, inventory, gold, quests, romance. */
  player: {
    x: number;
    y: number;
    facing: Player['facing'];
    inventory: Record<string, number>;
    gold: number;
    quests: Quest[];
    hearts?: HeartsState;
    engagement?: Engagement;
    marriage?: Marriage;
    /** Per-tool tier (hoe/watering-can). Default 'wood' on a fresh save. */
    tools?: Record<string, string>;
    /** Mailbox: inbox queue + per-NPC delivered-tier bookkeeping. */
    mail?: Mailbox;
    /** Per-recipe cooked count for the codex panel. */
    cookCounts?: Record<string, number>;
    /** Per-recipe PREMIUM cooked count — parallel to cookCounts. */
    premiumCookCounts?: Record<string, number>;
    /** Per-crop lifetime tally for the journal panel. */
    cropJournal?: Record<string, { sown: number; normal: number; silver: number; gold: number; bestStreak: number; bestDayHarvest?: number; ribbonSeason?: number; ribbonDay?: number }>;
    /** Earned achievements. */
    achievements?: Array<{ id: string; earnedDay: number }>;
    /** Money log entries — most-recent first, capped at MAX_ENTRIES. */
    moneyLog?: Array<{ delta: number; reason: string; day: number }>;
    /** User settings: autoSave, nightTintScale, hudScale, reduceMotion. */
    settings?: { autoSave: boolean; nightTintScale: number; hudScale: number; reduceMotion: boolean };
    /** Pickaxe tier — wood / copper / iron / gold / diamond. */
    pickaxeTier?: string;
    /** Fishing rod tier — wood / copper / iron / gold. */
    rodTier?: string;
    /** Daily stamina pool — current + max + last-refilled day. */
    stamina?: StaminaState;
    /** Auto-restock kit memo — last seed planted (for the dawn top-up). */
    restock?: AutoRestockState;
    /** Farmhouse decor — owned pieces + active slot selections. */
    decor?: DecorState;
    /** Spouse memo — when the morning gift was last delivered. */
    spouse?: SpouseState;
    /** Village quest board — active quest + completed count + recent. */
    board?: BoardState;
    /** Seed extractor — usage counter drives alternating yields. */
    extractor?: ExtractorState;
    /** Friendship tournament — per (season,kind) entry record. */
    tournament?: TournamentState;
    /** Seasonal storm — per (year,season) hit record + last memo. */
    storm?: StormState;
    /** Bath house — buff expiry day (-1 = no buff). */
    bath?: BathState;
    /** Spa pass — punches remaining on the player's redeemed punch card. */
    spaPass?: SpaPassState;
    /** Mining haul — running tally + previous run's tally. */
    mineHaul?: MineHaulState;
    /** Rumor history — last RUMOR_HISTORY_CAP headliners + bought flags. */
    rumorHistory?: RumorHistoryState;
    /** Compost ledger — lifetime recycled gold + bags applied. */
    compostLedger?: CompostLedgerState;
    /** Owl post stamp book — lifetime per-NPC owl dispatches. */
    owlStamps?: OwlStampBook;
    /** Open NPC hangout invites + per-NPC cooldown stamps. */
    npcInvites?: Array<{ npcId: string; season: 0 | 1 | 2 | 3; day: number; x: number; y: number; flavor: string; postedDay: number }>;
    lastHangoutDay?: Record<string, number>;
  };
  /** Day / hour clock. We round to the nearest in-game hour on load. */
  time: { day: number; hour: number; minute: number; season: 0 | 1 | 2 | 3 };
  /** World snapshot — tiles + crops + sprinklers. NPCs and buildings are regenerated. */
  world: {
    width: number;
    height: number;
    tiles: TileSnapshot[][];
    crops: CropSnapshot[];
    sprinklers: PlacedSprinkler[];
    scarecrows?: PlacedScarecrow[];
    forage?: PlacedForage[];
    coops?: PlacedCoop[];
    dog?: FarmDogState;
    cat?: FarmCatState;
    greenhouses?: PlacedGreenhouse[];
    chests?: PlacedChest[];
    /** Farm pond — stocked species + pending yield + last tick day. */
    pond?: PondState;
    /** Hatcheries — placed baskets + per-basket incubation state. */
    hatcheries?: PlacedHatchery[];
    /** Compost bins — placed bins with pending batches. */
    composts?: PlacedCompost[];
    /** Storm shelters — placed lean-tos that absorb the next storm. */
    shelters?: PlacedShelter[];
  };
}

/** Tiny storage abstraction — anything that quacks like localStorage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Build a SaveSnapshot from the current Game. Pure — does not mutate.
 * The snapshot is JSON-safe (no functions, no class instances).
 */
export function serializeGame(game: Game): SaveSnapshot {
  const p = game.world.player;
  const tiles: TileSnapshot[][] = game.world.tiles.map((row) =>
    row.map((t) => ({ type: t.type, variant: t.variant })),
  );
  // `world.crops` is typed as RenderCrop but farming.ts stores FarmCrop in it.
  // We snapshot every field we can see — extras are harmless.
  const crops: CropSnapshot[] = (
    game.world.crops as unknown as Array<Record<string, unknown>>
  ).map((c) => ({
    tx: (c.tx as number) ?? (c.x as number),
    ty: (c.ty as number) ?? (c.y as number),
    crop: (c.crop as string) ?? '',
    kind: c.kind as RenderCrop['kind'],
    stage: (c.stage as number) ?? 0,
    watered: (c.watered as boolean) ?? false,
    daysSinceWater: (c.daysSinceWater as number) ?? 0,
    growth: (c.growth as number) ?? 0,
    waterStreak: (c.waterStreak as number) ?? 0,
  }));
  return {
    version: SAVE_VERSION,
    player: {
      x: Math.round(p.x),
      y: Math.round(p.y),
      facing: p.facing,
      inventory: { ...p.inventory },
      gold: p.gold,
      quests: (p.quests as Quest[]).map((q) => ({ ...q, seen: [...q.seen] })),
      hearts: p.hearts ? structuredCloneHearts(p.hearts) : undefined,
      engagement: p.engagement ? { ...p.engagement } : undefined,
      marriage: p.marriage ? { ...p.marriage } : undefined,
      tools: (p as Player & { tools?: Record<string, string> }).tools
        ? { ...(p as Player & { tools?: Record<string, string> }).tools }
        : undefined,
      mail: (p as Player & { mail?: Mailbox }).mail
        ? {
            inbox: getMailbox(p).inbox.map((l) => ({ ...l })),
            delivered: Object.fromEntries(
              Object.entries(getMailbox(p).delivered).map(([k, v]) => [k, [...v]]),
            ),
          }
        : undefined,
      cookCounts: (p as Player & { cookCounts?: Record<string, number> }).cookCounts
        ? { ...(p as Player & { cookCounts?: Record<string, number> }).cookCounts }
        : undefined,
      premiumCookCounts: (p as Player & { premiumCookCounts?: Record<string, number> }).premiumCookCounts
        ? { ...(p as Player & { premiumCookCounts?: Record<string, number> }).premiumCookCounts }
        : undefined,
      cropJournal: (p as Player & { cropJournal?: Record<string, { sown: number; normal: number; silver: number; gold: number; bestStreak: number }> }).cropJournal
        ? Object.fromEntries(
            Object.entries(
              (p as Player & { cropJournal: Record<string, { sown: number; normal: number; silver: number; gold: number; bestStreak: number }> }).cropJournal,
            ).map(([k, v]) => [k, { ...v }]),
          )
        : undefined,
      achievements: (p as Player & { achievements?: Array<{ id: string; earnedDay: number }> }).achievements
        ? (p as Player & { achievements: Array<{ id: string; earnedDay: number }> }).achievements.map((a) => ({ ...a }))
        : undefined,
      moneyLog: (p as Player & { moneyLog?: Array<{ delta: number; reason: string; day: number }> }).moneyLog
        ? (p as Player & { moneyLog: Array<{ delta: number; reason: string; day: number }> }).moneyLog.map((e) => ({ ...e }))
        : undefined,
      settings: (p as Player & { settings?: { autoSave: boolean; nightTintScale: number; hudScale: number; reduceMotion: boolean } }).settings
        ? { ...(p as Player & { settings: { autoSave: boolean; nightTintScale: number; hudScale: number; reduceMotion: boolean } }).settings }
        : undefined,
      pickaxeTier: (p as Player & { pickaxeTier?: string }).pickaxeTier,
      rodTier: (p as Player & { rodTier?: string }).rodTier,
      stamina: (p as Player & { stamina?: StaminaState }).stamina
        ? { ...(p as Player & { stamina: StaminaState }).stamina }
        : undefined,
      restock: (p as Player & { restock?: AutoRestockState }).restock
        ? { ...(p as Player & { restock: AutoRestockState }).restock }
        : undefined,
      decor: (p as Player & { decor?: DecorState }).decor
        ? {
            owned: [...getDecor(p).owned],
            activeWallpaper: getDecor(p).activeWallpaper,
            activeFloor: getDecor(p).activeFloor,
          }
        : undefined,
      spouse: (p as Player & { spouse?: SpouseState }).spouse
        ? { lastGiftDay: getSpouseState(p).lastGiftDay }
        : undefined,
      board: (p as Player & { board?: BoardState }).board
        ? {
            activeId: getBoard(p).activeId,
            postedSeason: getBoard(p).postedSeason,
            postedDay: getBoard(p).postedDay,
            completedCount: getBoard(p).completedCount,
            recent: [...getBoard(p).recent],
          }
        : undefined,
      extractor: (p as Player & { extractor?: ExtractorState }).extractor
        ? { uses: getExtractor(p).uses }
        : undefined,
      tournament: (p as Player & { tournament?: TournamentState }).tournament
        ? {
            entries: Object.fromEntries(
              Object.entries(getTournament(p).entries).map(([k, v]) => [k, { ...v }]),
            ),
          }
        : undefined,
      storm: (p as Player & { storm?: StormState }).storm
        ? {
            hit: { ...getStorm(p).hit },
            lastMemo: getStorm(p).lastMemo ? { ...getStorm(p).lastMemo! } : undefined,
          }
        : undefined,
      bath: (p as Player & { bath?: BathState }).bath
        ? {
            expiresOnDay: getBath(p).expiresOnDay,
            totalSoaks: getBath(p).totalSoaks,
            soapsGifted: getBath(p).soapsGifted,
            seasonalSoaks: getBath(p).seasonalSoaks
              ? { ...getBath(p).seasonalSoaks }
              : undefined,
            seasonalTowelsGifted: getBath(p).seasonalTowelsGifted
              ? { ...getBath(p).seasonalTowelsGifted }
              : undefined,
          }
        : undefined,
      spaPass: (p as Player & { spaPass?: SpaPassState }).spaPass
        ? { punchesLeft: getSpaPass(p).punchesLeft }
        : undefined,
      mineHaul: (p as Player & { mineHaul?: MineHaulState }).mineHaul
        ? {
            counts: { ...getMineHaul(p).counts },
            lastRun: {
              counts: { ...getMineHaul(p).lastRun.counts },
              gold: getMineHaul(p).lastRun.gold,
            },
            lifetimeCounts: { ...(getMineHaul(p).lifetimeCounts ?? {}) },
            bestRun: getMineHaul(p).bestRun
              ? {
                  ...getMineHaul(p).bestRun!,
                  // Deep-copy the composition maps so the snapshot
                  // doesn't share a reference with the live state —
                  // a future record promotion would otherwise mutate
                  // an already-serialised payload.
                  countComposition: getMineHaul(p).bestRun!.countComposition
                    ? { ...getMineHaul(p).bestRun!.countComposition }
                    : undefined,
                  goldComposition: getMineHaul(p).bestRun!.goldComposition
                    ? { ...getMineHaul(p).bestRun!.goldComposition }
                    : undefined,
                }
              : undefined,
            // One-shot deep-vein brag flags — carry both so a save
            // reloaded mid-pending-state surfaces the brag at the next
            // dawn rather than swallowing it, and a save reloaded
            // after the brag already fired stays silent.
            deepVeinBragPending: getMineHaul(p).deepVeinBragPending === true,
            deepVeinBragFired: getMineHaul(p).deepVeinBragFired === true,
            // One-shot split-record brag flags — same shape as the
            // deep-vein pair. Round-trips the pending arm so a player
            // who just split their records and quit before sleep sees
            // the brag the next dawn after reload.
            splitRecordBragPending: getMineHaul(p).splitRecordBragPending === true,
            splitRecordBragFired: getMineHaul(p).splitRecordBragFired === true,
          }
        : undefined,
      rumorHistory: (p as Player & { rumorHistory?: RumorHistoryState }).rumorHistory
        ? {
            entries: getRumorHistory(p).entries.map((e) => ({ ...e })),
          }
        : undefined,
      compostLedger: (p as Player & { compostLedger?: CompostLedgerState }).compostLedger
        ? {
            lifetimeRecycledGold: getCompostLedger(p).lifetimeRecycledGold,
            lifetimeBagsApplied: getCompostLedger(p).lifetimeBagsApplied,
            // Rare-bag tally — distinct from lifetimeBagsApplied; powers
            // the rare-master achievement. Undefined when older saves
            // never tracked it; the lazy reader backfills 0 on first
            // access.
            lifetimeRareBagsApplied: getCompostLedger(p).lifetimeRareBagsApplied,
            // Halfway dawn-nudge one-shot flags — carry across reload
            // so a player who already saw the dawn tail doesn't see
            // it again. Older saves backfill via the optional reader.
            masterNudgeDawnFired: getCompostLedger(p).masterNudgeDawnFired,
            pulperNudgeDawnFired: getCompostLedger(p).pulperNudgeDawnFired,
            rareMasterNudgeDawnFired: getCompostLedger(p).rareMasterNudgeDawnFired,
            // Sash + rare-master one-shot brag flags — carry both the
            // pending-arm and the fired-audit across reload. Undefined
            // when not armed / not fired so older saves backfill
            // cleanly. The composer reads pending and bumps fired on
            // first read.
            sashBragPending: getCompostLedger(p).sashBragPending,
            sashBragFired: getCompostLedger(p).sashBragFired,
            rareMasterBragPending: getCompostLedger(p).rareMasterBragPending,
            rareMasterBragFired: getCompostLedger(p).rareMasterBragFired,
          }
        : undefined,
      owlStamps: (p as Player & { owlStamps?: OwlStampBook }).owlStamps
        ? {
            counts: { ...getOwlStamps(p).counts },
            chain: getOwlStamps(p).chain
              ? { ...getOwlStamps(p).chain! }
              : undefined,
            // One-shot chain-tier brag pending arm — carry the
            // multiplier through so a save reloaded mid-pending-state
            // surfaces the dawn brag at the next rollover rather than
            // swallowing it. Undefined when not armed so older saves
            // backfill cleanly via the lazy reader.
            chainTierBragPending: getOwlStamps(p).chainTierBragPending,
            chainTierBragFired: getOwlStamps(p).chainTierBragFired,
            // Chain-recipient brag fields — pending carries the npcId
            // of the just-crossed pen pal, fired is the audit flag for
            // "this brag has played at least once" + the per-recipient
            // map keys the celebrated NPCs so a second 25-day chain to
            // the same recipient stays quiet on reload.
            chainRecipientBragPending: getOwlStamps(p).chainRecipientBragPending,
            chainRecipientBragFired: getOwlStamps(p).chainRecipientBragFired,
            chainRecipientFired: getOwlStamps(p).chainRecipientFired
              ? { ...getOwlStamps(p).chainRecipientFired! }
              : undefined,
          }
        : undefined,
      npcInvites: (p as Player & { npcInvites?: Array<{ npcId: string; season: 0 | 1 | 2 | 3; day: number; x: number; y: number; flavor: string; postedDay: number }> }).npcInvites
        ? (p as Player & { npcInvites: Array<{ npcId: string; season: 0 | 1 | 2 | 3; day: number; x: number; y: number; flavor: string; postedDay: number }> }).npcInvites.map((iv) => ({ ...iv }))
        : undefined,
      lastHangoutDay: (p as Player & { lastHangoutDay?: Record<string, number> }).lastHangoutDay
        ? { ...(p as Player & { lastHangoutDay: Record<string, number> }).lastHangoutDay }
        : undefined,
    },
    time: {
      day: game.time.day,
      hour: game.time.hour,
      minute: game.time.minute,
      season: game.time.season,
    },
    world: {
      width: game.world.width,
      height: game.world.height,
      tiles,
      crops,
      sprinklers: getSprinklers(game.world).map((s) => ({ ...s })),
      scarecrows: getScarecrows(game.world).map((s) => ({ ...s })),
      forage: getForage(game.world).map((f) => ({ ...f })),
      coops: getCoops(game.world).map((c) => ({ ...c })),
      dog: { ...getDog(game.world) },
      cat: { ...getCat(game.world) },
      greenhouses: getGreenhouses(game.world).map((g) => ({ ...g })),
      chests: getChests(game.world).map((c) => ({ ...c, items: { ...c.items } })),
      pond: { ...getPond(game.world) },
      hatcheries: getHatcheries(game.world).map((h) => ({ ...h })),
      composts: getComposts(game.world).map((c) => ({
        ...c,
        batches: c.batches.map((b) => ({ ...b })),
      })),
      shelters: getShelters(game.world).map((s) => ({ ...s })),
    },
  };
}

/** Plain-object deep clone for the hearts state (no Date / Map shenanigans). */
function structuredCloneHearts(h: HeartsState): HeartsState {
  const out: HeartsState = {};
  for (const [k, v] of Object.entries(h)) {
    out[k] = { points: v.points, lastGiftDay: v.lastGiftDay, lastTalkDay: v.lastTalkDay };
  }
  return out;
}

/**
 * Apply a snapshot back onto a Game. Skips a snapshot whose width/height
 * doesn't match the current World (different map version) and returns
 * false so the caller can fall back to a fresh game.
 */
export function applySnapshot(game: Game, snap: SaveSnapshot): boolean {
  if (snap.version !== SAVE_VERSION) return false;
  if (snap.world.width !== game.world.width || snap.world.height !== game.world.height) {
    return false;
  }
  const p = game.world.player;
  // Player.
  p.x = snap.player.x;
  p.y = snap.player.y;
  p.targetX = p.x;
  p.targetY = p.y;
  p.fromX = p.x;
  p.fromY = p.y;
  p.moveProgress = 1;
  p.facing = snap.player.facing;
  p.inventory = { ...snap.player.inventory };
  p.gold = snap.player.gold;
  p.quests = snap.player.quests.map((q) => ({ ...q, seen: [...q.seen] }));
  if (snap.player.hearts) p.hearts = structuredCloneHearts(snap.player.hearts);
  if (snap.player.engagement) p.engagement = { ...snap.player.engagement };
  if (snap.player.marriage) p.marriage = { ...snap.player.marriage };
  if (snap.player.tools) {
    (p as Player & { tools?: Record<string, string> }).tools = { ...snap.player.tools };
  }
  if (snap.player.mail) {
    (p as Player & { mail?: Mailbox }).mail = {
      inbox: snap.player.mail.inbox.map((l) => ({ ...l })),
      delivered: Object.fromEntries(
        Object.entries(snap.player.mail.delivered).map(([k, v]) => [k, [...v]]),
      ),
    };
  }
  if (snap.player.cookCounts) {
    (p as Player & { cookCounts?: Record<string, number> }).cookCounts = {
      ...snap.player.cookCounts,
    };
  }
  if (snap.player.premiumCookCounts) {
    (p as Player & { premiumCookCounts?: Record<string, number> }).premiumCookCounts = {
      ...snap.player.premiumCookCounts,
    };
  }
  if (snap.player.cropJournal) {
    (p as Player & { cropJournal?: Record<string, { sown: number; normal: number; silver: number; gold: number; bestStreak: number }> }).cropJournal =
      Object.fromEntries(
        Object.entries(snap.player.cropJournal).map(([k, v]) => [k, { ...v }]),
      );
  }
  if (snap.player.achievements) {
    (p as Player & { achievements?: Array<{ id: string; earnedDay: number }> }).achievements =
      snap.player.achievements.map((a) => ({ ...a }));
  }
  if (snap.player.moneyLog) {
    (p as Player & { moneyLog?: Array<{ delta: number; reason: string; day: number }> }).moneyLog =
      snap.player.moneyLog.map((e) => ({ ...e }));
  }
  if (snap.player.settings) {
    const s = snap.player.settings;
    (p as Player & { settings?: { autoSave: boolean; nightTintScale: number; hudScale: number; reduceMotion: boolean } }).settings = {
      autoSave: s.autoSave,
      nightTintScale: s.nightTintScale,
      hudScale: s.hudScale,
      reduceMotion: s.reduceMotion,
    };
  }
  if (snap.player.pickaxeTier) {
    (p as Player & { pickaxeTier?: string }).pickaxeTier = snap.player.pickaxeTier;
  }
  if (snap.player.rodTier) {
    (p as Player & { rodTier?: string }).rodTier = snap.player.rodTier;
  }
  // Stamina — overwrite the pool on load; default-init for older saves.
  const staminaCur = getStamina(p);
  const staminaIncoming = snap.player.stamina ?? defaultStaminaState(snap.time.day);
  staminaCur.current = staminaIncoming.current;
  staminaCur.max = staminaIncoming.max;
  staminaCur.lastRefillDay = staminaIncoming.lastRefillDay;
  // Auto-restock memo — overwrite when present, leave default null otherwise.
  if (snap.player.restock) {
    const cur = getRestock(p);
    cur.lastSeed = snap.player.restock.lastSeed;
  }
  // Farmhouse decor — restore owned pieces + active slot selections.
  if (snap.player.decor) {
    const cur = getDecor(p);
    cur.owned = [...snap.player.decor.owned];
    cur.activeWallpaper = snap.player.decor.activeWallpaper;
    cur.activeFloor = snap.player.decor.activeFloor;
  }
  // Spouse — preserve last-gift-day so morning gifts don't double-dip.
  if (snap.player.spouse) {
    const cur = getSpouseState(p);
    cur.lastGiftDay = snap.player.spouse.lastGiftDay;
  }
  // Quest board — restore the active week + history counters.
  if (snap.player.board) {
    const cur = getBoard(p);
    cur.activeId = snap.player.board.activeId;
    cur.postedSeason = snap.player.board.postedSeason;
    cur.postedDay = snap.player.board.postedDay;
    cur.completedCount = snap.player.board.completedCount;
    cur.recent = [...snap.player.board.recent];
  }
  // Seed extractor — preserve the use-counter so the 1/2 yield rhythm
  // doesn't reset on every reload.
  if (snap.player.extractor) {
    const cur = getExtractor(p);
    cur.uses = snap.player.extractor.uses;
  }
  // Friendship tournament — restore the entries map so re-entry on a
  // reloaded save still flags 'already-entered' for past contests.
  if (snap.player.tournament) {
    const cur = getTournament(p);
    cur.entries = Object.fromEntries(
      Object.entries(snap.player.tournament.entries).map(([k, v]) => [k, { ...v }]),
    );
  }
  // Seasonal storm — restore the per-season hit log + most-recent memo
  // so reload right after a storm shows the same dawn summary.
  if (snap.player.storm) {
    const cur = getStorm(p);
    cur.hit = { ...snap.player.storm.hit };
    cur.lastMemo = snap.player.storm.lastMemo ? { ...snap.player.storm.lastMemo } : undefined;
  }
  // Bath house — preserve buff expiry so a reload mid-soak still
  // honours the stamina-cap lift. Also restore lifetime soak count +
  // gifted-soap count so the loyalty path doesn't reset on reload.
  // Same goes for the per-season towel bookkeeping.
  if (snap.player.bath) {
    const cur = getBath(p);
    cur.expiresOnDay = snap.player.bath.expiresOnDay;
    if (snap.player.bath.totalSoaks !== undefined) cur.totalSoaks = snap.player.bath.totalSoaks;
    if (snap.player.bath.soapsGifted !== undefined) cur.soapsGifted = snap.player.bath.soapsGifted;
    if (snap.player.bath.seasonalSoaks !== undefined) {
      cur.seasonalSoaks = { ...snap.player.bath.seasonalSoaks };
    }
    if (snap.player.bath.seasonalTowelsGifted !== undefined) {
      cur.seasonalTowelsGifted = { ...snap.player.bath.seasonalTowelsGifted };
    }
  }
  // Spa pass — restore punches so the player doesn't lose paid-for
  // soaks when the page reloads mid-season.
  if (snap.player.spaPass) {
    const cur = getSpaPass(p);
    cur.punchesLeft = snap.player.spaPass.punchesLeft;
  }
  // Mining haul — restore the running tally + the most-recent run
  // snapshot so the dawn-toast recap survives a reload.
  if (snap.player.mineHaul) {
    const cur = getMineHaul(p);
    cur.counts = { ...snap.player.mineHaul.counts };
    cur.lastRun = {
      counts: { ...snap.player.mineHaul.lastRun.counts },
      gold: snap.player.mineHaul.lastRun.gold,
    };
    // Older saves predate lifetimeCounts — fall back to an empty map
    // so the achievement check doesn't crash on the first reload.
    cur.lifetimeCounts = snap.player.mineHaul.lifetimeCounts
      ? { ...snap.player.mineHaul.lifetimeCounts }
      : {};
    // Older saves predate the bestRun ribbon — leave undefined and
    // the lazy reader will keep it that way until the next sleep
    // captures a record. Deep-copy the composition maps so the
    // restored state doesn't share refs with the snapshot payload.
    cur.bestRun = snap.player.mineHaul.bestRun
      ? {
          ...snap.player.mineHaul.bestRun,
          countComposition: snap.player.mineHaul.bestRun.countComposition
            ? { ...snap.player.mineHaul.bestRun.countComposition }
            : undefined,
          goldComposition: snap.player.mineHaul.bestRun.goldComposition
            ? { ...snap.player.mineHaul.bestRun.goldComposition }
            : undefined,
        }
      : undefined;
    // Deep-vein one-shot brag flags — older saves predate them so
    // backfill false via === true coercion. The composer reads
    // deepVeinBragPending and bumps deepVeinBragFired on first read.
    cur.deepVeinBragPending = snap.player.mineHaul.deepVeinBragPending === true;
    cur.deepVeinBragFired = snap.player.mineHaul.deepVeinBragFired === true;
    // Split-record one-shot brag flags — older saves predate them so
    // backfill false via === true coercion. The composer reads
    // splitRecordBragPending and bumps splitRecordBragFired on first read.
    cur.splitRecordBragPending = snap.player.mineHaul.splitRecordBragPending === true;
    cur.splitRecordBragFired = snap.player.mineHaul.splitRecordBragFired === true;
  }
  // Rumor history — restore the ring buffer of past headliners + the
  // bought flag so the cart-menu can keep showing accurate skipped/
  // bought stamps after a reload.
  if (snap.player.rumorHistory) {
    const cur = getRumorHistory(p);
    cur.entries = snap.player.rumorHistory.entries.map((e) => ({ ...e }));
  }
  if (snap.player.compostLedger) {
    const cur = getCompostLedger(p);
    cur.lifetimeRecycledGold = snap.player.compostLedger.lifetimeRecycledGold;
    cur.lifetimeBagsApplied = snap.player.compostLedger.lifetimeBagsApplied;
    // Carry the rare-bag tally — the rare-master achievement reads
    // off this field. Older saves predating it land here as
    // undefined; the lazy reader backfills 0 on first access so
    // the achievement predicate stays correct.
    if (snap.player.compostLedger.lifetimeRareBagsApplied !== undefined) {
      cur.lifetimeRareBagsApplied = snap.player.compostLedger.lifetimeRareBagsApplied;
    }
    // Carry the dawn-nudge one-shot flags so a player who already saw
    // the dawn tail doesn't see it again after a reload. Older saves
    // (without these fields) backfill false via the optional reader.
    cur.masterNudgeDawnFired = snap.player.compostLedger.masterNudgeDawnFired === true;
    cur.pulperNudgeDawnFired = snap.player.compostLedger.pulperNudgeDawnFired === true;
    cur.rareMasterNudgeDawnFired = snap.player.compostLedger.rareMasterNudgeDawnFired === true;
    // Carry the sash + rare-master dawn-brag one-shot flags. Pending
    // is undefined when not armed (preserve sentinel); fired is
    // coerced via === true so older saves without the field land
    // as false.
    if (snap.player.compostLedger.sashBragPending !== undefined) {
      cur.sashBragPending = snap.player.compostLedger.sashBragPending;
    }
    cur.sashBragFired = snap.player.compostLedger.sashBragFired === true;
    if (snap.player.compostLedger.rareMasterBragPending !== undefined) {
      cur.rareMasterBragPending = snap.player.compostLedger.rareMasterBragPending;
    }
    cur.rareMasterBragFired = snap.player.compostLedger.rareMasterBragFired === true;
  }
  if (snap.player.owlStamps) {
    const cur = getOwlStamps(p);
    cur.counts = { ...snap.player.owlStamps.counts };
    // Letter-chain state — carry the active chain (npcId / length /
    // lastDay) so a save reloaded mid-streak keeps its momentum.
    // Older saves predating the chain field land here with `chain`
    // undefined; we leave the lazy reader to backfill an empty chain
    // on first access.
    if (snap.player.owlStamps.chain) {
      cur.chain = { ...snap.player.owlStamps.chain };
    }
    // Chain-tier brag pending — carry across reload so a player who
    // crossed a tier just before quitting still sees the dawn brag
    // the next morning on a fresh boot. Undefined when not armed.
    if (snap.player.owlStamps.chainTierBragPending !== undefined) {
      cur.chainTierBragPending = snap.player.owlStamps.chainTierBragPending;
    }
    if (snap.player.owlStamps.chainTierBragFired === true) {
      cur.chainTierBragFired = true;
    }
    // Chain-recipient brag fields — pending carries the npcId, fired
    // is the audit flag, fired-map records each celebrated recipient.
    // === coercion on the boolean so a stale JSON `"true"` string
    // doesn't leak in.
    if (snap.player.owlStamps.chainRecipientBragPending !== undefined) {
      cur.chainRecipientBragPending = snap.player.owlStamps.chainRecipientBragPending;
    }
    if (snap.player.owlStamps.chainRecipientBragFired === true) {
      cur.chainRecipientBragFired = true;
    }
    if (snap.player.owlStamps.chainRecipientFired) {
      cur.chainRecipientFired = { ...snap.player.owlStamps.chainRecipientFired };
    }
  }
  if (snap.player.npcInvites) {
    (p as Player & { npcInvites?: typeof snap.player.npcInvites }).npcInvites =
      snap.player.npcInvites.map((iv) => ({ ...iv }));
  }
  if (snap.player.lastHangoutDay) {
    (p as Player & { lastHangoutDay?: Record<string, number> }).lastHangoutDay = {
      ...snap.player.lastHangoutDay,
    };
  }
  // Tiles.
  for (let y = 0; y < snap.world.height; y++) {
    for (let x = 0; x < snap.world.width; x++) {
      const t = snap.world.tiles[y][x];
      game.world.tiles[y][x] = { type: t.type, variant: t.variant };
    }
  }
  // Crops — replace the array wholesale; FarmCrop and RenderCrop coexist.
  game.world.crops.length = 0;
  for (const c of snap.world.crops) {
    (game.world.crops as unknown as CropSnapshot[]).push({
      tx: c.tx,
      ty: c.ty,
      crop: c.crop,
      kind: c.kind,
      stage: c.stage,
      watered: c.watered,
      daysSinceWater: c.daysSinceWater,
      growth: c.growth,
      waterStreak: c.waterStreak ?? 0,
    });
    // Also mirror x/y onto the entry so the renderer's RenderCrop.x/y view works.
    const last = game.world.crops[game.world.crops.length - 1] as unknown as Record<string, number>;
    last.x = c.tx;
    last.y = c.ty;
  }
  // Sprinklers — replace the world's list. Default to empty for forward
  // compat with v1 saves that pre-date sprinklers.
  const sprList = getSprinklers(game.world);
  sprList.length = 0;
  for (const s of snap.world.sprinklers ?? []) {
    sprList.push({ ...s });
  }
  // Scarecrows — forward-compat default for older saves.
  const scarecrowList = getScarecrows(game.world);
  scarecrowList.length = 0;
  for (const s of snap.world.scarecrows ?? []) {
    scarecrowList.push({ ...s });
  }
  // Forage — same forward-compat story; older v1 saves predate the
  // forage list and round-trip cleanly with an empty array.
  const forageList = getForage(game.world);
  forageList.length = 0;
  for (const f of snap.world.forage ?? []) {
    forageList.push({ ...f });
  }
  // Coops — forward-compat default.
  const coopList = getCoops(game.world);
  coopList.length = 0;
  for (const c of snap.world.coops ?? []) {
    coopList.push({ ...c });
  }
  // Dog — overwrite the world's dog state when present.
  const dogCur = getDog(game.world);
  const dogIncoming = snap.world.dog ?? defaultDogState();
  dogCur.owned = dogIncoming.owned;
  dogCur.x = dogIncoming.x;
  dogCur.y = dogIncoming.y;
  dogCur.petLastDay = dogIncoming.petLastDay;
  dogCur.petTotal = dogIncoming.petTotal;
  dogCur.petStreak = dogIncoming.petStreak;
  // Cat — same forward-compat story; older v1 saves predate the cat.
  const catCur = getCat(game.world);
  const catIncoming = snap.world.cat ?? defaultCatState();
  catCur.owned = catIncoming.owned;
  catCur.x = catIncoming.x;
  catCur.y = catIncoming.y;
  catCur.petLastDay = catIncoming.petLastDay;
  catCur.petTotal = catIncoming.petTotal;
  catCur.petStreak = catIncoming.petStreak;
  // Greenhouses — forward-compat default.
  const greenList = getGreenhouses(game.world);
  greenList.length = 0;
  for (const g of snap.world.greenhouses ?? []) {
    greenList.push({ ...g });
  }
  // Chests — forward-compat default. Items map is cloned per-chest.
  const chestList = getChests(game.world);
  chestList.length = 0;
  for (const c of snap.world.chests ?? []) {
    chestList.push({ ...c, items: { ...c.items } });
  }
  // Pond — forward-compat default for older saves (pond stays unstocked).
  if (snap.world.pond) {
    const cur = getPond(game.world);
    cur.species = snap.world.pond.species;
    cur.pending = snap.world.pond.pending;
    cur.lastYieldDay = snap.world.pond.lastYieldDay;
  }
  // Hatcheries — forward-compat default for older saves (empty list).
  const hatcheryList = getHatcheries(game.world);
  hatcheryList.length = 0;
  for (const h of snap.world.hatcheries ?? []) {
    hatcheryList.push({ ...h });
  }
  // Compost bins — forward-compat default for older saves (empty list).
  const compostList = getComposts(game.world);
  compostList.length = 0;
  for (const c of snap.world.composts ?? []) {
    compostList.push({ ...c, batches: c.batches.map((b) => ({ ...b })) });
  }
  // Storm shelters — forward-compat default for older saves.
  const shelterList = getShelters(game.world);
  shelterList.length = 0;
  for (const s of snap.world.shelters ?? []) {
    shelterList.push({ ...s });
  }
  // Time — set day/season directly; reseed the internal elapsed counter.
  game.time.day = snap.time.day;
  game.time.hour = snap.time.hour;
  game.time.minute = snap.time.minute;
  game.time.season = snap.time.season;
  // Force the renderer to pick up the change next frame.
  return true;
}

/** Writes the snapshot to storage. Returns false on a quota / serialisation error. */
export function saveToStorage(
  game: Game,
  storage: StorageLike,
  key: string = SAVE_KEY,
): boolean {
  try {
    const snap = serializeGame(game);
    storage.setItem(key, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
}

/** Loads a snapshot from storage. Returns null on miss / parse error / version mismatch. */
export function loadFromStorage(
  storage: StorageLike,
  key: string = SAVE_KEY,
): SaveSnapshot | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== SAVE_VERSION) return null;
    if (!parsed.player || !parsed.world || !parsed.time) return null;
    return parsed as SaveSnapshot;
  } catch {
    return null;
  }
}

/** Wipes the save slot. Used by the future settings "Reset save" button. */
export function clearSave(storage: StorageLike, key: string = SAVE_KEY): void {
  try {
    storage.removeItem(key);
  } catch {
    // Best-effort — silently fail if storage is locked.
  }
}
