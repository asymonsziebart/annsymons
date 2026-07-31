// NPC scheduled events — heart-4 hangouts.
//
// Once the player reaches ♥4+ with a candidate, the candidate posts an
// invite for a specific in-game evening. The invite carries:
//
//   - npcId        : whose invite
//   - season, day  : when (a 2..6 day delay from posting day)
//   - hour window  : a 2-hour evening window (e.g. 18..20)
//   - x, y         : the meeting tile
//   - flavour      : the dialogue line shown when you arrive
//
// On the matching day, walking within Chebyshev radius 2 of (x,y)
// during the window fires the meet:
//
//   - +1 heart's worth of points
//   - +120g tip from the candidate
//   - special dialogue line
//   - invite consumed
//
// If the player misses the window (day rolls past), the invite quietly
// expires (no penalty — cozy genre forgives). One active invite per
// NPC at a time so the player isn't drowning in clutter.
//
// Pure module. Persistence + UI integration follow the standard pattern.

import type { Player } from '../world/world';
import type { TimeOfDay } from './time';
import { CANDIDATES, getHearts, HEART_POINTS } from './hearts';

/** Where each NPC likes to meet for the heart-4 hangout. */
export const HANGOUT_SPOTS: Record<string, { x: number; y: number; flavor: string }> = {
  mayor: {
    x: 19,
    y: 7,
    flavor: 'Mayor Bramble waits by the well, hands clasped behind his back.',
  },
  maple: {
    x: 24,
    y: 9,
    flavor: 'Vallie smiles when she sees you and pulls a small cloth bundle from her apron.',
  },
  finn: {
    x: 7,
    y: 21,
    flavor: 'Finn is already at the pond, line in the water, an extra rod beside him.',
  },
  rose: {
    x: 15,
    y: 9,
    flavor: 'Callie has saved you the warm chair by the inn fire and a cup of cocoa.',
  },
};

/** Hours the evening hangout runs (24h clock). 18..20 = 6PM-8PM. */
export const HANGOUT_HOUR_START = 18;
export const HANGOUT_HOUR_END = 20;

/** Reward when the player shows up in the window. */
export const HANGOUT_GOLD_TIP = 120;
export const HANGOUT_POINTS = HEART_POINTS; // one heart's worth

/** Chebyshev radius the player must be within. */
export const HANGOUT_RADIUS = 2;

/** Threshold heart count to start posting invites. */
export const HANGOUT_HEART_THRESHOLD = 4;

/** One pending invite. */
export interface NPCInvite {
  npcId: string;
  /** Season (0..3) the hangout fires. */
  season: 0 | 1 | 2 | 3;
  /** Day (1..7) of that season. */
  day: number;
  /** Tile coordinates of the meeting spot. */
  x: number;
  y: number;
  /** Flavour line shown on arrival. */
  flavor: string;
  /** Day the invite was posted (used for the mail-style notification). */
  postedDay: number;
}

/** Player extension for the invite queue. */
export interface PlayerWithInvites {
  npcInvites?: NPCInvite[];
  /** Per-NPC season+day key of the LAST fired hangout — gates re-posting. */
  lastHangoutDay?: Record<string, number>;
}

/** Lazy reader — initialise empty arrays so callers don't have to null-check. */
export function getInvites(player: Player): NPCInvite[] {
  const p = player as Player & PlayerWithInvites;
  if (!p.npcInvites) p.npcInvites = [];
  return p.npcInvites;
}

/** Lazy reader for the per-NPC cooldown map. */
export function getLastHangoutDay(player: Player): Record<string, number> {
  const p = player as Player & PlayerWithInvites;
  if (!p.lastHangoutDay) p.lastHangoutDay = {};
  return p.lastHangoutDay;
}

/** Returns true if the player already has an open invite from this NPC. */
export function hasInviteFrom(player: Player, npcId: string): boolean {
  return getInvites(player).some((iv) => iv.npcId === npcId);
}

/**
 * Try to post a new invite from `npcId` to the player. Posts iff:
 *   - hearts >= HANGOUT_HEART_THRESHOLD
 *   - no existing open invite from this NPC
 *   - cooldown elapsed (one hangout per NPC per in-game season)
 *
 * The new invite picks a date 2..6 days after `today`. Returns the
 * posted invite or null when the gate failed.
 */
export function maybePostInvite(
  player: Player,
  npcId: string,
  today: TimeOfDay,
): NPCInvite | null {
  if (!CANDIDATES[npcId]) return null;
  if (!player.hearts) return null;
  if (getHearts(player.hearts, npcId) < HANGOUT_HEART_THRESHOLD) return null;
  if (hasInviteFrom(player, npcId)) return null;
  const lastDay = getLastHangoutDay(player)[npcId];
  if (lastDay !== undefined && today.day - lastDay < 7 && lastDay !== -1) {
    // One hangout per 7-day stretch (a season's length).
    return null;
  }
  const spot = HANGOUT_SPOTS[npcId];
  if (!spot) return null;
  // Pick 2..6 day delay, deterministic from (npcId, today.day).
  const delay = 2 + (hash(npcId, today.day) % 5);
  let day = today.day + delay;
  let season: 0 | 1 | 2 | 3 = today.season;
  while (day > 7) {
    day -= 7;
    season = (((season + 1) % 4) as 0 | 1 | 2 | 3);
  }
  const invite: NPCInvite = {
    npcId,
    season,
    day,
    x: spot.x,
    y: spot.y,
    flavor: spot.flavor,
    postedDay: today.day,
  };
  getInvites(player).push(invite);
  return invite;
}

/**
 * Day-rollover hook — sweeps every candidate and tries to post one new
 * invite per call. Returns the list of newly-posted invites.
 */
export function rollDailyInvites(player: Player, today: TimeOfDay): NPCInvite[] {
  const posted: NPCInvite[] = [];
  for (const npcId of Object.keys(CANDIDATES)) {
    const inv = maybePostInvite(player, npcId, today);
    if (inv) posted.push(inv);
  }
  return posted;
}

/**
 * Returns the open invite whose window is active RIGHT NOW (matching
 * (season, day) and inside the hour window) AND where the player is
 * close enough to the meeting spot. Null otherwise.
 */
export function activeInviteAtPlayer(
  player: Player,
  px: number,
  py: number,
  time: TimeOfDay,
): NPCInvite | null {
  if (time.hour < HANGOUT_HOUR_START || time.hour >= HANGOUT_HOUR_END) return null;
  for (const iv of getInvites(player)) {
    if (iv.season !== time.season) continue;
    if (iv.day !== time.day) continue;
    if (Math.abs(px - iv.x) > HANGOUT_RADIUS) continue;
    if (Math.abs(py - iv.y) > HANGOUT_RADIUS) continue;
    return iv;
  }
  return null;
}

/** Outcome of resolving a hangout. */
export type HangoutOutcome =
  | { kind: 'fired'; invite: NPCInvite; heartsAfter: number }
  | { kind: 'none' };

/**
 * Resolve a hangout — applies the gold tip + heart points, removes the
 * invite, and remembers the day so we don't immediately re-post. Returns
 * 'none' if there's no firing invite at (px,py).
 */
export function fireHangoutIfPresent(
  player: Player,
  px: number,
  py: number,
  time: TimeOfDay,
): HangoutOutcome {
  const iv = activeInviteAtPlayer(player, px, py, time);
  if (!iv) return { kind: 'none' };
  // Award gold + hearts.
  player.gold += HANGOUT_GOLD_TIP;
  if (player.hearts && player.hearts[iv.npcId]) {
    const row = player.hearts[iv.npcId];
    row.points = Math.min(10 * HEART_POINTS, row.points + HANGOUT_POINTS);
  }
  // Remove the invite.
  const invites = getInvites(player);
  const idx = invites.indexOf(iv);
  if (idx >= 0) invites.splice(idx, 1);
  // Update cooldown.
  getLastHangoutDay(player)[iv.npcId] = time.day;
  const heartsAfter = player.hearts ? getHearts(player.hearts, iv.npcId) : 0;
  return { kind: 'fired', invite: iv, heartsAfter };
}

/**
 * Quietly drops any invites whose (season, day) has already passed.
 * Called at day rollover so stale rows don't pile up. Returns the
 * number of invites that expired.
 */
export function expireOldInvites(player: Player, today: TimeOfDay): number {
  const invites = getInvites(player);
  let expired = 0;
  for (let i = invites.length - 1; i >= 0; i--) {
    const iv = invites[i];
    // An invite is expired if its (season, day) is strictly before today.
    const ivStamp = iv.season * 100 + iv.day;
    const todayStamp = today.season * 100 + today.day;
    if (ivStamp < todayStamp) {
      invites.splice(i, 1);
      expired++;
    }
  }
  return expired;
}

/** Cheap deterministic hash for the day-delay picker. */
function hash(s: string, day: number): number {
  let h = day * 2654435761;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
    h = h | 0;
  }
  return Math.abs(h);
}

/** Pretty label for the HUD toast on the day an invite arrives. */
export function inviteToastLine(invite: NPCInvite): string {
  const name = CANDIDATES[invite.npcId]?.name ?? invite.npcId;
  return `${name} invites you to meet on day ${invite.day} between ${HANGOUT_HOUR_START}-${HANGOUT_HOUR_END}h.`;
}
