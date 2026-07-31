// Tool upgrades — copper / iron / gold tiers for the hoe and watering can.
//
// Every player starts with a plain (tier 'wood') hoe and watering can.
// Vallie's shop now sells incremental upgrades at the smithy counter:
//
//   wood   -> copper  (150g)
//   copper -> iron    (450g)
//   iron   -> gold    (1200g)
//
// Each upgrade widens the work area: the player's tool affects MORE
// tiles in front of them on a single press. Tier reach:
//
//   wood   -> 1 tile  (the standard front-tile till/water — unchanged)
//   copper -> 1x3 line (the front tile + both side-neighbours)
//   iron   -> 1x5 line
//   gold   -> 1x5 line plus the tile two ahead (a forward bonus)
//
// Logic lives here so the engine can ask "which tiles should this tool
// touch?" without knowing anything about the tier names. We expose
// `tilesForTool(player, tool)` that returns the absolute tile coords
// the action should apply to, given the player's facing and the tier
// stored on the player as `tools.<tool>`.

import type { Player } from '../world/world';

/** Tools the player can upgrade. */
export type ToolKey = 'hoe' | 'watering-can';

/** Quality tiers in ascending order. */
export type ToolTier = 'wood' | 'copper' | 'iron' | 'gold';

export const TOOL_TIERS: ToolTier[] = ['wood', 'copper', 'iron', 'gold'];

/** Cost in gold to upgrade from a tier to the next. Wood is free (starter). */
export const TIER_UPGRADE_COST: Record<ToolTier, number> = {
  wood: 0,
  copper: 150,
  iron: 450,
  gold: 1200,
};

/** Per-tier reach. Each entry is a tile offset relative to "one tile in
 * front of the player" — (0,0) is the standard front tile, (-1,0) and
 * (1,0) are the side-neighbours of that front tile (relative to facing). */
export const TIER_OFFSETS: Record<ToolTier, Array<{ side: number; forward: number }>> = {
  wood: [{ side: 0, forward: 0 }],
  copper: [
    { side: 0, forward: 0 },
    { side: -1, forward: 0 },
    { side: 1, forward: 0 },
  ],
  iron: [
    { side: 0, forward: 0 },
    { side: -1, forward: 0 },
    { side: 1, forward: 0 },
    { side: -2, forward: 0 },
    { side: 2, forward: 0 },
  ],
  gold: [
    { side: 0, forward: 0 },
    { side: -1, forward: 0 },
    { side: 1, forward: 0 },
    { side: -2, forward: 0 },
    { side: 2, forward: 0 },
    { side: 0, forward: 1 },
  ],
};

/** Player.tools extension: per-tool tier. Lazy-default to wood. */
export interface PlayerTools {
  tools?: Partial<Record<ToolKey, ToolTier>>;
}

/** Returns the player's current tier for a tool (defaults to 'wood'). */
export function tierOf(player: Player, tool: ToolKey): ToolTier {
  const t = (player as Player & PlayerTools).tools;
  return t?.[tool] ?? 'wood';
}

/** Returns the next tier above `tier`, or null if the tool is maxed out. */
export function nextTier(tier: ToolTier): ToolTier | null {
  const i = TOOL_TIERS.indexOf(tier);
  if (i === -1 || i === TOOL_TIERS.length - 1) return null;
  return TOOL_TIERS[i + 1];
}

/** Cost to bump from the player's current tier to the next, or null if maxed. */
export function upgradeCost(player: Player, tool: ToolKey): number | null {
  const next = nextTier(tierOf(player, tool));
  if (!next) return null;
  return TIER_UPGRADE_COST[next];
}

/**
 * Attempt to spend gold to upgrade `tool` by one tier. Returns the new
 * tier on success, or one of the failure tags. Side-effects only on the
 * Player on success.
 */
export type UpgradeOutcome =
  | { kind: 'upgraded'; from: ToolTier; to: ToolTier }
  | { kind: 'max-tier'; tier: ToolTier }
  | { kind: 'not-enough-gold'; need: number; have: number };

export function upgradeTool(player: Player, tool: ToolKey): UpgradeOutcome {
  const cur = tierOf(player, tool);
  const next = nextTier(cur);
  if (!next) return { kind: 'max-tier', tier: cur };
  const need = TIER_UPGRADE_COST[next];
  if (player.gold < need) return { kind: 'not-enough-gold', need, have: player.gold };
  player.gold -= need;
  const ext = player as Player & PlayerTools;
  if (!ext.tools) ext.tools = {};
  ext.tools[tool] = next;
  return { kind: 'upgraded', from: cur, to: next };
}

/**
 * Returns the absolute (tx,ty) tiles a player's tool should touch given
 * their tier and facing. Always returns at least one tile (the standard
 * front tile). Output order is stable for predictable iteration in tests.
 */
export function tilesForTool(player: Player, tool: ToolKey): Array<{ tx: number; ty: number }> {
  const tier = tierOf(player, tool);
  const offsets = TIER_OFFSETS[tier];
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  // "forward" + "side" depend on player facing.
  // Facing 'right' -> forward = +x, side = +y.
  // Facing 'down'  -> forward = +y, side = -x.
  // Facing 'left'  -> forward = -x, side = -y.
  // Facing 'up'    -> forward = -y, side = +x.
  const out: Array<{ tx: number; ty: number }> = [];
  for (const o of offsets) {
    let dx = 0;
    let dy = 0;
    switch (player.facing) {
      case 'right':
        dx = 1 + o.forward;
        dy = o.side;
        break;
      case 'left':
        dx = -(1 + o.forward);
        dy = -o.side;
        break;
      case 'down':
        dx = -o.side;
        dy = 1 + o.forward;
        break;
      case 'up':
        dx = o.side;
        dy = -(1 + o.forward);
        break;
    }
    out.push({ tx: px + dx, ty: py + dy });
  }
  return out;
}

/** Pretty label used in the shop catalog and the smithy toast. */
export function tierLabel(tier: ToolTier): string {
  switch (tier) {
    case 'wood':
      return 'Wood';
    case 'copper':
      return 'Copper';
    case 'iron':
      return 'Iron';
    case 'gold':
      return 'Gold';
  }
}

/** Pretty label for a (tool, tier) — used in the upgrade toast. */
export function toolLabel(tool: ToolKey, tier: ToolTier): string {
  const name = tool === 'hoe' ? 'Hoe' : 'Watering Can';
  return `${tierLabel(tier)} ${name}`;
}
