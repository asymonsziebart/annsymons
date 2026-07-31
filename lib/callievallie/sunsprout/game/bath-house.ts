// Bath house — late-game village fixture that boosts max stamina for a
// few in-game days in exchange for gold.
//
// The bath house sits a few tiles east of the cave outcrop / north-east
// of the village square. Pressing E adjacent to it spends BATH_FEE gold
// and bumps the player's stamina pool MAX up by BATH_BONUS for the next
// BATH_DURATION_DAYS days. After the buff expires the max returns to
// MAX_STAMINA so a save loaded mid-buff doesn't lock the bonus in.
//
// Winter discount: in Winter (season index 3) the soak costs 25% less
// (BATH_FEE * BATH_WINTER_DISCOUNT). The cozy-life intent is to nudge
// the player toward visiting the bath house exactly when the farm is
// quietest — outdoor crops are frozen, gold pressure is low, and a
// warm soak feels appropriate.
//
// Design intent: a gentle late-game money sink. Once the player is
// pulling 1000g+ a day from the well it's natural to spend 200g on a
// soak — and the +30 stamina for a few days lets a long mining run or
// a big till day breathe. Stacking is a no-op: a second visit refreshes
// the timer at full BATH_DURATION_DAYS rather than compounding the cap.
//
// Pure module: no IO, no canvas. The Game places the bath house in
// render(), wires the E-press near it, and ticks expiry at dawn.

import type { Player } from '../world/world';
import type { StaminaState } from './stamina';
import type { TimeOfDay } from './time';
import { getStamina, MAX_STAMINA } from './stamina';

/** Tile-space coordinates of the bath house. Sits NE of the plaza. */
export const BATH_X = 30;
export const BATH_Y = 7;
/** Chebyshev approach radius. */
export const BATH_INTERACT_RADIUS = 1;

/** Gold cost of one soak. */
export const BATH_FEE = 200;
/** Multiplier on BATH_FEE during Winter. 0.75 = 25% off. */
export const BATH_WINTER_DISCOUNT = 0.75;
/** Season index that triggers the winter discount. */
export const BATH_WINTER_SEASON = 3;
/** Extra stamina cap granted while the buff is active. */
export const BATH_BONUS = 30;
/** How many in-game days the buff lasts AFTER the dawn it was bought. */
export const BATH_DURATION_DAYS = 3;

/** Inventory key for an unredeemed spa pass (sold at Pip's cart). */
export const SPA_PASS_INVENTORY_KEY = 'spa-pass';

/** Gold cost of a spa pass at Pip's cart. */
export const SPA_PASS_PRICE = 700;

/** Number of free soaks one spa pass carries. */
export const SPA_PASS_PUNCHES = 4;

/**
 * Discounted price for a refill purchased at Pip's cart AFTER the
 * player has already redeemed at least one full spa pass. The full
 * SPA_PASS_PRICE pays for the loyalty card + 4 punches; a refill is
 * just punches, so it costs significantly less.
 *
 * Tuned at 500g (vs the 700g full price) so the cumulative cost of
 * a refill loop sits at 125g/soak — meaningful savings over the
 * 200g cash price and the 175g amortised first-pass price, but not
 * so cheap it trivialises the bath-house economy.
 */
export const SPA_PASS_REFILL_PRICE = 500;

/** Per-player spa-pass bookkeeping. */
export interface SpaPassState {
  /** Total free soaks remaining across all redeemed passes. */
  punchesLeft: number;
}

/** Lazy reader on the Player. */
export function getSpaPass(player: Player): SpaPassState {
  const p = player as Player & { spaPass?: SpaPassState };
  if (!p.spaPass) p.spaPass = { punchesLeft: 0 };
  return p.spaPass;
}

/** True iff the player has at least one free soak remaining. */
export function hasSpaPass(player: Player): boolean {
  return getSpaPass(player).punchesLeft > 0;
}

/**
 * Redeem one spa pass from the bag into the punches pool. Returns the
 * total punches left after the redemption, or 0 when there was no pass
 * to redeem. Auto-called by takeBath() when the player presses E with
 * an unredeemed pass — keeps the cart-only purchase flow self-driving.
 */
export function redeemSpaPass(player: Player): number {
  const have = player.inventory[SPA_PASS_INVENTORY_KEY] ?? 0;
  if (have <= 0) return getSpaPass(player).punchesLeft;
  player.inventory[SPA_PASS_INVENTORY_KEY] = have - 1;
  const state = getSpaPass(player);
  state.punchesLeft += SPA_PASS_PUNCHES;
  return state.punchesLeft;
}

/** Inventory key for the bath house's loyalty cosmetic. Quantity counts gifted soaps. */
export const PERFUMED_SOAP_INVENTORY_KEY = 'perfumed-soap';

/** How many soaks earn one Perfumed Soap. */
export const SOAP_PER_SOAKS = 10;

/**
 * Inventory key prefix for the seasonal-towel cosmetic. Per-season
 * suffixes ('spring' / 'summer' / 'fall' / 'winter') keep the four
 * towels disjoint so the player can collect every one in a year.
 *
 * The towel is gifted when the player's PER-SEASON soak count crosses
 * SEASONAL_TOWEL_SOAKS in the current season. Once gifted for a
 * (season) the bath house won't re-gift the same one — the player has
 * to wait until next year's same season to chase it.
 */
export const SEASONAL_TOWEL_INVENTORY_PREFIX = 'towel-';

/** Season-index to short name used for the towel inventory key + label. */
export const SEASON_KEYS = ['spring', 'summer', 'fall', 'winter'] as const;
export type SeasonKey = (typeof SEASON_KEYS)[number];

/** Inventory key for a specific season's towel. */
export function seasonalTowelKey(season: 0 | 1 | 2 | 3): string {
  return `${SEASONAL_TOWEL_INVENTORY_PREFIX}${SEASON_KEYS[season]}`;
}

/** Pretty label for the towel toast. */
export function seasonalTowelLabel(season: 0 | 1 | 2 | 3): string {
  const name = SEASON_KEYS[season];
  return `${name[0].toUpperCase()}${name.slice(1)} Towel`;
}

/** How many soaks IN A SINGLE SEASON earn the seasonal towel cosmetic. */
export const SEASONAL_TOWEL_SOAKS = 5;

/** Per-player bath-house bookkeeping. */
export interface BathState {
  /** Day index the buff EXPIRES on (>= today means buff is active). */
  expiresOnDay: number;
  /**
   * Lifetime count of soaks taken at the bath house. Counts BOTH
   * gold-paid and spa-pass-paid soaks. Drives the loyalty cosmetic:
   * every SOAP_PER_SOAKS soaks gifts one Perfumed Soap into the bag.
   */
  totalSoaks?: number;
  /**
   * Lifetime count of Perfumed Soaps that the loyalty tier has gifted
   * the player. Used to avoid double-gifting on a reload that pushed
   * `totalSoaks` forward via persistence.
   */
  soapsGifted?: number;
  /**
   * Per-season soak counter, keyed by `${year}-${season}` so a soak in
   * Spring of year 1 and Spring of year 2 each count toward their own
   * SEASONAL_TOWEL_SOAKS milestone. The bath house's calendar doesn't
   * carry a year — we use the engine's `time.day` modulo bookkeeping
   * via the same `${season}` key plus a `seasonalTowelGifted` set so
   * the milestone only fires once per "stretch".
   */
  seasonalSoaks?: Partial<Record<SeasonKey, number>>;
  /**
   * Set of season keys for which the seasonal towel has been gifted
   * THIS run. Once a key appears here the bath house won't re-gift
   * the same towel until the player clears the gift (e.g. via a
   * future "trade in" path) — for now this means one towel per save.
   */
  seasonalTowelsGifted?: Partial<Record<SeasonKey, boolean>>;
}

/** Lazy reader on the Player. */
export function getBath(player: Player): BathState {
  const p = player as Player & { bath?: BathState };
  if (!p.bath) p.bath = { expiresOnDay: -1 };
  return p.bath;
}

/** True iff (px,py) is within Chebyshev BATH_INTERACT_RADIUS of the bath house. */
export function nearBath(px: number, py: number): boolean {
  return (
    Math.abs(px - BATH_X) <= BATH_INTERACT_RADIUS &&
    Math.abs(py - BATH_Y) <= BATH_INTERACT_RADIUS
  );
}

/** True if the player still has bath buff active on `day`. */
export function bathActive(player: Player, day: number): boolean {
  return getBath(player).expiresOnDay >= day;
}

/** Days until the buff expires on `day`; -1 when no buff. */
export function bathDaysLeft(player: Player, day: number): number {
  const exp = getBath(player).expiresOnDay;
  if (exp < day) return -1;
  return exp - day + 1;
}

/**
 * Returns the actual cost of one soak right now. Applies the Winter
 * discount when `time.season === BATH_WINTER_SEASON`, otherwise the
 * base fee. Floor the result so the gold deduction stays an integer.
 */
export function bathPriceFor(time: TimeOfDay): number {
  if (time.season === BATH_WINTER_SEASON) {
    return Math.floor(BATH_FEE * BATH_WINTER_DISCOUNT);
  }
  return BATH_FEE;
}

/** True when the player would currently get the Winter price. */
export function isWinterDiscountActive(time: TimeOfDay): boolean {
  return time.season === BATH_WINTER_SEASON;
}

/** Outcome of an attempted soak. */
export type BathOutcome =
  | {
      kind: 'soaked';
      remainingGold: number;
      daysLeft: number;
      bonus: number;
      pricePaid: number;
      discounted: boolean;
      paidWithPass: boolean;
      passesLeft: number;
      /** Lifetime soak count AFTER this soak. */
      totalSoaks: number;
      /** New Perfumed Soaps gifted this soak (0 or 1). */
      soapsEarned: number;
      /** Per-season soak count AFTER this soak (drives the towel toast). */
      seasonalSoaks: number;
      /** True iff this soak crossed the SEASONAL_TOWEL_SOAKS milestone for the current season. */
      towelEarned: boolean;
      /** Inventory key of the towel gifted this soak (empty when none). */
      towelKey: string;
      /** Pretty label of the towel gifted this soak (empty when none). */
      towelLabel: string;
    }
  | { kind: 'too-far' }
  | { kind: 'not-enough-gold'; need: number; have: number }
  | { kind: 'already-active'; daysLeft: number };

/**
 * Try to take a soak. Spends `bathPriceFor(time)` gold OR one spa-pass
 * punch (preferring the pass when one is available), refreshes the
 * buff timer to BATH_DURATION_DAYS, lifts the stamina cap by
 * BATH_BONUS, and tops the current pool by the same amount (so the
 * player feels the boost immediately rather than waiting for
 * tomorrow's dawn refill).
 *
 * Auto-redeems an unredeemed spa pass from the bag if punches are 0 —
 * the player can buy + soak without a separate "redeem" press.
 *
 * Refuses with 'already-active' when the buff is already running —
 * keeps the player from accidentally double-spending on the same day.
 *
 * If no `time` is provided the price defaults to BATH_FEE (preserves
 * the existing test contracts).
 */
export function takeBath(
  player: Player,
  px: number,
  py: number,
  day: number,
  time?: TimeOfDay,
): BathOutcome {
  if (!nearBath(px, py)) return { kind: 'too-far' };
  if (bathActive(player, day)) {
    return { kind: 'already-active', daysLeft: bathDaysLeft(player, day) };
  }
  const price = time ? bathPriceFor(time) : BATH_FEE;
  // Auto-redeem an unredeemed spa pass into the punches pool first so
  // the player never accidentally pays gold while a pass sits unused.
  const passState = getSpaPass(player);
  if (passState.punchesLeft <= 0 && (player.inventory[SPA_PASS_INVENTORY_KEY] ?? 0) > 0) {
    redeemSpaPass(player);
  }
  const useSpaPass = passState.punchesLeft > 0;
  if (!useSpaPass && player.gold < price) {
    return { kind: 'not-enough-gold', need: price, have: player.gold };
  }
  let pricePaid: number;
  if (useSpaPass) {
    passState.punchesLeft -= 1;
    pricePaid = 0;
  } else {
    player.gold -= price;
    pricePaid = price;
  }
  // Apply the buff. Expiry sits on (today + duration - 1) so the soak
  // covers today AND the next (duration-1) days. Lift the cap, then
  // top the pool by the same amount so the player feels it now.
  const state = getBath(player);
  state.expiresOnDay = day + BATH_DURATION_DAYS - 1;
  // Loyalty bookkeeping — bump lifetime soaks, gift Perfumed Soap on
  // every SOAP_PER_SOAKS milestone the player hasn't already crossed.
  state.totalSoaks = (state.totalSoaks ?? 0) + 1;
  const expectedSoaps = Math.floor(state.totalSoaks / SOAP_PER_SOAKS);
  const alreadyGifted = state.soapsGifted ?? 0;
  let soapsEarned = 0;
  if (expectedSoaps > alreadyGifted) {
    soapsEarned = expectedSoaps - alreadyGifted;
    state.soapsGifted = expectedSoaps;
    player.inventory[PERFUMED_SOAP_INVENTORY_KEY] =
      (player.inventory[PERFUMED_SOAP_INVENTORY_KEY] ?? 0) + soapsEarned;
  }
  // Seasonal-towel bookkeeping — increment the per-season soak count
  // and gift the matching towel the moment we cross
  // SEASONAL_TOWEL_SOAKS. One towel per (save, season): we use a
  // seasonalTowelsGifted map so a reload mid-season doesn't double-gift,
  // and so a player who already earned Spring's towel doesn't get a
  // second one if they keep soaking through Spring.
  const seasonKey = time ? SEASON_KEYS[time.season] : null;
  let seasonalCount = 0;
  let towelEarned = false;
  let towelKey = '';
  let towelLabel = '';
  if (seasonKey && time) {
    if (!state.seasonalSoaks) state.seasonalSoaks = {};
    seasonalCount = (state.seasonalSoaks[seasonKey] ?? 0) + 1;
    state.seasonalSoaks[seasonKey] = seasonalCount;
    if (!state.seasonalTowelsGifted) state.seasonalTowelsGifted = {};
    const alreadyEarned = state.seasonalTowelsGifted[seasonKey] === true;
    if (!alreadyEarned && seasonalCount >= SEASONAL_TOWEL_SOAKS) {
      state.seasonalTowelsGifted[seasonKey] = true;
      towelEarned = true;
      towelKey = seasonalTowelKey(time.season);
      towelLabel = seasonalTowelLabel(time.season);
      player.inventory[towelKey] = (player.inventory[towelKey] ?? 0) + 1;
    }
  }
  const s = getStamina(player);
  s.max = MAX_STAMINA + BATH_BONUS;
  s.current = Math.min(s.max, s.current + BATH_BONUS);
  return {
    kind: 'soaked',
    remainingGold: player.gold,
    daysLeft: BATH_DURATION_DAYS,
    bonus: BATH_BONUS,
    pricePaid,
    discounted: time ? isWinterDiscountActive(time) : false,
    paidWithPass: useSpaPass,
    passesLeft: passState.punchesLeft,
    totalSoaks: state.totalSoaks,
    soapsEarned,
    seasonalSoaks: seasonalCount,
    towelEarned,
    towelKey,
    towelLabel,
  };
}

/**
 * Day-rollover hook: if the buff has lapsed, drop the stamina cap back
 * to the base MAX_STAMINA. Returns true when the expiry fired this
 * call. The current pool stays as-is (caller's dawn refill will top it
 * back up to the new max anyway).
 */
export function maybeExpireBath(player: Player, day: number): boolean {
  const state = getBath(player);
  if (state.expiresOnDay < 0) return false;
  if (state.expiresOnDay >= day) return false;
  // Buff has expired. Reset the stamina cap to base.
  state.expiresOnDay = -1;
  const s: StaminaState = getStamina(player);
  s.max = MAX_STAMINA;
  if (s.current > s.max) s.current = s.max;
  return true;
}

/** Short HUD line for the toast surfaced after a fresh soak. */
export function bathFlavorLine(out: Extract<BathOutcome, { kind: 'soaked' }>): string {
  const plural = out.daysLeft === 1 ? '' : 's';
  const loyaltyTail = out.soapsEarned > 0
    ? ` Bath house gifts you a Perfumed Soap for ${out.totalSoaks} lifetime soaks.`
    : '';
  // Seasonal-towel tail — fires the soak that crosses
  // SEASONAL_TOWEL_SOAKS for the current season. Wording calls out the
  // season directly so the player understands the loop ("oh, the Fall
  // one is a different towel, I want to chase that").
  const towelTail = out.towelEarned
    ? ` The bath house slides a ${out.towelLabel} across the counter — ${out.seasonalSoaks} soaks this season.`
    : '';
  if (out.paidWithPass) {
    return `Soaked at the bath house (spa pass, ${out.passesLeft} punch${out.passesLeft === 1 ? '' : 'es'} left). +${out.bonus} stamina cap for ${out.daysLeft} day${plural}.${loyaltyTail}${towelTail}`;
  }
  const winterTag = out.discounted ? ' (winter rate)' : '';
  return `Soaked at the bath house${winterTag}. +${out.bonus} stamina cap for ${out.daysLeft} day${plural}.${loyaltyTail}${towelTail}`;
}

/** Pretty progress line for HUD inspection at the bath house entrance. */
export function bathLoyaltyLine(player: Player): string {
  const state = getBath(player);
  const soaks = state.totalSoaks ?? 0;
  const toNext = SOAP_PER_SOAKS - (soaks % SOAP_PER_SOAKS);
  const soaps = state.soapsGifted ?? 0;
  return `Bath house log: ${soaks} soak${soaks === 1 ? '' : 's'}, ${soaps} Perfumed Soap${soaps === 1 ? '' : 's'} earned. ${toNext} until the next one.`;
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
 * Draw a small bath house sprite centered at (cx, cy). A chunky wooden
 * frame with a low tiled roof and a wisp of steam rising from the
 * chimney. Steam is rendered as a soft three-puff plume so the
 * fixture reads as warm even in the snowiest Winter render pass.
 */
export function drawBathHouseSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tileSize: number,
): void {
  const w = tileSize;
  const h = tileSize;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 2, y + h - 2, w - 4, 3);
  // Wall (warm cedar).
  px(ctx, x + 2, y + h * 0.35, w - 4, h * 0.65, '#A87858');
  // Wall shadow stripe.
  px(ctx, x + 2, y + h - 4, w - 4, 3, '#6E4A30');
  // Roof — low pyramidal slate.
  const roofH = Math.floor(h * 0.45);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const inset = Math.floor(t * (w / 2 - 3));
    const stripY = y + h * 0.35 - i * Math.ceil(roofH / 4);
    px(
      ctx,
      x + inset,
      stripY,
      w - inset * 2,
      Math.ceil(roofH / 4),
      i === 3 ? '#3A2D44' : '#5C4870',
    );
  }
  // Door — dark slat with a brass handle.
  px(ctx, x + w / 2 - 3, y + h - 11, 6, 9, '#3A2010');
  px(ctx, x + w / 2 - 4, y + h - 11, 8, 1, '#5C3818');
  px(ctx, x + w / 2 + 2, y + h - 6, 1, 2, '#F0C24A');
  // Two warm-glow windows.
  px(ctx, x + 4, y + h * 0.6, 4, 4, '#FFE4A0');
  px(ctx, x + w - 8, y + h * 0.6, 4, 4, '#FFE4A0');
  // Chimney + steam.
  px(ctx, x + w - 7, y + h * 0.1, 3, 6, '#3A2A22');
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(x + w - 5, y + h * 0.05, 2, 0, Math.PI * 2);
  ctx.arc(x + w - 2, y + h * 0.0 - 2, 2.4, 0, Math.PI * 2);
  ctx.arc(x + w - 7, y + h * 0.0 - 3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // Tiny sign hung on the wall — single character glyph (no emoji).
  ctx.font = 'bold 7px ui-monospace, monospace';
  ctx.fillStyle = '#F5E9D4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BATH', x + w / 2, y + h * 0.42);
}
