// Renders the whole world each frame. The renderer is intentionally
// stateless beyond the canvas context — Game owns the World, Camera and
// the current time-of-day.
//
// Drawing order (back-to-front):
//   1. Sky gradient backdrop (visible outside the world rectangle too).
//   2. Tiles within the camera's visible range.
//   3. Buildings, sorted by their footprint Y so southern buildings
//      occlude northern ones correctly.
//   4. Crops on tilled tiles.
//   5. NPCs.
//   6. Player on top of everything else.
//   7. Day/night tint overlay at low alpha.

import { Camera } from '../engine/camera';
import { TILE_SIZE } from '../engine/grid';
import type { Building, Crop, NPC, Tile, World } from '../world/world';
import type { PeerRenderable } from '../game/peer-view';
import { drawPeerSprite, peerScreenPos } from './peer-sprite';
import { drawPeerMuteMark, type MuteSource } from './peer-mute-mark';
import { decorPalette, type DecorPalette } from '../game/decor';
import { cropSwayOffset } from '../game/crop-sway';
import {
  drawPixelCircle,
  drawPixelRect,
  drawPixelText,
  drawShadow,
  lerpHex,
} from './pixel';

const GRASS_BASE = '#6FB44F';
const GRASS_DARK = '#5FA044';
const GRASS_LIGHT = '#7CC55C';
const TILLED = '#8B5A2B';
const TILLED_DARK = '#6E4520';
const WATER = '#4A90C2';
const WATER_HIGHLIGHT = '#7BB3DA';
const PATH = '#B89F75';
const PATH_DARK = '#9A8460';
const STONE = '#B0A89A';

const PLAYER_TUNIC = '#4A7BC8';
const PLAYER_TUNIC_DARK = '#345A9A';
const PLAYER_HAT = '#C84A4A';
const PLAYER_HAT_DARK = '#933434';
const PLAYER_SKIN = '#F5C9A0';
const PLAYER_SKIN_DARK = '#D6A77D';
const PLAYER_OUTLINE = '#23264A';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  /** Last-frame night tint scale, set by Game via draw(...). */
  private activeTintScale: number = 1.0;
  /** Wall-clock ms for time-driven sprite animation (crop sway). */
  private nowMs: number = 0;
  /** Reduce-motion flag — when true, sprite animations hold still. */
  private reduceMotion: boolean = false;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    // Pixel-art friendly: disable smoothing once on construction.
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * timeOfDay is a value in [0,1): 0 = dawn, 0.25 = noon, 0.5 = dusk,
   * 0.75 = midnight. The renderer maps this to a sky gradient and a
   * tint overlay.
   */
  /**
   * Draw remote co-op peers on top of the world but below the night tint.
   * Call this between `draw()` and any HUD overlays. Peers outside the
   * camera viewport are skipped with a cheap bounds test so a packed lobby
   * doesn't tank the framerate.
   */
  drawPeers(
    peers: readonly PeerRenderable[],
    camera: Camera,
    mutes?: MuteSource,
  ): void {
    if (peers.length === 0) return;
    const ctx = this.ctx;
    const w = camera.viewW;
    const h = camera.viewH;
    for (const peer of peers) {
      const { sx, sy } = peerScreenPos(peer, camera.x, camera.y);
      // 32px slack on each side covers the sprite + nameplate.
      if (sx < -32 || sx > w + 32 || sy < -32 || sy > h + 32) continue;
      drawPeerSprite(ctx, peer, sx, sy);
      if (mutes) drawPeerMuteMark(ctx, peer, mutes, sx, sy);
    }
  }

  draw(world: World, camera: Camera, timeOfDay: number, nightTintScale: number = 1.0, nowMs: number = 0, reduceMotion: boolean = false): void {
    const ctx = this.ctx;
    const w = camera.viewW;
    const h = camera.viewH;
    // Remember the frame's animation clock + calm-mode flag for the crop
    // sway in drawCrop (kept on the instance to avoid threading them
    // through every private draw helper).
    this.nowMs = nowMs;
    this.reduceMotion = reduceMotion;

    // (1) Sky / background.
    this.drawSky(timeOfDay, w, h);
    // Remember the tint scale for (7) below.
    this.activeTintScale = nightTintScale;

    // Resolve current farmhouse decor palette once per frame.
    const decor = world.player ? decorPalette(world.player) : ({} as DecorPalette);

    // Compute visible tile range, with a 1-tile margin so partial tiles
    // along the viewport edges still render.
    const startX = Math.max(0, Math.floor(camera.x / TILE_SIZE) - 1);
    const startY = Math.max(0, Math.floor(camera.y / TILE_SIZE) - 1);
    const endX = Math.min(
      world.width,
      Math.ceil((camera.x + w) / TILE_SIZE) + 1,
    );
    const endY = Math.min(
      world.height,
      Math.ceil((camera.y + h) / TILE_SIZE) + 1,
    );

    // (2) Tiles.
    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const tile = world.tiles[ty][tx];
        const wx = tx * TILE_SIZE;
        const wy = ty * TILE_SIZE;
        const { sx, sy } = camera.worldToScreen(wx, wy);
        this.drawTile(tile, sx, sy, tx, ty);
      }
    }

    // (3) Buildings, sorted south-most last so they overlap correctly.
    const buildings = [...world.buildings].sort(
      (a, b) => a.y + a.h - (b.y + b.h),
    );
    for (const b of buildings) {
      this.drawBuilding(b, camera, decor);
    }

    // (4) Crops on tilled tiles.
    for (const crop of world.crops) {
      this.drawCrop(crop, camera);
    }

    // (5) NPCs.
    for (const npc of world.npcs) {
      this.drawNPC(npc, camera);
    }

    // (6) Player on top.
    if (world.player) {
      this.drawPlayer(world, camera);
    }

    // (7) Day/night tint overlay (low alpha).
    this.drawNightTint(timeOfDay, w, h);
  }

  // -------------------------------------------------------------------
  // Sky / atmosphere
  // -------------------------------------------------------------------

  private drawSky(t: number, w: number, h: number): void {
    const ctx = this.ctx;
    // Smoothly cycle between dawn, day, dusk, and night palettes so the
    // gradient changes feel continuous rather than stepwise.
    const top = this.skyTop(t);
    const bot = this.skyBottom(t);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private skyTop(t: number): string {
    // Four key colours rotated through the day cycle.
    const dawn = '#FFD3A8';
    const day = '#9FCFE8';
    const dusk = '#E89A6F';
    const night = '#1A1F3A';
    return this.cyclicLerp(t, dawn, day, dusk, night);
  }

  private skyBottom(t: number): string {
    const dawn = '#FFE4C0';
    const day = '#B5D8F0';
    const dusk = '#C56E5A';
    const night = '#0F1428';
    return this.cyclicLerp(t, dawn, day, dusk, night);
  }

  /** Interpolate between four palette stops at t in [0,1). */
  private cyclicLerp(
    t: number,
    a: string,
    b: string,
    c: string,
    d: string,
  ): string {
    const phase = (t * 4) % 4;
    const i = Math.floor(phase);
    const f = phase - i;
    const stops = [a, b, c, d];
    const from = stops[i % 4];
    const to = stops[(i + 1) % 4];
    return lerpHex(from, to, f);
  }

  private drawNightTint(t: number, w: number, h: number): void {
    // Compute a "darkness" value that peaks at midnight (t≈0.75) and
    // fades to nothing around noon (t≈0.25).
    const phase = (t - 0.25 + 1) % 1; // 0 at noon, 0.5 at midnight
    const dark = Math.max(0, Math.sin(phase * Math.PI));
    if (dark <= 0.02) return;
    const scale = Math.max(0, Math.min(1, this.activeTintScale));
    const alpha = Math.min(0.45, dark * 0.45) * scale;
    if (alpha <= 0.005) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(20, 24, 60, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // Tiles
  // -------------------------------------------------------------------

  private drawTile(tile: Tile, sx: number, sy: number, tx: number, ty: number): void {
    const ctx = this.ctx;
    switch (tile.type) {
      case 'grass': {
        drawPixelRect(ctx, sx, sy, TILE_SIZE, TILE_SIZE, GRASS_BASE);
        // Cheap variation: a couple of darker / lighter pixels seeded by
        // the tile coordinates so the pattern is stable across frames.
        const v = tile.variant ?? ((tx * 7 + ty * 13) % 4);
        if (v === 0) {
          drawPixelRect(ctx, sx + 6, sy + 8, 4, 2, GRASS_DARK);
          drawPixelRect(ctx, sx + 20, sy + 18, 3, 2, GRASS_LIGHT);
        } else if (v === 1) {
          drawPixelRect(ctx, sx + 12, sy + 20, 5, 2, GRASS_DARK);
          drawPixelRect(ctx, sx + 4, sy + 4, 2, 2, GRASS_LIGHT);
        } else if (v === 2) {
          drawPixelRect(ctx, sx + 24, sy + 6, 2, 3, GRASS_DARK);
        } else {
          drawPixelRect(ctx, sx + 16, sy + 12, 2, 2, GRASS_LIGHT);
          drawPixelRect(ctx, sx + 2, sy + 22, 3, 2, GRASS_DARK);
        }
        break;
      }
      case 'tilled': {
        drawPixelRect(ctx, sx, sy, TILE_SIZE, TILE_SIZE, TILLED);
        // Horizontal furrow striping for the dirt patch.
        for (let i = 4; i < TILE_SIZE; i += 8) {
          drawPixelRect(ctx, sx + 2, sy + i, TILE_SIZE - 4, 1, TILLED_DARK);
        }
        break;
      }
      case 'water': {
        drawPixelRect(ctx, sx, sy, TILE_SIZE, TILE_SIZE, WATER);
        // Static wave highlights — animated water would need a frame timer.
        drawPixelRect(ctx, sx + 4, sy + 8, 6, 1, WATER_HIGHLIGHT);
        drawPixelRect(ctx, sx + 18, sy + 18, 8, 1, WATER_HIGHLIGHT);
        drawPixelRect(ctx, sx + 10, sy + 24, 5, 1, WATER_HIGHLIGHT);
        break;
      }
      case 'path': {
        drawPixelRect(ctx, sx, sy, TILE_SIZE, TILE_SIZE, PATH);
        // Subtle cobblestone speckle.
        drawPixelRect(ctx, sx + 6, sy + 6, 2, 2, PATH_DARK);
        drawPixelRect(ctx, sx + 22, sy + 12, 2, 2, PATH_DARK);
        drawPixelRect(ctx, sx + 14, sy + 22, 2, 2, PATH_DARK);
        break;
      }
      case 'stone': {
        drawPixelRect(ctx, sx, sy, TILE_SIZE, TILE_SIZE, STONE);
        drawPixelRect(ctx, sx + 4, sy + 4, 3, 3, '#928B7E');
        drawPixelRect(ctx, sx + 18, sy + 20, 4, 3, '#928B7E');
        break;
      }
      case 'wood': {
        drawPixelRect(ctx, sx, sy, TILE_SIZE, TILE_SIZE, '#8B5E34');
        drawPixelRect(ctx, sx, sy + 8, TILE_SIZE, 1, '#6B4424');
        drawPixelRect(ctx, sx, sy + 20, TILE_SIZE, 1, '#6B4424');
        break;
      }
    }
  }

  // -------------------------------------------------------------------
  // Buildings
  // -------------------------------------------------------------------

  private drawBuilding(b: Building, camera: Camera, decor: DecorPalette = {}): void {
    if (b.kind === 'well') {
      this.drawWell(b, camera);
      return;
    }
    const ctx = this.ctx;
    const wx = b.x * TILE_SIZE;
    const wy = b.y * TILE_SIZE;
    const { sx, sy } = camera.worldToScreen(wx, wy);
    const pw = b.w * TILE_SIZE;
    const ph = b.h * TILE_SIZE;

    // Walls + roof colours per building kind.
    let wall = '#8B6E4E';
    let wallDark = '#6E5640';
    let roof = '#B85A3D';
    let roofDark = '#8A4530';
    let trim = '#5A4030';
    let window = '#FFD58A';
    if (b.kind === 'shop') {
      wall = '#6B8E5A';
      wallDark = '#52704A';
      roof = '#E8C24A';
      roofDark = '#B89234';
      trim = '#3E5238';
      window = '#FFF1B0';
    } else if (b.kind === 'farmhouse') {
      wall = '#D2B48C';
      wallDark = '#A88D6A';
      roof = '#7A7A7A';
      roofDark = '#5A5A5A';
      trim = '#5A4030';
      window = '#FFE4A0';
      // Decor overrides — only the farmhouse re-skins; the inn and
      // shop stay on their canonical palette so the village still
      // reads correctly at a glance.
      if (decor.wall) wall = decor.wall;
      if (decor.wallDark) wallDark = decor.wallDark;
      if (decor.roof) roof = decor.roof;
      if (decor.roofDark) roofDark = decor.roofDark;
      if (decor.trim) trim = decor.trim;
      if (decor.window) window = decor.window;
    }

    // Shadow under the building footprint.
    drawShadow(ctx, sx + pw / 2, sy + ph + 4, pw);

    // Wall.
    const wallTop = sy + Math.floor(ph * 0.4);
    drawPixelRect(ctx, sx, wallTop, pw, ph - (wallTop - sy), wall);
    // Wall darker base.
    drawPixelRect(ctx, sx, sy + ph - 6, pw, 6, wallDark);
    // Foundation trim.
    drawPixelRect(ctx, sx, sy + ph - 2, pw, 2, trim);

    // Roof: a chunky pixel triangle approximated by stepped rectangles.
    const roofH = Math.floor(ph * 0.55);
    const roofBase = wallTop + 2;
    const steps = Math.max(4, Math.floor(roofH / 4));
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const inset = Math.floor(t * (pw / 2));
      const stripY = roofBase - i * Math.ceil(roofH / steps);
      drawPixelRect(
        ctx,
        sx + inset,
        stripY,
        pw - inset * 2,
        Math.ceil(roofH / steps),
        i === steps - 1 ? roofDark : roof,
      );
    }
    // Roof darker eaves.
    drawPixelRect(ctx, sx - 2, roofBase, pw + 4, 2, roofDark);

    // Door — always at the bottom centre.
    const doorW = 10;
    const doorH = 16;
    const doorX = sx + Math.floor((pw - doorW) / 2);
    const doorY = sy + ph - doorH - 2;
    drawPixelRect(ctx, doorX, doorY, doorW, doorH, trim);
    drawPixelRect(ctx, doorX + doorW - 3, doorY + 8, 2, 2, '#FFD27A'); // doorknob

    // Window — to the side of the door.
    const winW = 8;
    const winH = 8;
    const winY = wallTop + 6;
    drawPixelRect(ctx, sx + 6, winY, winW, winH, window);
    drawPixelRect(ctx, sx + 6, winY, winW, 1, trim);
    drawPixelRect(ctx, sx + 6, winY + winH - 1, winW, 1, trim);
    drawPixelRect(ctx, sx + 6, winY, 1, winH, trim);
    drawPixelRect(ctx, sx + 6 + winW - 1, winY, 1, winH, trim);
    // Window cross.
    drawPixelRect(ctx, sx + 6 + Math.floor(winW / 2), winY, 1, winH, trim);
    drawPixelRect(ctx, sx + 6, winY + Math.floor(winH / 2), winW, 1, trim);

    if (pw >= 96) {
      // Wider buildings get a second window on the far side.
      drawPixelRect(ctx, sx + pw - 6 - winW, winY, winW, winH, window);
      drawPixelRect(ctx, sx + pw - 6 - winW, winY, winW, 1, trim);
      drawPixelRect(ctx, sx + pw - 6 - winW, winY + winH - 1, winW, 1, trim);
      drawPixelRect(ctx, sx + pw - 6 - winW, winY, 1, winH, trim);
      drawPixelRect(ctx, sx + pw - 6 - winW + winW - 1, winY, 1, winH, trim);
    }

    // Tiny sign over the door.
    drawPixelRect(ctx, doorX - 2, doorY - 6, doorW + 4, 4, trim);
    drawPixelText(ctx, b.kind[0].toUpperCase(), doorX + doorW / 2 - 2, doorY - 6, '#FFE4A0');
  }

  private drawWell(b: Building, camera: Camera): void {
    const ctx = this.ctx;
    const cx = (b.x + 0.5) * TILE_SIZE;
    const cy = (b.y + 0.5) * TILE_SIZE;
    const { sx, sy } = camera.worldToScreen(cx, cy);
    drawShadow(ctx, sx, sy + 10, 24);
    // Stone circle.
    drawPixelCircle(ctx, sx, sy, 10, '#B0A89A');
    drawPixelCircle(ctx, sx, sy, 7, '#37343A'); // dark water inside
    // Wooden bucket on top.
    drawPixelRect(ctx, sx - 4, sy - 16, 8, 6, '#7A4E2A');
    drawPixelRect(ctx, sx - 4, sy - 16, 8, 1, '#5A3818');
    drawPixelRect(ctx, sx - 4, sy - 11, 8, 1, '#5A3818');
    // Support posts.
    drawPixelRect(ctx, sx - 9, sy - 22, 2, 14, '#5A3818');
    drawPixelRect(ctx, sx + 7, sy - 22, 2, 14, '#5A3818');
    // Crossbeam + tiny rope.
    drawPixelRect(ctx, sx - 10, sy - 22, 20, 2, '#5A3818');
    drawPixelRect(ctx, sx, sy - 20, 1, 6, '#D8C49A');
  }

  // -------------------------------------------------------------------
  // Crops
  // -------------------------------------------------------------------

  private drawCrop(crop: Crop, camera: Camera): void {
    const ctx = this.ctx;
    const wx = crop.x * TILE_SIZE + TILE_SIZE / 2;
    const wy = crop.y * TILE_SIZE + TILE_SIZE / 2;
    const { sx, sy } = camera.worldToScreen(wx, wy);
    const stage = Math.max(0, Math.min(3, Math.floor(crop.stage)));
    // Gentle wind: the leafy canopy + fruit lean a hair side-to-side while
    // the stem base stays rooted. Per-tile phase so neighbours ripple out
    // of sync; flat 0 under reduce-motion and for un-grown stages.
    const sway = Math.round(
      cropSwayOffset(crop.x, crop.y, stage, this.nowMs, this.reduceMotion),
    );
    const cropColors: Record<Crop['kind'], string> = {
      turnip: '#E8E0F2',
      carrot: '#E48A3C',
      potato: '#C9A66B',
      tomato: '#D8442A',
    };
    if (stage === 0) {
      // Seed: a tiny dark dot in the tilled soil.
      drawPixelRect(ctx, sx - 1, sy - 1, 2, 2, '#3B2A1A');
    } else if (stage === 1) {
      // Sprout: two-pixel green sprout.
      drawPixelRect(ctx, sx, sy - 2, 1, 4, '#3A7A2E');
      drawPixelRect(ctx, sx - 2, sy - 2, 5, 1, '#4FA040');
    } else if (stage === 2) {
      // Mid: bushier leaves. Upper leaves catch the wind; base furrow stays put.
      drawPixelRect(ctx, sx - 3 + sway, sy - 3, 7, 1, '#3A7A2E');
      drawPixelRect(ctx, sx - 4 + sway, sy - 1, 9, 2, '#4FA040');
      drawPixelRect(ctx, sx, sy + 1, 1, 3, '#3A7A2E');
    } else {
      // Ripe: leafy base stays rooted; the colour-coded fruit leans in the breeze.
      drawPixelRect(ctx, sx - 4, sy - 1, 9, 2, '#3A7A2E');
      drawPixelRect(ctx, sx - 3, sy + 1, 7, 2, '#4FA040');
      drawPixelCircle(ctx, sx + sway, sy - 3, 3, cropColors[crop.kind]);
    }
  }

  // -------------------------------------------------------------------
  // NPCs
  // -------------------------------------------------------------------

  private drawNPC(npc: NPC, camera: Camera): void {
    const ctx = this.ctx;
    const wx = npc.x * TILE_SIZE + TILE_SIZE / 2;
    const wy = npc.y * TILE_SIZE + TILE_SIZE / 2;
    const { sx, sy } = camera.worldToScreen(wx, wy);
    drawShadow(ctx, sx, sy + 12, 18);
    // Body.
    drawPixelRect(ctx, sx - 6, sy - 6, 12, 14, npc.color);
    // Body shadow.
    drawPixelRect(ctx, sx - 6, sy + 6, 12, 2, this.darken(npc.color));
    // Head.
    drawPixelRect(ctx, sx - 4, sy - 14, 8, 8, PLAYER_SKIN);
    drawPixelRect(ctx, sx - 4, sy - 8, 8, 1, PLAYER_SKIN_DARK);
    // Hat.
    drawPixelRect(ctx, sx - 5, sy - 16, 10, 3, npc.hat);
    drawPixelRect(ctx, sx - 4, sy - 18, 8, 2, npc.hat);
    // Eyes (always face-forward — NPCs are static for now).
    drawPixelRect(ctx, sx - 2, sy - 11, 1, 1, PLAYER_OUTLINE);
    drawPixelRect(ctx, sx + 1, sy - 11, 1, 1, PLAYER_OUTLINE);
    // Name tag for testability / charm.
    drawPixelText(ctx, npc.name.split(' ')[0], sx - 14, sy - 26, '#FFF8E0');
  }

  // -------------------------------------------------------------------
  // Player
  // -------------------------------------------------------------------

  private drawPlayer(world: World, camera: Camera): void {
    const ctx = this.ctx;
    const p = world.player;
    const wx = p.x * TILE_SIZE + TILE_SIZE / 2;
    const wy = p.y * TILE_SIZE + TILE_SIZE / 2;
    const { sx, sy } = camera.worldToScreen(wx, wy);

    drawShadow(ctx, sx, sy + 13, 20);

    // Tunic body (10w x 12h).
    drawPixelRect(ctx, sx - 5, sy - 4, 10, 12, PLAYER_TUNIC);
    // Belt / waist shadow.
    drawPixelRect(ctx, sx - 5, sy + 4, 10, 2, PLAYER_TUNIC_DARK);
    // Legs.
    drawPixelRect(ctx, sx - 4, sy + 8, 3, 4, '#2C2A38');
    drawPixelRect(ctx, sx + 1, sy + 8, 3, 4, '#2C2A38');

    // Arms (small side strokes; only visible on side-facings).
    if (p.facing === 'left') {
      drawPixelRect(ctx, sx - 7, sy - 2, 2, 8, PLAYER_TUNIC);
    } else if (p.facing === 'right') {
      drawPixelRect(ctx, sx + 5, sy - 2, 2, 8, PLAYER_TUNIC);
    } else {
      drawPixelRect(ctx, sx - 7, sy - 2, 2, 6, PLAYER_TUNIC);
      drawPixelRect(ctx, sx + 5, sy - 2, 2, 6, PLAYER_TUNIC);
    }

    // Head.
    drawPixelRect(ctx, sx - 4, sy - 12, 8, 8, PLAYER_SKIN);
    drawPixelRect(ctx, sx - 4, sy - 5, 8, 1, PLAYER_SKIN_DARK);

    // Hat: wide brim plus crown plus facing indicator triangle.
    drawPixelRect(ctx, sx - 6, sy - 13, 12, 2, PLAYER_HAT);
    drawPixelRect(ctx, sx - 5, sy - 16, 10, 3, PLAYER_HAT);
    drawPixelRect(ctx, sx - 4, sy - 17, 8, 1, PLAYER_HAT_DARK);
    // Hat band.
    drawPixelRect(ctx, sx - 5, sy - 13, 10, 1, PLAYER_HAT_DARK);

    // Eyes / mouth depend on facing.
    if (p.facing === 'down') {
      drawPixelRect(ctx, sx - 2, sy - 9, 1, 1, PLAYER_OUTLINE);
      drawPixelRect(ctx, sx + 1, sy - 9, 1, 1, PLAYER_OUTLINE);
      drawPixelRect(ctx, sx - 1, sy - 6, 3, 1, PLAYER_OUTLINE);
    } else if (p.facing === 'up') {
      // Back of head: no eyes, just a darker hair strip.
      drawPixelRect(ctx, sx - 4, sy - 8, 8, 2, '#5A3A24');
    } else if (p.facing === 'left') {
      drawPixelRect(ctx, sx - 2, sy - 9, 1, 1, PLAYER_OUTLINE);
      drawPixelRect(ctx, sx - 1, sy - 6, 2, 1, PLAYER_OUTLINE);
    } else if (p.facing === 'right') {
      drawPixelRect(ctx, sx + 1, sy - 9, 1, 1, PLAYER_OUTLINE);
      drawPixelRect(ctx, sx, sy - 6, 2, 1, PLAYER_OUTLINE);
    }

    // Small triangle indicator on the hat showing facing direction. Drawn
    // last so it's visible above the hat band.
    this.drawFacingIndicator(sx, sy, p.facing);
  }

  private drawFacingIndicator(sx: number, sy: number, facing: string): void {
    const ctx = this.ctx;
    const ind = '#FFE4A0';
    if (facing === 'up') {
      drawPixelRect(ctx, sx, sy - 19, 1, 1, ind);
      drawPixelRect(ctx, sx - 1, sy - 18, 3, 1, ind);
    } else if (facing === 'down') {
      drawPixelRect(ctx, sx - 1, sy - 14, 3, 1, ind);
      drawPixelRect(ctx, sx, sy - 13, 1, 1, ind);
    } else if (facing === 'left') {
      drawPixelRect(ctx, sx - 6, sy - 15, 1, 1, ind);
      drawPixelRect(ctx, sx - 5, sy - 16, 1, 3, ind);
    } else if (facing === 'right') {
      drawPixelRect(ctx, sx + 6, sy - 15, 1, 1, ind);
      drawPixelRect(ctx, sx + 5, sy - 16, 1, 3, ind);
    }
  }

  // -------------------------------------------------------------------
  // Misc utilities
  // -------------------------------------------------------------------

  private darken(hex: string): string {
    // Pull a colour ~25% toward black for inline shadow strokes.
    if (hex.length !== 7 || hex[0] !== '#') return hex;
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
    return `#${r.toString(16).padStart(2, '0')}${g
      .toString(16)
      .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}
