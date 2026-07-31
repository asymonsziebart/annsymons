// NPC barks — ambient one-liners when the player walks past an NPC.
//
// The new walking routes (npc-route.ts) give every NPC a visible
// position that shifts hour by hour. The village now needs a touch of
// audio-equivalent variety: a short, deterministic one-liner that
// floats above an NPC's head when the player gets close, then fades
// after a few seconds. Think of it as bumping into Vallie in the shop
// and hearing her say "fresh seeds today" without having to press E.
//
// Design intent:
//   - One bark per (npc, day, hour) so the same hour spent next to
//     the NPC reads the same line — re-walking past doesn't spam.
//   - Per-NPC bark cooldown so the player can't trip the same NPC
//     twice in five seconds.
//   - Lines are short — fits in the small dialogue bubble. We pull
//     from a per-NPC pool that's distinct from the heavyweight
//     dialogue catalog so the bark feel stays light.
//   - Pure module: a Bark state struct + a few mutators. The Game
//     adds the per-frame "did the player just walk into the bark
//     radius?" check; the renderer draws the floating text.
//
// We intentionally don't pause the world or block input — barks are
// ambient, never interactive. A player who wants the proper dialogue
// still walks up + presses E.

import type { NPC, World } from '../world/world';

/** Tile-distance at which an NPC may bark when the player walks past. */
export const BARK_RADIUS = 2;

/** How long (real ms) a bark stays visible on screen. */
export const BARK_DURATION_MS = 3000;

/** Per-NPC cooldown (in real ms) so one walk-by doesn't fire twice. */
export const BARK_COOLDOWN_MS = 12000;

/** One active bark on screen. */
export interface ActiveBark {
  npcId: string;
  text: string;
  /** Real ms remaining before the bark fades out. */
  remainingMs: number;
}

/** Bookkeeping per (npc, day, hour) so we never repeat the same slot. */
export interface BarkState {
  /** Active barks currently on screen (one per NPC, max). */
  active: ActiveBark[];
  /** Per-NPC time of last bark (real ms timestamp). */
  lastBarkAt: Record<string, number>;
  /** Per-NPC the (day,hour) we already fired so we don't re-fire same slot. */
  firedSlot: Record<string, string>;
}

/** Lazy reader on the world. */
export function getBarks(world: World): BarkState {
  const w = world as World & { barks?: BarkState };
  if (!w.barks) w.barks = { active: [], lastBarkAt: {}, firedSlot: {} };
  return w.barks;
}

/** Per-NPC pool of short ambient lines. Keep them under ~36 chars. */
export const BARK_LINES: Record<string, string[]> = {
  mayor: [
    'Lovely morning, isn\'t it?',
    'Mind the loose stones.',
    'Spring fits this village.',
    'You look well today.',
    'Walk gentle, friend.',
  ],
  maple: [
    'Fresh seeds in!',
    'Counter\'s open.',
    'Come by when you can.',
    'New stock arrived.',
    'Buy two, save a coin.',
  ],
  finn: [
    'Quiet morning at the pond.',
    'Caught a strange one.',
    'Bring your rod by sometime.',
    'Water\'s glassy today.',
    'A bite never lies.',
  ],
  rose: [
    'Soup\'s on the hearth.',
    'Long table\'s always set.',
    'Rest well, friend.',
    'Stop in for a bowl.',
    'I baked extra bread.',
  ],
};

/** Deterministic per-slot hash. */
function pickLine(npcId: string, day: number, hour: number): string | null {
  const pool = BARK_LINES[npcId];
  if (!pool || pool.length === 0) return null;
  let h = day * 16777619;
  h = (h ^ hour) * 2654435761;
  for (let i = 0; i < npcId.length; i++) {
    h = (h ^ npcId.charCodeAt(i)) * 16777619;
    h = h | 0;
  }
  const idx = Math.abs(h) % pool.length;
  return pool[idx];
}

/** Slot key. */
function slotKey(day: number, hour: number): string {
  return `${day}:${hour}`;
}

/**
 * Drive the per-frame bark check. Walk every NPC and, if any is
 * within BARK_RADIUS of the player AND we haven't already fired the
 * (day, hour) slot for that NPC AND the per-NPC cooldown is up, push
 * a fresh ActiveBark onto the state and stamp the slot/cooldown.
 *
 * Also tick the active list — drop barks whose remainingMs is up.
 *
 * Pure-ish: state mutation lives on BarkState (read via getBarks).
 * Returns the number of new barks fired this call so the caller can
 * key any sound or analytics off it.
 */
export function tickBarks(
  world: World,
  px: number,
  py: number,
  day: number,
  hour: number,
  nowMs: number,
  dtMs: number,
): number {
  const state = getBarks(world);
  // Tick down active barks.
  state.active = state.active
    .map((b) => ({ ...b, remainingMs: b.remainingMs - dtMs }))
    .filter((b) => b.remainingMs > 0);
  let fired = 0;
  for (const npc of world.npcs) {
    const ntx = npc.x;
    const nty = npc.y;
    const dist = Math.max(Math.abs(ntx - px), Math.abs(nty - py));
    if (dist > BARK_RADIUS) continue;
    const slot = slotKey(day, hour);
    if (state.firedSlot[npc.id] === slot) continue;
    const last = state.lastBarkAt[npc.id] ?? -Infinity;
    if (nowMs - last < BARK_COOLDOWN_MS) continue;
    const line = pickLine(npc.id, day, hour);
    if (!line) continue;
    // Drop any prior active bark for this NPC; one floats at a time.
    state.active = state.active.filter((b) => b.npcId !== npc.id);
    state.active.push({ npcId: npc.id, text: line, remainingMs: BARK_DURATION_MS });
    state.firedSlot[npc.id] = slot;
    state.lastBarkAt[npc.id] = nowMs;
    fired += 1;
  }
  return fired;
}

/** Returns the active bark for an NPC, or undefined. */
export function activeBarkFor(world: World, npcId: string): ActiveBark | undefined {
  return getBarks(world).active.find((b) => b.npcId === npcId);
}

/**
 * Draw all active barks as small text bubbles above their NPCs. The
 * caller passes a worldToScreen converter so we don't have to know
 * about the camera.
 */
export function drawBarks(
  ctx: CanvasRenderingContext2D,
  world: World,
  worldToScreen: (wx: number, wy: number) => { sx: number; sy: number },
  tileSize: number,
): void {
  const state = getBarks(world);
  if (state.active.length === 0) return;
  ctx.save();
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.imageSmoothingEnabled = false;
  for (const bark of state.active) {
    const npc = world.npcs.find((n) => n.id === bark.npcId);
    if (!npc) continue;
    const wx = npc.x * tileSize + tileSize / 2;
    const wy = npc.y * tileSize - tileSize * 0.2;
    const { sx, sy } = worldToScreen(wx, wy);
    const alpha = Math.min(1, bark.remainingMs / 800);
    const padX = 6;
    const padY = 3;
    const w = ctx.measureText(bark.text).width + padX * 2;
    const h = 14;
    const x = Math.floor(sx - w / 2);
    const y = Math.floor(sy - h);
    // Bubble.
    ctx.fillStyle = `rgba(26, 20, 38, ${(0.78 * alpha).toFixed(3)})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = `rgba(201, 164, 143, ${(0.85 * alpha).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // Tail.
    ctx.fillStyle = `rgba(26, 20, 38, ${(0.78 * alpha).toFixed(3)})`;
    ctx.fillRect(x + w / 2 - 2, y + h, 4, 3);
    // Text.
    ctx.fillStyle = `rgba(245, 233, 212, ${alpha.toFixed(3)})`;
    ctx.textAlign = 'center';
    ctx.fillText(bark.text, x + w / 2, y + h / 2 + padY * 0);
    void padY;
  }
  ctx.restore();
}
