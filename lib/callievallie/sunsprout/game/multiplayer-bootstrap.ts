// Multiplayer bootstrap — v0.6.0 ninth slice.
//
// Pure helper that decides whether multiplayer should be enabled for this
// page load and, if so, wires up the pieces we've built in earlier slices
// (BroadcastChannelTransport + MultiplayerSession + PeerView + identity
// resolver) into a single object the engine can drop in.
//
// No DOM imports, no rendering. The host supplies a Location-like and a
// Storage-like so vitest can exercise every branch in node.
//
// Why a separate module? engine/game.ts is already 600+ lines and we want
// to keep the multiplayer toggle testable without spinning up a Game.
// The actual wiring into Game.update()/render() comes in the next tick.

import {
  BroadcastChannelTransport,
  isBroadcastChannelSupported,
  type BroadcastChannelFactory,
} from './broadcast-channel-transport';
import { MultiplayerSession } from './multiplayer-session';
import { PeerView } from './peer-view';
import {
  resolveLocalIdentity,
  type IdentityStore,
} from './peer-identity';

/** Minimal Location-like — matches window.location for the fields we touch. */
export interface LocationLike {
  search?: string;
  hash?: string;
}

export interface MultiplayerBootstrapOpts {
  location?: LocationLike;
  store?: IdentityStore;
  /** Channel name override — defaults to BroadcastChannelTransport's default. */
  channelName?: string;
  /** Injectable for tests so we don't need a real BroadcastChannel global. */
  channelFactory?: BroadcastChannelFactory;
  /** Force the feature on/off, bypassing URL detection. */
  force?: boolean;
}

export interface MultiplayerBootstrapResult {
  session: MultiplayerSession;
  view: PeerView;
}

/**
 * Returns true iff `?multiplayer=1` (or `=true`/`=on`) appears in the query
 * string. Anything else (missing param, `=0`, `=off`) means single-player.
 */
export function isMultiplayerRequested(location?: LocationLike): boolean {
  const raw = location?.search ?? '';
  if (!raw) return false;
  const trimmed = raw.startsWith('?') ? raw.slice(1) : raw;
  for (const part of trimmed.split('&')) {
    const eq = part.indexOf('=');
    const key = eq < 0 ? part : part.slice(0, eq);
    if (key.toLowerCase() !== 'multiplayer') continue;
    const val = (eq < 0 ? '1' : part.slice(eq + 1)).toLowerCase();
    return val === '1' || val === 'true' || val === 'on' || val === 'yes';
  }
  return false;
}

/**
 * Construct a live MultiplayerSession + PeerView, or return null when
 * multiplayer is disabled / unsupported in this environment.
 *
 * Disabled means: feature flag off, or BroadcastChannel missing AND the
 * caller didn't inject a channelFactory. Throwing here would break the
 * single-player boot path on browsers without BroadcastChannel, so we fail
 * soft and log to console.warn instead.
 */
export function bootstrapMultiplayer(
  opts: MultiplayerBootstrapOpts = {},
): MultiplayerBootstrapResult | null {
  const enabled = opts.force ?? isMultiplayerRequested(opts.location);
  if (!enabled) return null;

  const factory = opts.channelFactory;
  if (!factory && !isBroadcastChannelSupported()) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[sunsprout] multiplayer requested but BroadcastChannel is unavailable — staying single-player',
      );
    }
    return null;
  }

  const identity = resolveLocalIdentity({
    store: opts.store,
    hash: opts.location?.hash,
  });
  const transport = new BroadcastChannelTransport({
    id: identity.id,
    channelName: opts.channelName,
    channelFactory: factory,
  });
  const session = new MultiplayerSession({ identity, transport });
  const view = new PeerView();
  return { session, view };
}
