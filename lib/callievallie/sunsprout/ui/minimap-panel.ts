// Minimap panel — `9` toggles a compact bird's-eye view of the whole
// village so the player can orient without walking the camera around.
// Renders the tile-colour grid from minimap.ts, overlays labelled
// landmark pips (home / shop / inn / well / cave) and a pulsing player
// dot, with a small legend. Same dark-violet panel chrome as the other
// overlays.

import type { World } from '../world/world';
import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import {
  minimapMarkers,
  minimapTileColors,
  minimapPings,
  pingLegend,
  projectTile,
  playerDotRingAlpha,
  pingRing,
  cycleFocusIndex,
  focusedLandmarkCaption,
  type MinimapMarker,
  type MinimapPing,
  type PingRing,
  type PingLegendRow,
} from '../game/minimap';
import { panelOpenAlpha } from '../game/panel-transition';

const PANEL_BG = 'rgba(26, 20, 38, 0.97)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const HINT = 'rgba(245, 233, 212, 0.55)';
const LABEL = 'rgba(245, 233, 212, 0.82)';
const MAP_BORDER = '#2A2038';
const PLAYER_DOT = '#F5E9D4';
const PLAYER_RING = '#F5C9A0';
const FOCUS_RING = '#F5E9D4';
const FOCUS_CAPTION = '#F5C9A0';

const MAP_W = 320;
const MAP_H = 240;
const PAD = 16;
const LEGEND_H = 56;
/** Height of the focused-landmark caption row under the map title. */
const FOCUS_CAPTION_H = 18;

export class MinimapPanel {
  private opened = false;
  private lockoutMs = 0;
  private pulseMs = 0;
  /**
   * Cursor into the landmark list for the focused-landmark caption, or
   * -1 when nothing is focused yet (the player hasn't cycled). Cleared on
   * close so each open starts neutral (caption hidden until they press).
   */
  private focusIndex = -1;

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.focusIndex = -1;
  }

  close(): void {
    this.opened = false;
    this.focusIndex = -1;
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  isVisible(): boolean {
    return this.opened;
  }

  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  /**
   * Move the focused-landmark cursor by `delta` (+1 next, -1 prev),
   * wrapping through the landmark list. The first press from the neutral
   * state lands on the first marker (forward) or the last (backward).
   */
  cycleFocus(world: World, delta: number): void {
    const count = minimapMarkers(world).length;
    if (count === 0) return;
    const from = this.focusIndex < 0 ? (delta > 0 ? -1 : 0) : this.focusIndex;
    this.focusIndex = cycleFocusIndex(from, count, delta);
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
    this.pulseMs = (this.pulseMs + dtMs) % 1200;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    world: World,
    player: Player,
    time: TimeOfDay,
    canvasW: number,
    canvasH: number,
    reduceMotion: boolean = false,
  ): void {
    if (!this.opened) return;
    // Active pings drive both the on-map rings and the "why" legend; derive
    // them once so the two stay in sync.
    const pings = minimapPings(player, time);
    const legendRows = pingLegend(pings);
    // Grow the panel to fit a ping-reason legend when one or more tiles are
    // pinging, so a colour-blind player can read WHY without decoding hue.
    const pingLegendH = legendRows.length > 0 ? 16 + legendRows.length * 16 : 0;
    // Focused-landmark caption sits in a fixed row under the title so the
    // map doesn't jump as the player cycles focus on/off.
    const markers = minimapMarkers(world);
    const caption = focusedLandmarkCaption(markers, this.focusIndex);
    const panelW = MAP_W + PAD * 2;
    const panelH = 40 + FOCUS_CAPTION_H + MAP_H + LEGEND_H + pingLegendH + PAD;
    const x = Math.floor((canvasW - panelW) / 2);
    const y = Math.floor((canvasH - panelH) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout; reduce-motion snaps it solid
    // (the minimap already threads the calm flag for its pulse cues).
    ctx.globalAlpha = panelOpenAlpha(this.lockoutMs, reduceMotion);
    ctx.fillStyle = 'rgba(10, 6, 18, 0.42)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, panelW - 1, panelH - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText('village map  (9)', x + PAD, y + 12);

    // Focused-landmark caption row (arrow keys cycle it). Shows a soft
    // prompt before the player has cycled so the affordance is discoverable.
    ctx.font = '11px ui-monospace, monospace';
    if (caption) {
      ctx.fillStyle = FOCUS_CAPTION;
      ctx.textAlign = 'left';
      ctx.fillText(caption, x + PAD, y + 34);
    } else {
      ctx.fillStyle = HINT;
      ctx.textAlign = 'left';
      ctx.fillText('arrow keys: focus a landmark', x + PAD, y + 34);
    }

    const mapX = x + PAD;
    const mapY = y + 36 + FOCUS_CAPTION_H;
    this.drawMap(ctx, world, mapX, mapY, reduceMotion, pings);

    // Landmark legend below the map.
    this.drawLegend(ctx, world, mapX, mapY + MAP_H + 8);

    // Ping-reason legend below the landmark legend (only when pinging).
    if (legendRows.length > 0) {
      this.drawPingLegend(ctx, legendRows, mapX, mapY + MAP_H + 8 + LEGEND_H);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('9 or Esc to close', x + panelW / 2, y + panelH - 14);
    ctx.restore();
  }

  private drawMap(
    ctx: CanvasRenderingContext2D,
    world: World,
    mapX: number,
    mapY: number,
    reduceMotion: boolean,
    pings: readonly MinimapPing[],
  ): void {
    const colors = minimapTileColors(world);
    const { cellW, cellH } = projectTile(0, 0, world.width, world.height, MAP_W, MAP_H);
    // Tile grid. Cells are < 1px-rounded so we ceil the size to avoid seams.
    const cw = Math.ceil(cellW);
    const ch = Math.ceil(cellH);
    for (let ty = 0; ty < world.height; ty++) {
      for (let tx = 0; tx < world.width; tx++) {
        ctx.fillStyle = colors[ty * world.width + tx];
        ctx.fillRect(
          Math.floor(mapX + tx * cellW),
          Math.floor(mapY + ty * cellH),
          cw,
          ch,
        );
      }
    }
    // Map frame.
    ctx.strokeStyle = MAP_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX - 0.5, mapY - 0.5, MAP_W + 1, MAP_H + 1);

    // Landmark pips.
    const markers = minimapMarkers(world);
    for (const m of markers) {
      this.drawMarker(ctx, m, mapX, mapY, world, cellW, cellH);
    }

    // Focused-landmark highlight — a steady square ring around the pip the
    // player has cycled to, so the caption text has a visible anchor on the
    // map. Steady (no pulse) so it doesn't fight the action-ping animation.
    if (this.focusIndex >= 0 && this.focusIndex < markers.length) {
      const fm = markers[this.focusIndex];
      const fx = mapX + fm.tx * cellW + cellW / 2;
      const fy = mapY + fm.ty * cellH + cellH / 2;
      ctx.save();
      ctx.strokeStyle = FOCUS_RING;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.floor(fx - 7) + 0.5, Math.floor(fy - 7) + 0.5, 13, 13);
      ctx.restore();
    }

    // Action pings — pulsing rings on tiles that need the player right
    // now (quest turn-in, open cart, live tournament). Drawn over the
    // landmark pips but under the player dot. Under reduceMotion the
    // expanding ring is dropped (a steady inner dot still marks the spot).
    const ring = pingRing(this.pulseMs, reduceMotion);
    for (const p of pings) {
      this.drawPing(ctx, p, mapX, mapY, cellW, cellH, ring);
    }

    // Player dot — pulsing ring so the eye finds "you are here" fast.
    // Holds a steady mid-bright ring under reduceMotion.
    const p = world.player;
    const dx = mapX + p.x * cellW;
    const dy = mapY + p.y * cellH;
    ctx.fillStyle = PLAYER_RING;
    ctx.globalAlpha = playerDotRingAlpha(this.pulseMs, reduceMotion);
    ctx.beginPath();
    ctx.arc(dx, dy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PLAYER_DOT;
    ctx.beginPath();
    ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    m: MinimapMarker,
    mapX: number,
    mapY: number,
    world: World,
    cellW: number,
    cellH: number,
  ): void {
    void world;
    const cx = mapX + m.tx * cellW + cellW / 2;
    const cy = mapY + m.ty * cellH + cellH / 2;
    // Pip.
    ctx.fillStyle = m.color;
    ctx.fillRect(Math.floor(cx - 4), Math.floor(cy - 4), 8, 8);
    ctx.strokeStyle = '#1A1426';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.floor(cx - 4) + 0.5, Math.floor(cy - 4) + 0.5, 7, 7);
    // Glyph.
    ctx.fillStyle = '#1A1426';
    ctx.font = 'bold 8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.glyph, Math.floor(cx), Math.floor(cy) + 1);
    ctx.textBaseline = 'top';
  }

  private drawPing(
    ctx: CanvasRenderingContext2D,
    p: MinimapPing,
    mapX: number,
    mapY: number,
    cellW: number,
    cellH: number,
    ring: PingRing,
  ): void {
    const cx = mapX + p.tx * cellW + cellW / 2;
    const cy = mapY + p.ty * cellH + cellH / 2;
    ctx.save();
    // Expanding ring: radius + alpha breathe on the shared pulse clock so
    // the eye is drawn to the spot without a hard flash. Dropped entirely
    // under reduceMotion (ring.showRing === false).
    if (ring.showRing) {
      ctx.globalAlpha = ring.ringAlpha;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Solid inner dot keeps the marker readable at the trough of the pulse
    // (and is the ONLY cue under reduceMotion, so it's drawn a touch larger).
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawLegend(ctx: CanvasRenderingContext2D, world: World, lx: number, ly: number): void {
    const markers = minimapMarkers(world);
    ctx.font = '10px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    // Lay out in two rows of pips with their labels.
    const perRow = Math.ceil(markers.length / 2);
    const colW = MAP_W / perRow;
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const px = lx + col * colW;
      const py = ly + row * 20 + 8;
      // Pip swatch.
      ctx.fillStyle = m.color;
      ctx.fillRect(px, py - 4, 8, 8);
      ctx.strokeStyle = '#1A1426';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py - 3.5, 7, 7);
      ctx.fillStyle = '#1A1426';
      ctx.font = 'bold 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m.glyph, px + 4, py + 1);
      // Label.
      ctx.fillStyle = LABEL;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(m.label, px + 12, py);
    }
    ctx.textBaseline = 'top';
  }

  /**
   * "Why is this pinging" key — one row per active ping reason with its
   * ring colour swatch + plain-language label, so a colour-blind player
   * can read the meaning of each pulse instead of decoding hue. Only drawn
   * when there's at least one ping (the caller gates + sizes the panel).
   */
  private drawPingLegend(
    ctx: CanvasRenderingContext2D,
    rows: readonly PingLegendRow[],
    lx: number,
    ly: number,
  ): void {
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.fillText('needs you now', lx, ly + 6);
    ctx.font = '10px ui-monospace, monospace';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ry = ly + 16 + i * 16 + 6;
      // Ring-colour swatch (drawn as a small ring to echo the on-map cue).
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(lx + 4, ry, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(lx + 4, ry, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Reason label.
      ctx.fillStyle = LABEL;
      ctx.textAlign = 'left';
      ctx.fillText(r.reason, lx + 14, ry);
    }
    ctx.textBaseline = 'top';
  }
}
