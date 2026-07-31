// Empty-state widget — the thin draw layer over game/panel-empty.ts.
//
// Renders a panel's "nothing here yet" message plus an optional dimmer
// hint line, centred horizontally at a given y, in the shared panel
// palette. Keeps the two-line calm empty state identical across every
// panel that adopts it (money log, quest log, lore Rumors, bag).
//
// Pure drawing — no state, no engine imports beyond the EmptyState shape.

import type { EmptyState } from '../game/panel-empty';

const MESSAGE_COLOR = 'rgba(245, 233, 212, 0.5)';
const HINT_COLOR = 'rgba(245, 233, 212, 0.34)';

/**
 * Draw a centred empty state. `centerX` is the horizontal centre (usually
 * panel x + PANEL_W/2); `y` is the top of the message line. The hint, when
 * present, sits ~16px below in a dimmer tone. Caller saves/restores ctx;
 * this only sets fill + font + alignment it needs.
 */
export function drawEmptyState(
  ctx: CanvasRenderingContext2D,
  state: EmptyState,
  centerX: number,
  y: number,
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = MESSAGE_COLOR;
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(state.message, centerX, y);
  if (state.hint) {
    ctx.fillStyle = HINT_COLOR;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(state.hint, centerX, y + 16);
  }
}
