// Peer sprite — v0.6.0 seventh slice.
//
// Pure draw helper for a single remote co-op player. Mirrors the local
// drawPlayer routine in renderer.ts but with per-peer tint (tunic color)
// and hat color drawn from the snapshot, plus a name plate centered above
// the sprite. The renderer-wiring tick will iterate PeerView.viewAt() and
// call this for each PeerRenderable.
//
// Kept in its own module so we can unit-test against a stub
// CanvasRenderingContext2D without touching the giant renderer class.

import { TILE_SIZE } from '../engine/grid';
import type { PeerRenderable } from '../game/peer-view';
import {
  drawPixelRect,
  drawPixelText,
  drawShadow,
} from './pixel';

const PLAYER_SKIN = '#F2C9A4';
const PLAYER_SKIN_DARK = '#D4A07A';
const PLAYER_OUTLINE = '#2C2A38';
const LEG = '#2C2A38';

/** Compute the screen-space (sx, sy) of a peer's torso center given tile coords. */
export function peerScreenPos(
  peer: PeerRenderable,
  cameraX: number,
  cameraY: number,
): { sx: number; sy: number } {
  const wx = peer.x * TILE_SIZE + TILE_SIZE / 2;
  const wy = peer.y * TILE_SIZE + TILE_SIZE / 2;
  return { sx: Math.floor(wx - cameraX), sy: Math.floor(wy - cameraY) };
}

/** Pull a colour ~25% toward black for inline shadows. Tolerant to bad input. */
function darken(hex: string): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

/**
 * Draw a peer sprite at screen-space (sx, sy). Designed to look like the
 * local player but tinted by `peer.color` (tunic) and `peer.hat` (hat),
 * with the peer's name floated above the head.
 */
export function drawPeerSprite(
  ctx: CanvasRenderingContext2D,
  peer: PeerRenderable,
  sx: number,
  sy: number,
): void {
  const tunic = peer.color;
  const tunicDark = darken(tunic);
  const hat = peer.hat;
  const hatDark = darken(hat);

  drawShadow(ctx, sx, sy + 13, 20);

  // Tunic + waist.
  drawPixelRect(ctx, sx - 5, sy - 4, 10, 12, tunic);
  drawPixelRect(ctx, sx - 5, sy + 4, 10, 2, tunicDark);

  // Legs.
  drawPixelRect(ctx, sx - 4, sy + 8, 3, 4, LEG);
  drawPixelRect(ctx, sx + 1, sy + 8, 3, 4, LEG);

  // Arms.
  if (peer.facing === 'left') {
    drawPixelRect(ctx, sx - 7, sy - 2, 2, 8, tunic);
  } else if (peer.facing === 'right') {
    drawPixelRect(ctx, sx + 5, sy - 2, 2, 8, tunic);
  } else {
    drawPixelRect(ctx, sx - 7, sy - 2, 2, 6, tunic);
    drawPixelRect(ctx, sx + 5, sy - 2, 2, 6, tunic);
  }

  // Head.
  drawPixelRect(ctx, sx - 4, sy - 12, 8, 8, PLAYER_SKIN);
  drawPixelRect(ctx, sx - 4, sy - 5, 8, 1, PLAYER_SKIN_DARK);

  // Hat.
  drawPixelRect(ctx, sx - 6, sy - 13, 12, 2, hat);
  drawPixelRect(ctx, sx - 5, sy - 16, 10, 3, hat);
  drawPixelRect(ctx, sx - 4, sy - 17, 8, 1, hatDark);
  drawPixelRect(ctx, sx - 5, sy - 13, 10, 1, hatDark);

  // Eyes / mouth by facing.
  if (peer.facing === 'down') {
    drawPixelRect(ctx, sx - 2, sy - 9, 1, 1, PLAYER_OUTLINE);
    drawPixelRect(ctx, sx + 1, sy - 9, 1, 1, PLAYER_OUTLINE);
    drawPixelRect(ctx, sx - 1, sy - 6, 3, 1, PLAYER_OUTLINE);
  } else if (peer.facing === 'up') {
    drawPixelRect(ctx, sx - 4, sy - 8, 8, 2, '#5A3A24');
  } else if (peer.facing === 'left') {
    drawPixelRect(ctx, sx - 2, sy - 9, 1, 1, PLAYER_OUTLINE);
    drawPixelRect(ctx, sx - 1, sy - 6, 2, 1, PLAYER_OUTLINE);
  } else if (peer.facing === 'right') {
    drawPixelRect(ctx, sx + 1, sy - 9, 1, 1, PLAYER_OUTLINE);
    drawPixelRect(ctx, sx, sy - 6, 2, 1, PLAYER_OUTLINE);
  }

  drawPeerNameplate(ctx, peer.name, sx, sy);
}

/** Draw the floating name above a peer. Exported for tests + flexibility. */
export function drawPeerNameplate(
  ctx: CanvasRenderingContext2D,
  name: string,
  sx: number,
  sy: number,
): void {
  const text = name.length > 12 ? `${name.slice(0, 11)}…` : name;
  // Approx 6px per char in our pixel font.
  const w = Math.max(12, text.length * 6 + 4);
  const x = sx - Math.floor(w / 2);
  const y = sy - 28;
  drawPixelRect(ctx, x, y, w, 9, 'rgba(0,0,0,0.55)');
  drawPixelText(ctx, text, x + 2, y + 1, '#FFFFFF');
}
