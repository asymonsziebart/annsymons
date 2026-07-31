// Compost bin — recycle harvest crops into fertilizer.
//
// Excess wheat/tomato/pumpkin/flower crops sit in the bag taking up
// space; the well sells them at base price but a player late-game has
// silver and gold harvests they'd rather sell instead. The compost
// bin gives those normal-tier crops a second life: deposit any number
// of `<crop>_harvest` keys into the bin and they ferment for
// COMPOST_DAYS days into bags of fertilizer. Applying a fertilizer
// bag to a watered crop bumps its waterStreak by FERTILIZER_STREAK so
// the crop ripens a tier higher at harvest.
//
// Pricing intent: COMPOST_BIN_PRICE (140g) at Vallie's shop. The bin
// is a 1-tile placeable so it slots next to the field without taking
// real estate. COMPOST_RATIO of 4 crops per 1 fertilizer keeps the
// player from steamrolling silver-tier with a single planting season:
// they have to choose between selling at the well or recycling.
//
// Pure module: no IO, no canvas. The Game wires placement, deposit
// hotkey, fertilizer apply, and the dawn finish-tick.

import type { World, Tile } from '../world/world';
import type { FarmCrop } from './farming';
import { cropAt } from './farming';
import { CROP_KEYS } from './crops';
import { oneShotBrag } from './dawn-toast';

/** Inventory key for an unplaced bin from Vallie's shop. */
export const COMPOST_BIN_INVENTORY_KEY = 'compost-bin';

/** Vallie's price for one bin. */
export const COMPOST_BIN_PRICE = 140;

/** Inventory key for a finished bag of fertilizer. */
export const FERTILIZER_INVENTORY_KEY = 'fertilizer';

/** Days a deposit takes to finish composting into fertilizer. */
export const COMPOST_DAYS = 3;

/** Crops required per finished fertilizer bag. */
export const COMPOST_RATIO = 4;

/** Hard cap of pending compost piles inside one bin. */
export const COMPOST_MAX_BATCHES = 5;

/** Streak bonus a fertilizer bag grants when applied. */
export const FERTILIZER_STREAK = 2;

/** Inventory key for a finished bag of RARE fertilizer ("week-of" bonus). */
export const RARE_FERTILIZER_INVENTORY_KEY = 'fertilizer-rare';

/** Streak bonus the rare fertilizer grants. */
export const RARE_FERTILIZER_STREAK = 4;

/**
 * Per-season day the rare fertilizer bonus fires. Composting that
 * finishes on this day mints rare bags instead of regular ones.
 * Deterministic so the player can plan deposit timing around it.
 *
 * Range [1..6] avoids the season turnover (day 7) so the bonus never
 * straddles seasons. Cached per-season to stay stable across reloads.
 */
export const RARE_FINISH_DAY_MIN = 1;
export const RARE_FINISH_DAY_MAX = 6;

/** Footprint is 1x1; placement matches sprinkler / chest convention. */

/** One pending batch inside the bin. */
export interface CompostBatch {
  /** How many normal-tier crops are sitting in this pile. */
  crops: number;
  /** Day the batch finishes — yields Math.floor(crops/COMPOST_RATIO) bags. */
  finishOnDay: number;
}

/** One placed bin in the world. */
export interface PlacedCompost {
  tx: number;
  ty: number;
  /** Pending piles. Each was committed on the day deposit happened. */
  batches: CompostBatch[];
}

export interface WorldWithCompost {
  composts?: PlacedCompost[];
}

/** Lazy reader. */
export function getComposts(world: World): PlacedCompost[] {
  const w = world as World & WorldWithCompost;
  if (!w.composts) w.composts = [];
  return w.composts;
}

/** True when (tx,ty) is grass and outside any existing building or bin. */
export function canPlaceCompost(world: World, tx: number, ty: number): boolean {
  if (!world.inBounds(tx, ty)) return false;
  const tile: Tile = world.tiles[ty][tx];
  if (tile.type !== 'grass') return false;
  for (const b of world.buildings) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return false;
  }
  if (compostAt(world, tx, ty)) return false;
  return true;
}

/** Place a bin. Returns the placed entity or null. */
export function placeCompost(world: World, tx: number, ty: number): PlacedCompost | null {
  if (!canPlaceCompost(world, tx, ty)) return null;
  const c: PlacedCompost = { tx, ty, batches: [] };
  getComposts(world).push(c);
  return c;
}

/** Returns the bin at (tx,ty) or undefined. */
export function compostAt(world: World, tx: number, ty: number): PlacedCompost | undefined {
  return getComposts(world).find((c) => c.tx === tx && c.ty === ty);
}

/** Returns the bin orthogonally or diagonally adjacent to (tx,ty), or undefined. */
export function adjacentCompost(
  world: World,
  tx: number,
  ty: number,
): PlacedCompost | undefined {
  for (const c of getComposts(world)) {
    if (Math.abs(c.tx - tx) <= 1 && Math.abs(c.ty - ty) <= 1) {
      return c;
    }
  }
  return undefined;
}

/** Outcome of a deposit attempt. */
export type DepositOutcome =
  | { kind: 'deposited'; crops: number; finishOnDay: number }
  | { kind: 'no-crops' }
  | { kind: 'bin-full' };

/**
 * Deposit every normal-tier `<crop>_harvest` from the bag into the
 * bin. Silver / gold harvests are LEFT IN THE BAG so the player can
 * sell them at full premium — composting them would be a waste.
 *
 * Returns the count actually deposited. Refuses with 'no-crops' when
 * the bag is dry, 'bin-full' when the bin is already at the batch cap.
 */
export function depositCrops(
  bin: PlacedCompost,
  player: { inventory: Record<string, number> },
  today: number,
): DepositOutcome {
  if (bin.batches.length >= COMPOST_MAX_BATCHES) {
    return { kind: 'bin-full' };
  }
  let total = 0;
  for (const cropKey of CROP_KEYS) {
    const k = `${cropKey}_harvest`;
    const have = player.inventory[k] ?? 0;
    if (have > 0) {
      total += have;
      player.inventory[k] = 0;
    }
  }
  if (total <= 0) return { kind: 'no-crops' };
  const batch: CompostBatch = { crops: total, finishOnDay: today + COMPOST_DAYS - 1 };
  bin.batches.push(batch);
  return { kind: 'deposited', crops: total, finishOnDay: batch.finishOnDay };
}

/**
 * Day-rollover hook. Walk every bin; any batch whose finishOnDay is
 * less than `today` mints floor(crops/COMPOST_RATIO) fertilizer bags
 * into the player's inventory, then removes itself from the bin.
 *
 * If the batch finished on the season's RARE day (rareFinishDay
 * matches the batch's finishOnDay), bags are minted into the
 * RARE_FERTILIZER_INVENTORY_KEY instead — those bags grant +4 streak
 * when applied. `season` lets the caller pass the current season so
 * the rare-day picker stays deterministic per-season.
 *
 * Returns the total bags minted across every bin this morning so the
 * caller can post a single toast. Use mintedRare() right after to
 * split the toast wording when any rare bags were produced.
 */
export function compostTick(
  world: World,
  player: { inventory: Record<string, number> },
  today: number,
  season: number = 0,
): number {
  let minted = 0;
  const rareDay = rareFinishDayFor(season);
  for (const bin of getComposts(world)) {
    const remaining: CompostBatch[] = [];
    for (const b of bin.batches) {
      if (b.finishOnDay < today) {
        const bags = Math.floor(b.crops / COMPOST_RATIO);
        if (bags > 0) {
          const isRare = b.finishOnDay === rareDay;
          const key = isRare ? RARE_FERTILIZER_INVENTORY_KEY : FERTILIZER_INVENTORY_KEY;
          player.inventory[key] = (player.inventory[key] ?? 0) + bags;
          minted += bags;
        }
      } else {
        remaining.push(b);
      }
    }
    bin.batches = remaining;
  }
  return minted;
}

/**
 * Returns the day-of-season the rare fertilizer fires. Deterministic
 * per season — same season always returns the same day in
 * [RARE_FINISH_DAY_MIN, RARE_FINISH_DAY_MAX]. Pure function so the
 * UI / HUD can preview it in a hint without coupling to compostTick.
 */
export function rareFinishDayFor(season: number): number {
  // Cheap deterministic mix over the season index.
  const h = ((season + 1) * 2654435761) ^ 0x9e3779b9;
  const span = RARE_FINISH_DAY_MAX - RARE_FINISH_DAY_MIN + 1;
  return RARE_FINISH_DAY_MIN + (Math.abs(h >>> 0) % span);
}

/** Pretty hint of the rare-fertilizer day for the season. */
export function rareFinishDayLine(season: number): string {
  const seasonName = ['Spring', 'Summer', 'Fall', 'Winter'][season % 4] ?? 'Spring';
  return `${seasonName} compost: bags finishing on day ${rareFinishDayFor(season)} are RARE (+${RARE_FERTILIZER_STREAK} streak each).`;
}

/** Outcome of an apply attempt. */
export type ApplyOutcome =
  | {
      kind: 'applied';
      cropKey: string;
      newStreak: number;
      bonus: number;
      rare: boolean;
      /** Gold-back recycled from the bag (1g regular, 3g rare). */
      recycledGold: number;
    }
  | { kind: 'no-fertilizer' }
  | { kind: 'no-crop' };

/**
 * Gold returned when a fertilizer bag is consumed. The "compost compost"
 * loop: applying a bag tears the empty hessian sack and a few stray
 * compost grains, recycled back into the gold pile (1g per regular,
 * 3g per rare bag). Small enough that the player doesn't farm fert
 * for gold — large enough that a lifetime stockpile feels like it
 * always leaves a small parting gift.
 */
export const COMPOST_RECYCLE_REGULAR = 1;
export const COMPOST_RECYCLE_RARE = 3;

/**
 * Apply one fertilizer bag to the crop at (tx,ty). Prefers rare bags
 * first (they grant +4 streak instead of +2) so the player can stockpile
 * regular bags for later without losing rare value. Returns the new
 * waterStreak so the caller can surface it in a toast. Silently leaves
 * the streak alone if no crop is there.
 *
 * Side effect on apply: a small "compost compost" recycle pays the
 * player 1g (regular bag) or 3g (rare bag) — the bag's stray grains
 * + hessian sack pulped back into something useful. The recycle is
 * credited directly to `player.gold` so callers don't have to care;
 * the recycledGold field on the outcome lets the engine surface the
 * gold-back in the same toast that announces the apply.
 *
 * Also bumps the per-player CompostLedgerState — lifetimeRecycledGold
 * + lifetimeBagsApplied — so the "fertilizer master" badge can light
 * up off a single counter, and the journal can surface "you've
 * recycled Ng across your career".
 */
export function applyFertilizer(
  world: World,
  player: { inventory: Record<string, number>; gold?: number },
  tx: number,
  ty: number,
): ApplyOutcome {
  const haveRare = player.inventory[RARE_FERTILIZER_INVENTORY_KEY] ?? 0;
  const haveReg = player.inventory[FERTILIZER_INVENTORY_KEY] ?? 0;
  if (haveRare <= 0 && haveReg <= 0) return { kind: 'no-fertilizer' };
  const c = cropAt(world, tx, ty);
  if (!c) return { kind: 'no-crop' };
  const farmCrop = c as unknown as FarmCrop;
  let bonus: number;
  let rare: boolean;
  let recycledGold: number;
  if (haveRare > 0) {
    player.inventory[RARE_FERTILIZER_INVENTORY_KEY] = haveRare - 1;
    bonus = RARE_FERTILIZER_STREAK;
    rare = true;
    recycledGold = COMPOST_RECYCLE_RARE;
  } else {
    player.inventory[FERTILIZER_INVENTORY_KEY] = haveReg - 1;
    bonus = FERTILIZER_STREAK;
    rare = false;
    recycledGold = COMPOST_RECYCLE_REGULAR;
  }
  farmCrop.waterStreak = (farmCrop.waterStreak ?? 0) + bonus;
  // The crop is now treated as freshly watered so the dryness counter
  // doesn't ruin the bumped streak overnight.
  farmCrop.daysSinceWater = 0;
  farmCrop.watered = true;
  // Credit the recycle directly to the player's gold. We only touch
  // gold when the field exists — the test fixture for compost-only
  // callers uses a lightweight player object that may not carry gold.
  if (typeof player.gold === 'number') {
    player.gold += recycledGold;
  }
  // Lifetime ledger — bump lifetimeRecycledGold + lifetimeBagsApplied.
  // The `rare` flag also bumps the separate lifetimeRareBagsApplied
  // counter so the rare-master achievement can tell rare grinds from
  // regular ones — the regular bag counter can't distinguish them
  // because both bumps it by exactly 1.
  // Always bumps, even when the player fixture doesn't carry gold, so
  // unit tests that hand-craft a player can still verify the counter.
  recordApplied(player, recycledGold, rare);
  return {
    kind: 'applied',
    cropKey: farmCrop.crop,
    newStreak: farmCrop.waterStreak,
    bonus,
    rare,
    recycledGold,
  };
}

/** Total pending crops across all bins. Used for HUD glance. */
export function pendingCrops(world: World): number {
  let total = 0;
  for (const c of getComposts(world)) {
    for (const b of c.batches) total += b.crops;
  }
  return total;
}

/** Pretty status line for the bin under the player's feet.
 *
 * When `season` + `today` are supplied the line also surfaces a
 * countdown to the season's rare-fertilizer day, plus a flag on any
 * batch that's currently scheduled to finish on it. This lets the
 * player plan deposits around the rare window without leaving the bin
 * to flip the calendar.
 *
 * Older callers that pass just (bin, today) keep the old output —
 * the rare hint defaults off so any existing test fixtures pass.
 */
export function compostStatusLine(
  bin: PlacedCompost,
  today: number,
  season?: number,
  dayOfSeason?: number,
): string {
  if (bin.batches.length === 0) {
    const empty = 'Compost bin is empty. Press F to deposit normal-tier crops.';
    if (season !== undefined && dayOfSeason !== undefined) {
      const rareHint = rareDayCountdownLine(season, dayOfSeason);
      if (rareHint) return `${empty} ${rareHint}`;
    }
    return empty;
  }
  let nearestLeft = Infinity;
  let pendingBags = 0;
  let pendingRare = 0;
  let dryCrops = 0;
  let rareDryBatches = 0;
  const rareDay = season !== undefined ? rareFinishDayFor(season) : -1;
  for (const b of bin.batches) {
    const left = b.finishOnDay - today + 1;
    if (left < nearestLeft) nearestLeft = left;
    if (b.finishOnDay < today) {
      const bags = Math.floor(b.crops / COMPOST_RATIO);
      pendingBags += bags;
      if (b.finishOnDay === rareDay) pendingRare += bags;
    } else {
      dryCrops += b.crops;
      if (b.finishOnDay === rareDay) rareDryBatches += 1;
    }
  }
  if (pendingBags > 0) {
    const tag = pendingRare > 0
      ? ` (${pendingRare} RARE)`
      : '';
    return `Compost ready: ${pendingBags} bag${pendingBags === 1 ? '' : 's'}${tag} hatching at dawn.`;
  }
  const rareTag = rareDryBatches > 0
    ? ` ${rareDryBatches === 1 ? 'one batch' : `${rareDryBatches} batches`} on the rare-day track.`
    : '';
  const countdown = (season !== undefined && dayOfSeason !== undefined && rareDryBatches === 0)
    ? rareDayCountdownLine(season, dayOfSeason)
    : '';
  const tail = rareTag || (countdown ? ` ${countdown}` : '');
  return `Composting ${dryCrops} crop${dryCrops === 1 ? '' : 's'} — ${nearestLeft} day${nearestLeft === 1 ? '' : 's'} until first bag.${tail}`;
}

/**
 * Pretty countdown line for the rare-fertilizer day this season. Used
 * by the compost HUD glance and any external system (e.g. the dawn
 * toast on a rare-day deposit). Returns an empty string when the rare
 * day has already passed for this season.
 */
export function rareDayCountdownLine(season: number, dayOfSeason: number): string {
  const rareDay = rareFinishDayFor(season);
  const delta = rareDay - dayOfSeason;
  if (delta < 0) return '';
  if (delta === 0) return `RARE day TODAY — batches finishing today mint +${RARE_FERTILIZER_STREAK}-streak bags.`;
  if (delta === 1) return `RARE day tomorrow — line a batch up to finish then.`;
  return `RARE day in ${delta} days (day ${rareDay}).`;
}

// ---------------------------------------------------------------------
// Lifetime compost ledger — tracks recycled gold + bags applied across
// the player's career. Lives on a tiny lazy field so we don't widen
// SaveSnapshot.player at the top level (the persistence whitelist
// already passes objects through). Bumped from applyFertilizer.
// ---------------------------------------------------------------------

/** Per-player lifetime compost ledger. */
export interface CompostLedgerState {
  /** Total gold recycled from bag applies across the player's career. */
  lifetimeRecycledGold: number;
  /** Total fertilizer bags ever applied (regular + rare combined). */
  lifetimeBagsApplied: number;
  /**
   * Total RARE fertilizer bags ever applied. Distinct from
   * lifetimeBagsApplied (which counts every bag): rare bags are worth
   * +4 streak (vs +2 for regular) and they're gated behind the
   * per-season rare-day finishing window so the player can't farm
   * them at will. Tracking them separately powers the rare-master
   * achievement at 100 rare bags applied — a meaningful late-game
   * grind that the regular bag counter can't distinguish.
   *
   * Optional because older saves predate it; the lazy reader
   * backfills it to 0 on first access. recordApplied bumps both
   * counters when a rare bag lands; the regular path only bumps
   * lifetimeBagsApplied.
   */
  lifetimeRareBagsApplied?: number;
  /**
   * Set to true once the player has crossed COMPOST_MASTER_NUDGE_MIN_GOLD
   * and the dawn-toast has surfaced the "halfway to the badge" one-shot
   * for them. Stays true forever so the nudge doesn't re-fire if the
   * player drops back under the floor (which can't happen with the
   * current monotonic ledger, but defending against the case keeps
   * the contract clean). Optional so older saves backfill cleanly.
   */
  masterNudgeDawnFired?: boolean;
  /**
   * Symmetric one-shot for the pulper-badge dawn nudge — true once the
   * dawn-toast has surfaced "halfway to the pulper badge". Optional
   * for older saves; the lazy reader backfills false.
   */
  pulperNudgeDawnFired?: boolean;
  /**
   * Symmetric one-shot for the rare-master dawn nudge — true once the
   * dawn-toast has surfaced "Halfway to Rare Master". Mirrors the
   * master/pulper sticky-flag pattern. Optional for older saves; the
   * lazy reader backfills false.
   */
  rareMasterNudgeDawnFired?: boolean;
  /**
   * One-shot sticky flag: set inside recordApplied the FIRST time the
   * lifetimeRecycledGold crosses the compost-master-sash milestone
   * (250g). The dawn-toast composer reads + clears it the next
   * morning, surfacing a celebratory "Sash earned" tail. Survives
   * reload via persistence (optional-undefined sentinel). Mirrors
   * the deep-vein / chain-tier sticky-flag dawn-brag pattern; runs
   * through the generic oneShotBrag helper.
   *
   * Two separate flags so the composer can decide "is the brag
   * pending?" (sashBragPending) without reading or mutating the
   * "already fired" state, and the morning-after compose can
   * one-shot it cleanly. Optional because older saves predate them;
   * the lazy reader fills them in on first read.
   */
  sashBragPending?: boolean;
  /**
   * Set the morning the sash brag tail fires. Stays true forever so
   * a future re-crossing (which can't happen with the monotonic
   * lifetimeRecycledGold counter, but defending against the case
   * keeps the contract clean) doesn't re-fire the brag.
   */
  sashBragFired?: boolean;
  /**
   * Symmetric one-shot for the rare-master dawn brag — set inside
   * recordApplied(player, _, rare=true) the FIRST time
   * lifetimeRareBagsApplied crosses the rare-master milestone (100).
   * Same one-shot semantics as sashBragPending. Optional for older
   * saves; the lazy reader backfills cleanly.
   */
  rareMasterBragPending?: boolean;
  /**
   * Set the morning the rare-master brag tail fires. Stays true
   * forever so a future re-crossing doesn't re-fire the brag.
   */
  rareMasterBragFired?: boolean;
}

/** Gold milestone for the `compost-master` achievement. */
export const COMPOST_MASTER_MILESTONE_GOLD = 100;

/** Lazy accessor — creates the ledger on first read. */
export function getCompostLedger(player: object): CompostLedgerState {
  const p = player as { compostLedger?: CompostLedgerState };
  if (!p.compostLedger) {
    p.compostLedger = { lifetimeRecycledGold: 0, lifetimeBagsApplied: 0 };
  }
  return p.compostLedger;
}

/**
 * Bump the lifetime ledger for a single apply. Called from
 * applyFertilizer right after the bag is consumed. Pure — doesn't
 * touch inventory or gold.
 *
 * Returns the new lifetime gold total so callers that want to surface
 * a "milestone reached" toast can check the crossover in one read.
 *
 * Additional optional `rare` arg: when true, also bumps
 * `lifetimeRareBagsApplied`. Defaults false so existing call sites
 * (and tests that hand-craft a player) stay backwards compatible —
 * the rare-master predicate ignores fixtures that don't bother.
 */
export function recordApplied(player: object, recycledGold: number, rare: boolean = false): number {
  const ledger = getCompostLedger(player);
  // Snapshot the pre-bump totals so we can detect a FRESH crossing
  // for each one-shot dawn-brag flag below. Without the snapshot a
  // player who lands exactly on the milestone could see the brag
  // re-arm on every subsequent apply.
  const wasPastSash = ledger.lifetimeRecycledGold >= COMPOST_MASTER_SASH_MILESTONE_GOLD;
  const wasPastRareMaster =
    (ledger.lifetimeRareBagsApplied ?? 0) >= RARE_MASTER_MILESTONE_BAGS;
  ledger.lifetimeBagsApplied += 1;
  ledger.lifetimeRecycledGold += recycledGold;
  if (rare) {
    ledger.lifetimeRareBagsApplied = (ledger.lifetimeRareBagsApplied ?? 0) + 1;
  }
  // Sash dawn-brag arm — fires only on the FIRST crossing of the sash
  // milestone, and only when the brag has never fired before. Survives
  // reload via persistence (optional sentinel).
  const nowPastSash = ledger.lifetimeRecycledGold >= COMPOST_MASTER_SASH_MILESTONE_GOLD;
  if (!wasPastSash && nowPastSash && !ledger.sashBragFired) {
    ledger.sashBragPending = true;
  }
  // Rare-master dawn-brag arm — symmetric, but reads off
  // lifetimeRareBagsApplied. Only bumps when the just-applied bag
  // was rare (a regular apply never moves the rare counter).
  if (rare) {
    const nowPastRareMaster =
      (ledger.lifetimeRareBagsApplied ?? 0) >= RARE_MASTER_MILESTONE_BAGS;
    if (!wasPastRareMaster && nowPastRareMaster && !ledger.rareMasterBragFired) {
      ledger.rareMasterBragPending = true;
    }
  }
  return ledger.lifetimeRecycledGold;
}

/** True iff lifetimeRecycledGold has crossed COMPOST_MASTER_MILESTONE_GOLD. */
export function compostMasterMilestoneReached(player: object): boolean {
  return getCompostLedger(player).lifetimeRecycledGold >= COMPOST_MASTER_MILESTONE_GOLD;
}

/**
 * Top-rung gold-recycling milestone for the `compost-master-sash`
 * achievement — a 3rd compost-tier honor above the compost-master
 * badge (100g). Tuned at 2.5x the original milestone so it's a clean
 * \"earned the sash, not just the badge\" honor: the player has been
 * running the compost loop for multiple seasons and the lifetime
 * recycle counter has built up meaningfully.
 *
 * Reads off the same lifetimeRecycledGold field as compost-master so
 * no new persisted counter is needed. The ledger already round-trips
 * through serializeGame.
 *
 * Why 250g and not e.g. 200g or 500g: 250g sits right between the
 * compost-master nudge floor (50g, halfway to 100g) and the pulper
 * milestone (500 bags applied, roughly 500g recycled at 1g/regular
 * bag). It's the natural \"halfway between the two badges\" honor
 * that opens the third rung in the ladderNudge ladder.
 */
export const COMPOST_MASTER_SASH_MILESTONE_GOLD = 250;

/** True iff lifetimeRecycledGold has crossed COMPOST_MASTER_SASH_MILESTONE_GOLD. */
export function compostMasterSashMilestoneReached(player: object): boolean {
  return getCompostLedger(player).lifetimeRecycledGold >= COMPOST_MASTER_SASH_MILESTONE_GOLD;
}

/**
 * Lifetime fertilizer-bag milestone for the `pulper` achievement.
 *
 * Tuned around the compost-master gold milestone (100g recycled =
 * roughly 100 regular bags or 34 rare bags). 500 bags is a deeper
 * commitment to the compost loop — a player has to have been running
 * the bench / bin / apply chain for a real chunk of the save. The
 * predicate reads lifetimeBagsApplied off the existing CompostLedgerState
 * so no new persisted field is needed; the ledger already round-trips
 * through serializeGame and lazy-backfills on older saves.
 */
export const PULPER_MILESTONE_BAGS = 500;

/** True iff lifetimeBagsApplied has crossed PULPER_MILESTONE_BAGS. */
export function pulperMilestoneReached(player: object): boolean {
  return getCompostLedger(player).lifetimeBagsApplied >= PULPER_MILESTONE_BAGS;
}

/**
 * Lifetime RARE-bag milestone for the `rare-master` achievement.
 *
 * Distinct from pulper (regular + rare combined): rare bags are
 * gated behind the per-season rare-day finishing window so the
 * player can only mint ~1 batch per season into rare. Stockpiling
 * 100 rare bags applied represents many seasons of deliberate
 * compost-day timing — a real late-game grind.
 *
 * Tuned at 100 because:
 *   - the rare-day appears once per season (RARE_FINISH_DAY range)
 *   - one compost batch can mint up to floor(COMPOST_MAX_BATCHES *
 *     CROPS_PER_BATCH / COMPOST_RATIO) bags per season-end if the
 *     player lines up timing perfectly — call it 4-8 rare bags per
 *     season at the high end
 *   - 100 rare bags = roughly 15-25 in-game seasons of optimal play
 *
 * Reads off CompostLedgerState.lifetimeRareBagsApplied which the
 * recordApplied helper bumps when called with `rare=true`. Older
 * saves lazy-backfill to 0 so the predicate stays correct on
 * existing playthroughs.
 */
export const RARE_MASTER_MILESTONE_BAGS = 100;

/** True iff lifetimeRareBagsApplied has crossed RARE_MASTER_MILESTONE_BAGS. */
export function rareMasterMilestoneReached(player: object): boolean {
  return (getCompostLedger(player).lifetimeRareBagsApplied ?? 0) >= RARE_MASTER_MILESTONE_BAGS;
}

/**
 * Halfway threshold for the compost-master nudge — once
 * lifetimeRecycledGold crosses this, the journal line gains a
 * "(Xg to the badge)" tail so the player can see the runway.
 *
 * Tuned at exactly half the milestone so the nudge feels like a
 * \"you're halfway there\" carrot, not a \"oh you're nearly there\"
 * panic. The nudge auto-disappears once the badge is earned
 * (>= COMPOST_MASTER_MILESTONE_GOLD) — at that point the journal
 * line just reads the lifetime totals without the goading tail.
 */
export const COMPOST_MASTER_NUDGE_MIN_GOLD = COMPOST_MASTER_MILESTONE_GOLD / 2;

/**
 * Halfway threshold for the compost-master-sash nudge — once
 * lifetimeRecycledGold crosses this AFTER compost-master is earned,
 * the journal line gains a "(Xg to the sash)" tail so the player can
 * see the runway to the 3rd-rung honor.
 *
 * Tuned at exactly the compost-master milestone (100g) so the sash
 * nudge starts firing the same moment the compost-master nudge ends —
 * the journal always shows at most one "to badge / to sash" tail.
 * The three-rung ladder is now:
 *
 *   recycledGold in [50, 100)     "to the badge"
 *   recycledGold in [100, 250)    "to the sash"
 *   bagsApplied in [100, 500)     "to the pulper badge"  (gated by master)
 *
 * The bag-count pulper rung runs in parallel to the gold-recycled
 * sash rung in terms of value-axis, but the priority order keeps
 * gold-recycled ahead so the player sees the next gold milestone
 * before the bag-count one.
 */
export const COMPOST_MASTER_SASH_NUDGE_MIN_GOLD = COMPOST_MASTER_MILESTONE_GOLD;

/**
 * Symmetric halfway threshold for the pulper nudge — once
 * lifetimeBagsApplied crosses this, the journal line gains a
 * "(N bags to badge)" tail. Tuned at exactly the compost-master
 * milestone so the pulper nudge starts firing the same moment the
 * compost-master nudge ends. The two nudges therefore ladder cleanly:
 * the journal always shows at most one "to badge" tail.
 */
export const PULPER_NUDGE_MIN_BAGS = COMPOST_MASTER_MILESTONE_GOLD;

/**
 * Halfway threshold for the rare-master nudge — once
 * lifetimeRareBagsApplied crosses this, the journal line gains a
 * "(N rare bags to the rare-master badge)" tail. Tuned at exactly
 * half the rare-master milestone (50 rare bags) so the nudge feels
 * like a "you're halfway there" carrot without overlapping any
 * other rung. The rare-bag axis is orthogonal to gold-recycled and
 * total-bags-applied, so this rung doesn't compete with the
 * compost-master / sash / pulper rungs for the [50, 100) window.
 *
 * Why a separate ladder rung rather than baking it into one of the
 * existing rungs: the rare-master achievement reads off a SEPARATE
 * counter (lifetimeRareBagsApplied vs lifetimeBagsApplied), and a
 * player can hit the rare-master nudge floor while their compost-
 * master/sash/pulper rungs are at very different positions on the
 * ladder. Treating it as its own rung is the simplest possible
 * shape, and it validates the ladderNudge refactor a third time
 * (sash rung last tick, this rung this tick) — the helper keeps
 * scaling without growing ternary branches in compostLedgerLine.
 */
export const RARE_MASTER_NUDGE_MIN_BAGS = RARE_MASTER_MILESTONE_BAGS / 2;

// ---------------------------------------------------------------------
// LadderNudge — generic pure helper for "halfway to badge" tails.
//
// Both compostLedgerLine and compostHalfwayDawnNudge ladder the same
// shape of nudge: an ordered list of rungs where each rung gates on
// a [floor, milestone) eligibility window and a readout function
// turns the "remaining to milestone" number into the tail text. The
// FIRST eligible rung wins (so an earlier badge always takes priority
// over a later one — the journal/dawn line never shows two competing
// tails at once).
//
// Pulling this out as a generic helper gets ahead of the same
// refactor pressure the dawn-toast composer relieved last tick: as
// soon as we add a 3rd nudge tier (the natural extension is a "you
// earned every compost badge" sash, or a third stretch goal beyond
// pulper), the alternative is a fourth and fifth ternary branch in
// each call site. Now both call sites are a 1-line walk over the
// rung array; a 3rd rung is a 4-line array push, not another ternary
// in two places.
// ---------------------------------------------------------------------

/**
 * One rung of a ladder-nudge. Eligible when `value` is in
 * `[floor, milestone)`. The `readout` function receives the remaining
 * gap (`milestone - value`) and returns the tail text. The optional
 * `prereq` predicate gates the rung on an additional condition — used
 * by the pulper rung to require the compost-master milestone first
 * (so the pulper nudge never fires before compost-master is earned).
 */
export interface LadderNudgeRung {
  /** Numeric value to compare against floor / milestone. */
  value: number;
  /** Lower bound (inclusive). Rung lights up at value >= floor. */
  floor: number;
  /** Upper bound (exclusive). Rung extinguishes at value >= milestone. */
  milestone: number;
  /** Renders the tail text given the remaining gap to milestone. */
  readout: (remaining: number) => string;
  /** Optional extra gate. When supplied, the rung is eligible only when this returns true. */
  prereq?: () => boolean;
}

/**
 * Walks `rungs` in order and returns the readout text for the FIRST
 * eligible rung — or the empty string when nothing fires. Pure
 * function; doesn't mutate state, doesn't read player. Order matters:
 * earlier rungs take priority over later ones.
 *
 * "Eligible" means: prereq passes (or is undefined), value >= floor,
 * value < milestone. The `remaining` argument to the readout is
 * always positive when the rung fires (>= 1).
 */
export function ladderNudge(rungs: ReadonlyArray<LadderNudgeRung>): string {
  for (const rung of rungs) {
    if (rung.prereq && !rung.prereq()) continue;
    if (rung.value < rung.floor) continue;
    if (rung.value >= rung.milestone) continue;
    return rung.readout(rung.milestone - rung.value);
  }
  return '';
}

/**
 * Pretty status line for the crop journal — surfaces lifetime recycled
 * gold + bags applied. Returns the empty string when the player has
 * never applied a bag so the journal doesn't surface a "0g recycled"
 * row on a fresh save.
 *
 * Wording: "compost master: 128g recycled across 47 bags."
 *
 * Halfway nudges append a single \"to badge\" tail via the generic
 * ladderNudge helper:
 *
 *   - 50g <= recycled < 100g           "compost master: 78g recycled across 28 bags. (22g to the badge)"
 *   - 100g <= recycled < 250g          "compost master: 142g recycled across 47 bags. (108g to the sash)"
 *   - 100g <= bagsApplied < 500g       "compost master: 142g recycled across 234 bags. (266 bags to the pulper badge)"
 *
 * Only one tail fires at a time — earlier rungs take priority. Once
 * the player crosses each milestone, the line goes back to a clean
 * "lifetime totals" recap.
 *
 * The 3rd rung (compost-master sash) was added on tick #29 to
 * validate the ladderNudge refactor on the spot — adding a new
 * rung is a one-line array push rather than a new ternary branch
 * in two places. Sash priority sits between master and pulper so
 * the player sees gold-recycled milestones in order before the bag
 * count nudge.
 */
export function compostLedgerLine(player: object): string {
  const ledger = getCompostLedger(player);
  if (ledger.lifetimeBagsApplied === 0) return '';
  const goldStr = ledger.lifetimeRecycledGold.toLocaleString('en-US');
  const base = `compost master: ${goldStr}g recycled across ${ledger.lifetimeBagsApplied} bag${ledger.lifetimeBagsApplied === 1 ? '' : 's'}.`;
  const tail = ladderNudge([
    {
      value: ledger.lifetimeRecycledGold,
      floor: COMPOST_MASTER_NUDGE_MIN_GOLD,
      milestone: COMPOST_MASTER_MILESTONE_GOLD,
      readout: (remaining) => `(${remaining}g to the badge)`,
    },
    {
      // Compost-master sash rung — fires AFTER the badge is earned
      // (the floor matches the badge milestone) and runs until the
      // player crosses the sash threshold. Validates the ladderNudge
      // refactor: a 3rd rung is a single array push, not another
      // pair of ternary branches across two surfaces.
      value: ledger.lifetimeRecycledGold,
      floor: COMPOST_MASTER_SASH_NUDGE_MIN_GOLD,
      milestone: COMPOST_MASTER_SASH_MILESTONE_GOLD,
      readout: (remaining) => `(${remaining}g to the sash)`,
    },
    {
      // Rare-master rung — reads the SEPARATE rare-bag counter so the
      // gating axis is orthogonal to gold-recycled. Lights up at
      // RARE_MASTER_NUDGE_MIN_BAGS=50 and runs until the badge is
      // earned at RARE_MASTER_MILESTONE_BAGS=100. No prereq — a
      // player who pulled off 50 rare bags before crossing the
      // sash/master gold threshold still gets the nudge (the rare
      // axis is its own grind). Slotted BEFORE the pulper rung so
      // a player past the sash + halfway-rare sees the rare nudge
      // first (rare bags are gated behind the per-season rare-day
      // window so they're the harder grind to advertise).
      value: ledger.lifetimeRareBagsApplied ?? 0,
      floor: RARE_MASTER_NUDGE_MIN_BAGS,
      milestone: RARE_MASTER_MILESTONE_BAGS,
      readout: (remaining) =>
        `(${remaining} rare bag${remaining === 1 ? '' : 's'} to the rare-master badge)`,
    },
    {
      value: ledger.lifetimeBagsApplied,
      floor: PULPER_NUDGE_MIN_BAGS,
      milestone: PULPER_MILESTONE_BAGS,
      // Pulper-tier prereq: compost-master must already be earned so
      // the two journal tails are mutually exclusive in the same
      // sense the dawn-nudge ladder is.
      prereq: () => ledger.lifetimeRecycledGold >= COMPOST_MASTER_MILESTONE_GOLD,
      readout: (remaining) => `(${remaining} bag${remaining === 1 ? '' : 's'} to the pulper badge)`,
    },
  ]);
  return tail ? `${base} ${tail}` : base;
}

// ---------------------------------------------------------------------
// Compost-master / pulper halfway dawn nudges — one-shot dawn-toast
// tails that fire the morning AFTER the player crosses the nudge
// floor for each badge. The journal line in compostLedgerLine already
// surfaces "to the badge" / "to the pulper badge" tails passively, but
// a player who never opens the journal would never see them — these
// dawn helpers carry the signal directly into the morning toast chain.
//
// Each nudge is ONE-SHOT: the dawn helper bumps a boolean flag on the
// ledger so a player who skips a few days of mining doesn't keep
// getting the same nag every morning. The flag is sticky; once fired
// it stays fired across reloads via the lazy ledger persistence.
// ---------------------------------------------------------------------

/**
 * Returns the dawn-toast tail to surface today, if any. ONE-SHOT
 * per nudge — bumps the corresponding fired flag on the ledger as
 * a side effect so a re-call returns the empty string. Callers
 * should fire this exactly once per dawn (the engine's day rollover
 * is the natural site).
 *
 * Wording:
 *   compost-master:  "Halfway to Compost Master - Xg to go."
 *   pulper:          "Halfway to Pulper - N bags to go."
 *
 * Priority: compost-master fires before pulper if both are eligible
 * at once (impossible in practice — the ledger crosses the master
 * milestone first by construction), so the player always sees the
 * earlier badge runway first.
 *
 * Implementation rides the generic ladderNudge helper for the
 * eligibility check, then layers the one-shot side-effect on top so
 * the rung that fires also stamps its corresponding `*NudgeDawnFired`
 * flag. Adding a third nudge here is a single push into the array
 * + a flag init in persistence + one extra readout — no new ternary
 * chain to grow in both compost-journal and engine-dawn surfaces.
 */
export function compostHalfwayDawnNudge(player: object): string {
  const ledger = getCompostLedger(player);
  // Build the rung set with prereq gates that ALSO check the
  // one-shot fired flag — once a rung fires, prereq turns false on
  // subsequent calls so the same rung never re-emits.
  const masterNudge: LadderNudgeRung = {
    value: ledger.lifetimeRecycledGold,
    floor: COMPOST_MASTER_NUDGE_MIN_GOLD,
    milestone: COMPOST_MASTER_MILESTONE_GOLD,
    prereq: () => !ledger.masterNudgeDawnFired,
    readout: (remaining) => `Halfway to Compost Master - ${remaining}g to go.`,
  };
  const rareMasterNudge: LadderNudgeRung = {
    // Rare-master dawn nudge — orthogonal to the gold rungs, reads
    // off the SEPARATE rare-bag counter. Sticky one-shot via the
    // rareMasterNudgeDawnFired flag, same shape as the gold-rung
    // nudges. Prereq + fired-flag gate keeps the nudge from
    // re-emitting after the first dawn it fires.
    value: ledger.lifetimeRareBagsApplied ?? 0,
    floor: RARE_MASTER_NUDGE_MIN_BAGS,
    milestone: RARE_MASTER_MILESTONE_BAGS,
    prereq: () => !ledger.rareMasterNudgeDawnFired,
    readout: (remaining) =>
      `Halfway to Rare Master - ${remaining} rare bag${remaining === 1 ? '' : 's'} to go.`,
  };
  const pulperNudge: LadderNudgeRung = {
    value: ledger.lifetimeBagsApplied,
    floor: PULPER_NUDGE_MIN_BAGS,
    milestone: PULPER_MILESTONE_BAGS,
    prereq: () =>
      !ledger.pulperNudgeDawnFired &&
      ledger.lifetimeRecycledGold >= COMPOST_MASTER_MILESTONE_GOLD,
    readout: (remaining) =>
      `Halfway to Pulper - ${remaining} bag${remaining === 1 ? '' : 's'} to go.`,
  };
  // Single walk picks the first eligible rung — but we also need to
  // know WHICH rung fired so we can stamp the matching one-shot flag.
  // ladderNudge returns the readout text only, so we walk the rungs
  // ourselves here using the same predicate semantics.
  const rungs: Array<{ rung: LadderNudgeRung; onFire: () => void }> = [
    { rung: masterNudge, onFire: () => { ledger.masterNudgeDawnFired = true; } },
    // Rare-master rung sits between master and pulper so it fires
    // before pulper when both eligible — matches the journal-line
    // priority. Slotted AFTER master because the master nudge is the
    // earlier badge in the player's progression.
    { rung: rareMasterNudge, onFire: () => { ledger.rareMasterNudgeDawnFired = true; } },
    { rung: pulperNudge, onFire: () => { ledger.pulperNudgeDawnFired = true; } },
  ];
  for (const { rung, onFire } of rungs) {
    if (rung.prereq && !rung.prereq()) continue;
    if (rung.value < rung.floor) continue;
    if (rung.value >= rung.milestone) continue;
    onFire();
    return rung.readout(rung.milestone - rung.value);
  }
  return '';
}

// ---------------------------------------------------------------------
// Compost-master-sash dawn brag — one-shot celebratory dawn-toast tail
// the morning AFTER lifetimeRecycledGold crosses the sash milestone
// (250g) for the first time. Mirrors the deep-vein / chain-tier
// sticky-flag pattern and rides the generic oneShotBrag helper so the
// pending/fired bookkeeping is shared across every "you just earned X"
// dawn tail in tree.
//
// Why a separate tail rather than relying on the generic "Achievement
// unlocked" toast that already fires on every newly-earned badge: the
// generic toast names only the achievement id ("Achievement unlocked:
// compost-master-sash") which reads as a system message; the dedicated
// dawn-brag wording carries the warmth of a recap ("you've recycled
// 252g now — the sash is yours") that lands as a celebration rather
// than a notification.
// ---------------------------------------------------------------------

/**
 * Returns the compost-master-sash dawn-brag tail, or the empty string
 * if there's no fresh sash crossing to celebrate. ONE-SHOT — bumps
 * `sashBragFired` on the ledger as a side effect, so a re-call
 * returns empty. Survives reload via persistence.
 *
 * Wording: "Compost Sash earned - Xg recycled across N bags."
 *
 * Reads the LIVE lifetimeRecycledGold / lifetimeBagsApplied off the
 * ledger so the brag names the current totals at brag-fire time, not
 * the totals at the moment of crossing. This is deliberate: if a
 * player crosses the sash on day 5 with 251g, applies one more bag
 * before sleep that pushes to 252g, then sleeps and reads the brag
 * on day 6, the brag should read "252g" because that's the player's
 * current state. The crossing-moment totals are an implementation
 * detail; the player only cares about "what does it say now".
 */
export function compostMasterSashDawnBrag(player: object): string {
  const ledger = getCompostLedger(player);
  return oneShotBrag(
    ledger as unknown as Record<string, unknown>,
    'sashBragPending',
    'sashBragFired',
    () => {
      const goldStr = ledger.lifetimeRecycledGold.toLocaleString('en-US');
      const bags = ledger.lifetimeBagsApplied;
      return `Compost Sash earned - ${goldStr}g recycled across ${bags} bag${bags === 1 ? '' : 's'}.`;
    },
  );
}

/**
 * Returns the rare-master dawn-brag tail, or the empty string if
 * there's no fresh rare-master crossing to celebrate. ONE-SHOT —
 * bumps `rareMasterBragFired` on the ledger as a side effect, so a
 * re-call returns empty. Survives reload via persistence.
 *
 * Wording: "Rare Master earned - N rare bags applied across the seasons."
 *
 * Reads the LIVE lifetimeRareBagsApplied off the ledger (same as
 * sash brag rationale).
 */
export function rareMasterDawnBrag(player: object): string {
  const ledger = getCompostLedger(player);
  return oneShotBrag(
    ledger as unknown as Record<string, unknown>,
    'rareMasterBragPending',
    'rareMasterBragFired',
    () => {
      const rare = ledger.lifetimeRareBagsApplied ?? 0;
      return `Rare Master earned - ${rare} rare bag${rare === 1 ? '' : 's'} applied across the seasons.`;
    },
  );
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
 * Draws a small wooden compost bin centered at (cx, cy). Lid + slats
 * for the woodwork; a brown-green compost layer peeks above the top
 * when batches are inside. A small grass-green sprig pokes out when a
 * bag is ready, otherwise the lid sits closed.
 */
export function drawCompostSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  bin: PlacedCompost,
  today: number,
  tileSize: number,
): void {
  const w = tileSize;
  const h = tileSize;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 3, y + h - 3, w - 6, 3);
  // Bin body — dark wood with horizontal slats.
  px(ctx, x + 3, y + h * 0.35, w - 6, h * 0.55, '#6E4A28');
  for (let i = 0; i < 3; i++) {
    px(ctx, x + 3, y + h * 0.45 + i * 4, w - 6, 1, '#3A2818');
  }
  // Side posts.
  px(ctx, x + 3, y + h * 0.35, 2, h * 0.55, '#8A6B44');
  px(ctx, x + w - 5, y + h * 0.35, 2, h * 0.55, '#8A6B44');
  // Compost layer peeks above the lid only when batches are inside.
  if (bin.batches.length > 0) {
    px(ctx, x + 4, y + h * 0.32, w - 8, 3, '#5A6A28');
    // Sprig if a bag is ready.
    const ready = bin.batches.some((b) => b.finishOnDay < today);
    if (ready) {
      px(ctx, x + w / 2, y + h * 0.26, 1, 4, '#A8C04A');
      px(ctx, x + w / 2 - 1, y + h * 0.26, 1, 1, '#A8C04A');
      px(ctx, x + w / 2 + 1, y + h * 0.26, 1, 1, '#A8C04A');
    }
  }
  // Lid lip.
  px(ctx, x + 2, y + h * 0.34, w - 4, 2, '#3A2818');
}
