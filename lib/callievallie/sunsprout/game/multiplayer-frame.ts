// Multiplayer frame glue — v0.6.0 twelfth slice.
//
// Tiny helpers that bridge a Sunsprout `Player` into the LocalState shape the
// MultiplayerDriver expects, and run one frame of broadcast + peer-fetch in
// a single call. Lets engine/game.ts integrate multiplayer in two lines
// without having to know about driver / session internals, and keeps the
// per-frame logic unit-testable without spinning up a Game (which needs a
// real canvas).

import type { Player } from '../world/world';
import type { LocalState } from './multiplayer-session';
import type { MultiplayerDriver } from './multiplayer-driver';
import type { PeerRenderable } from './peer-view';

/** Extract the network-relevant subset of Player. Rounds nothing — peers
 *  smooth via PeerInterpolator on the receiving side. */
export function playerToLocalState(p: Player): LocalState {
  return { x: p.x, y: p.y, facing: p.facing };
}

/**
 * One-call per-frame multiplayer step. Safe to call with a null driver
 * (single-player) — returns an empty peer list and does nothing else.
 *
 * Returns the smoothed peer renderables so the caller can hand them
 * straight to Renderer.drawPeers.
 */
export function tickMultiplayerFrame(
  driver: MultiplayerDriver | null,
  player: Player,
  now: number,
): PeerRenderable[] {
  if (!driver || driver.closed) return [];
  driver.tick(playerToLocalState(player), now);
  return driver.peers(now);
}
