// Peer identity — v0.6.0 sixth slice.
//
// Generates and persists a stable LocalIdentity (id/name/color/hat) for the
// local player so reconnects don't spawn a brand-new ghost peer next to the
// old one. The id is sticky across reloads via localStorage; the name and
// palette can be overridden by a URL hash (e.g.
// `#farm=abc&name=finn&color=ff8855`) so two browser windows can join the
// same farm with distinct cosmetics during local testing.
//
// Pure module — no DOM imports, no rendering. The host (browser, tests)
// supplies a Storage-like + a hash string. A later tick wires this into
// engine/game.ts behind a `?multiplayer=1` flag.

import type { LocalIdentity } from './multiplayer-session';

const STORAGE_KEY = 'callievallie.peerIdentity.v1';

/** Minimal Storage shape — matches window.localStorage / window.sessionStorage. */
export interface IdentityStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface IdentityOverride {
  id?: string;
  name?: string;
  color?: string;
  hat?: string;
}

export interface ResolveIdentityOpts {
  store?: IdentityStore;
  /** URL hash including or excluding the leading '#'. */
  hash?: string;
  /** Random source — injectable for deterministic tests. */
  rand?: () => number;
  /** Direct override — wins over hash + store. Useful for tests. */
  override?: IdentityOverride;
}

const PALETTE = [
  { color: '#ff8855', hat: '#3a2a1a' },
  { color: '#55b6ff', hat: '#1a2a3a' },
  { color: '#88dd66', hat: '#2a3a1a' },
  { color: '#dd66cc', hat: '#3a1a2a' },
  { color: '#ffd84d', hat: '#3a2e0a' },
  { color: '#a988ff', hat: '#1f1a3a' },
];

const NAME_POOL = [
  'sprout',
  'pebble',
  'mossy',
  'finch',
  'turnip',
  'maple',
  'hazel',
  'reed',
  'wren',
  'sage',
];

/**
 * Resolve a stable LocalIdentity. Precedence (highest first):
 *   1. opts.override
 *   2. URL hash params (#id=, #name=, #color=, #hat=)
 *   3. persisted value in opts.store
 *   4. freshly generated using opts.rand
 *
 * The resolved identity is written back to the store so the next call
 * returns the same id (unless overridden again).
 */
export function resolveLocalIdentity(opts: ResolveIdentityOpts = {}): LocalIdentity {
  const rand = opts.rand ?? Math.random;
  const hashParams = parseHash(opts.hash);
  const persisted = readPersisted(opts.store);

  const id = pick(
    opts.override?.id,
    hashParams.id,
    persisted?.id,
    () => generateId(rand),
  );
  const palette = pickPalette(rand);
  const name = pick(
    opts.override?.name,
    hashParams.name,
    persisted?.name,
    () => generateName(rand),
  );
  const color = pick(
    opts.override?.color,
    hashParams.color,
    persisted?.color,
    () => palette.color,
  );
  const hat = pick(
    opts.override?.hat,
    hashParams.hat,
    persisted?.hat,
    () => palette.hat,
  );

  const identity: LocalIdentity = {
    id: sanitizeId(id),
    name: sanitizeName(name),
    color: sanitizeColor(color),
    hat: sanitizeColor(hat),
  };
  writePersisted(opts.store, identity);
  return identity;
}

/** Wipe any persisted identity (e.g. "log out and rejoin as someone new"). */
export function clearPersistedIdentity(store?: IdentityStore): void {
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // ignore — privacy mode, quota, etc.
  }
}

function pick<T>(...candidates: Array<T | undefined | (() => T)>): T {
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    if (typeof c === 'function') return (c as () => T)();
    if (typeof c === 'string' && c.length === 0) continue;
    return c as T;
  }
  // Should be unreachable — last candidate is always a generator.
  throw new Error('pick: no candidate produced a value');
}

function parseHash(hash?: string): IdentityOverride {
  if (!hash) return {};
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!trimmed) return {};
  const out: IdentityOverride = {};
  for (const part of trimmed.split('&')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = decodeURIComponent(part.slice(0, eq)).toLowerCase();
    const v = decodeURIComponent(part.slice(eq + 1));
    if (!v) continue;
    if (k === 'id') out.id = v;
    else if (k === 'name') out.name = v;
    else if (k === 'color') out.color = normalizeColor(v);
    else if (k === 'hat') out.hat = normalizeColor(v);
  }
  return out;
}

function readPersisted(store?: IdentityStore): LocalIdentity | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    const o = obj as Record<string, unknown>;
    if (
      typeof o.id !== 'string' ||
      typeof o.name !== 'string' ||
      typeof o.color !== 'string' ||
      typeof o.hat !== 'string'
    ) {
      return null;
    }
    return { id: o.id, name: o.name, color: o.color, hat: o.hat };
  } catch {
    return null;
  }
}

function writePersisted(store: IdentityStore | undefined, ident: LocalIdentity): void {
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(ident));
  } catch {
    // ignore quota / privacy errors
  }
}

function generateId(rand: () => number): string {
  // 12 base36 chars ≈ 62 bits of entropy — plenty for a session id.
  let s = '';
  while (s.length < 12) {
    s += Math.floor(rand() * 0x100000000)
      .toString(36)
      .padStart(7, '0');
  }
  return 'p_' + s.slice(0, 12);
}

function generateName(rand: () => number): string {
  const base = NAME_POOL[Math.floor(rand() * NAME_POOL.length)] ?? 'farmer';
  const tag = Math.floor(rand() * 1000)
    .toString()
    .padStart(3, '0');
  return `${base}${tag}`;
}

function pickPalette(rand: () => number): { color: string; hat: string } {
  return PALETTE[Math.floor(rand() * PALETTE.length)] ?? PALETTE[0];
}

function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  return cleaned || 'p_anon';
}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^\w\- ]/g, '').trim().slice(0, 32);
  return cleaned || 'farmer';
}

function sanitizeColor(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#cccccc';
}

function normalizeColor(c: string): string {
  if (c.startsWith('#')) return c;
  if (/^[0-9a-fA-F]{6}$/.test(c)) return '#' + c;
  return c;
}
