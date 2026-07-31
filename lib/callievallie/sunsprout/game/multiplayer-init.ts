// Multiplayer init — v0.6.0 eleventh slice.
//
// One-call convenience that combines `bootstrapMultiplayer` (decides whether
// to enable, builds session+view) with `MultiplayerDriver` (the per-frame
// glue). engine/game.ts calls this once at startup and stores the result;
// `null` means stay single-player.
//
// Keeping this thin module separate from the bootstrap helper lets us unit-
// test the wiring without making bootstrap depend on the driver, and gives
// the engine a single import to deal with.

import {
  bootstrapMultiplayer,
  type MultiplayerBootstrapOpts,
} from './multiplayer-bootstrap';
import { MultiplayerDriver } from './multiplayer-driver';

export type MultiplayerInitOpts = MultiplayerBootstrapOpts;

/**
 * Build a ready-to-tick MultiplayerDriver, or return null when multiplayer
 * is disabled / unsupported in this environment. Never throws — bootstrap
 * failures fall through as `null`.
 */
export function initMultiplayer(
  opts: MultiplayerInitOpts = {},
): MultiplayerDriver | null {
  const built = bootstrapMultiplayer(opts);
  if (!built) return null;
  return new MultiplayerDriver({ session: built.session, view: built.view });
}
