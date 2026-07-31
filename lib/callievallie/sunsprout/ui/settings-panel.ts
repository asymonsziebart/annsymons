// Settings panel — `\` opens a modal-ish panel listing every settings row.
//
// Each row has a key label and a value the player can cycle with Enter
// or Space. The reset-save row asks for a second Enter to confirm so a
// stray keypress doesn't blow away the player's farm.
//
// Renders centred over the world with a soft dim backdrop so it feels
// like a modal pause screen rather than a stray HUD overlay.

import type { Player } from '../world/world';
import {
  cycleHudScale,
  cycleNightTint,
  getSettings,
  toggleAutoSave,
  toggleReduceMotion,
  type Settings,
} from '../game/settings';
import { clearSave, type StorageLike } from '../game/persistence';
import { panelOpenAlpha } from '../game/panel-transition';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const ROW_BG = 'rgba(40, 30, 60, 0.85)';
const ROW_BG_SELECTED = 'rgba(108, 86, 158, 0.85)';
const ROW_BORDER = '#6b5b8e';
const HINT = 'rgba(245, 233, 212, 0.55)';
const CONFIRM_BG = 'rgba(150, 60, 60, 0.85)';
const CONFIRM_BORDER = '#E07A8A';
const ACCENT = '#F0C24A';
const SECTION_LABEL = 'rgba(245, 233, 212, 0.42)';
const SECTION_RULE = 'rgba(74, 59, 110, 0.5)';

const PANEL_W = 460;

type RowKey = 'autoSave' | 'nightTint' | 'hudScale' | 'reduceMotion' | 'reset' | 'close';

const ROWS: RowKey[] = ['autoSave', 'nightTint', 'hudScale', 'reduceMotion', 'reset', 'close'];

/**
 * Earn the family dialect: group the flat settings rows into labelled
 * sections (GENERAL / DISPLAY / DATA) with the same divider language the
 * codex / almanac / quest-log panels use, so settings reads as the rest
 * of the panel family instead of one undifferentiated list. The grouping
 * is CONTIGUOUS over the existing ROWS order so the index-based keyboard
 * navigation (selectNext / selectPrev / confirm) is byte-identical — only
 * the visual layout gains dividers. The trailing `close` action carries no
 * header (it's the dismiss verb, not a setting), so its section key is
 * null. Pure: a static map over RowKey.
 */
export type SettingsSectionKey = 'general' | 'display' | 'data';

/** Header text per section, in display order. */
const SETTINGS_SECTION_HEADER: Record<SettingsSectionKey, string> = {
  general: 'GENERAL',
  display: 'DISPLAY',
  data: 'SAVE DATA',
};

/** The section each row belongs to, or null for the headerless close verb. */
const ROW_SECTION: Record<RowKey, SettingsSectionKey | null> = {
  autoSave: 'general',
  nightTint: 'display',
  hudScale: 'display',
  reduceMotion: 'display',
  reset: 'data',
  close: null,
};

/** A contiguous run of setting rows under one divider header. */
export interface SettingsSection {
  key: SettingsSectionKey;
  header: string;
  /** Row keys in this section, in panel order. */
  rows: RowKey[];
}

/**
 * Walk the ROWS order, grouping each maximal run of same-section rows
 * under its header. Headerless rows (close) are skipped — the panel draws
 * them after the sections with no divider. Because ROW_SECTION assigns
 * sections so same-section rows are already adjacent, this is a simple
 * run-grouping that preserves the canonical order. Pure.
 */
export function settingsSections(rows: readonly RowKey[] = ROWS): SettingsSection[] {
  const out: SettingsSection[] = [];
  for (const row of rows) {
    const key = ROW_SECTION[row];
    if (key === null) continue;
    const last = out[out.length - 1];
    if (last && last.key === key) {
      last.rows.push(row);
    } else {
      out.push({ key, header: SETTINGS_SECTION_HEADER[key], rows: [row] });
    }
  }
  return out;
}

/**
 * A small inline value-preview drawn in a settings row's value column, so
 * the DISPLAY toggles show their effect rather than only a text value. A
 * discriminated descriptor the renderer paints just left of the text:
 *   - `tint`: a dimmed swatch at the row's night-tint alpha (darker = a
 *     heavier night overlay), so the player sees how dark dusk will get.
 *   - `scale`: a glyph sized to the HUD scale (a small "A" growing with
 *     1.0 / 1.25 / 1.5x), previewing the typography bump.
 *   - `toggle`: a filled/hollow pip for the on/off booleans.
 *   - `none`: rows with no meaningful preview (reset / close).
 * Pure: a static map over RowKey + the current Settings. The renderer owns
 * the pixels; this owns WHAT to show.
 */
export type SettingsRowPreview =
  | { kind: 'tint'; alpha: number }
  | { kind: 'scale'; scale: number }
  | { kind: 'toggle'; on: boolean }
  | { kind: 'danger'; armed: boolean }
  | { kind: 'none' };

/**
 * The cosmetic DISPLAY values broken into one part per setting, each
 * carrying the row whose preview glyph echoes it + the segment text, so the
 * legend caption under the title can lead each segment with the SAME
 * swatch/scale/toggle glyph its row draws — the digest then mirrors its
 * rows, not just names them. settingsLegendCaption joins the parts' text so
 * the caption + the pipped legend can never drift. Pure: a static map over
 * Settings.
 */
export interface SettingsLegendPart {
  /** The row whose value-preview glyph represents this segment. */
  row: RowKey;
  /** Segment text, e.g. "tint 60%" / "HUD 1.00x" / "calm on". */
  text: string;
}

export function settingsLegendParts(s: Settings): SettingsLegendPart[] {
  return [
    { row: 'nightTint', text: `tint ${Math.round(s.nightTintScale * 100)}%` },
    { row: 'hudScale', text: `HUD ${s.hudScale.toFixed(2)}x` },
    { row: 'reduceMotion', text: `calm ${s.reduceMotion ? 'on' : 'off'}` },
  ];
}

/**
 * A one-line digest of the active DISPLAY settings, drawn under the title
 * so the player reads their current look at a glance without scanning each
 * row's value column: "tint 60% - HUD 1.0x - calm on". Mirrors the digest
 * captions on the other panels (the quest board's "next: ...", the bag's
 * worth caption, the money-log savings line) so settings speaks the same
 * dialect. Only the cosmetic toggles that change appearance are named
 * (night tint, HUD scale, reduce-motion); auto-save / reset are actions,
 * not look state. Derives from settingsLegendParts so the text can't drift
 * from the pipped legend. Pure: a static formatter over Settings.
 */
export function settingsLegendCaption(s: Settings): string {
  return settingsLegendParts(s).map((p) => p.text).join(' - ');
}

export function settingsRowPreview(
  row: RowKey,
  s: Settings,
  resetArmed: boolean = false,
): SettingsRowPreview {
  switch (row) {
    case 'nightTint':
      // The stored scale is a multiplier on the night overlay alpha, so a
      // higher value = a darker night. Show the swatch at that opacity.
      return { kind: 'tint', alpha: s.nightTintScale };
    case 'hudScale':
      return { kind: 'scale', scale: s.hudScale };
    case 'autoSave':
      return { kind: 'toggle', on: s.autoSave };
    case 'reduceMotion':
      return { kind: 'toggle', on: s.reduceMotion };
    case 'reset':
      // A warning glyph so the destructive row reads as dangerous at a
      // glance — dim while idle, brightening once the player has armed the
      // two-step confirm so the "this will erase your farm" state is
      // visible, not just in the text.
      return { kind: 'danger', armed: resetArmed };
    case 'close':
      return { kind: 'none' };
  }
}

/** Outcome of a confirm in the settings panel. */
export type SettingsAction =
  | { kind: 'cycled'; key: RowKey; value: string }
  | { kind: 'reset-requested' }
  | { kind: 'reset-done' }
  | { kind: 'closed' }
  | { kind: 'noop' };

export class SettingsPanel {
  private opened = false;
  private lockoutMs = 0;
  private index = 0;
  /** True once the player has armed the reset row; second confirm wipes. */
  private resetArmed = false;

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.index = 0;
    this.resetArmed = false;
  }

  close(): void {
    this.opened = false;
    this.resetArmed = false;
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

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  selectedRow(): RowKey {
    return ROWS[this.index];
  }

  selectPrev(): void {
    if (!this.opened) return;
    this.index = (this.index - 1 + ROWS.length) % ROWS.length;
    this.resetArmed = false;
  }

  selectNext(): void {
    if (!this.opened) return;
    this.index = (this.index + 1) % ROWS.length;
    this.resetArmed = false;
  }

  /**
   * Confirm the current row. Cycles a value, toggles a bool, or arms /
   * fires the reset. Returns a tagged outcome so the caller can show the
   * matching toast.
   */
  confirm(player: Player, storage: StorageLike | null): SettingsAction {
    if (!this.opened) return { kind: 'noop' };
    const row = this.selectedRow();
    switch (row) {
      case 'autoSave': {
        const v = toggleAutoSave(player);
        return { kind: 'cycled', key: 'autoSave', value: v ? 'on' : 'off' };
      }
      case 'nightTint': {
        const v = cycleNightTint(player);
        return { kind: 'cycled', key: 'nightTint', value: `${Math.round(v * 100)}%` };
      }
      case 'hudScale': {
        const v = cycleHudScale(player);
        return { kind: 'cycled', key: 'hudScale', value: `${v.toFixed(2)}x` };
      }
      case 'reduceMotion': {
        const v = toggleReduceMotion(player);
        return { kind: 'cycled', key: 'reduceMotion', value: v ? 'on' : 'off' };
      }
      case 'reset': {
        if (!this.resetArmed) {
          this.resetArmed = true;
          return { kind: 'reset-requested' };
        }
        if (storage) clearSave(storage);
        this.resetArmed = false;
        return { kind: 'reset-done' };
      }
      case 'close':
        this.close();
        return { kind: 'closed' };
    }
  }

  /** Render the panel. No-op when closed. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const settings = getSettings(player);

    const rowH = 36;
    const rowGap = 4;
    const sectionH = 18;
    const sections = settingsSections();
    // Count headerless rows (close) drawn after the sections.
    const looseRows = ROWS.filter((r) => ROW_SECTION[r] === null);
    const bodyH =
      sections.length * sectionH +
      ROWS.length * (rowH + rowGap);
    const h = 86 + bodyH + 26;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout; reduce-motion snaps it solid.
    ctx.globalAlpha = panelOpenAlpha(this.lockoutMs, settings.reduceMotion);
    ctx.fillStyle = 'rgba(10, 6, 18, 0.55)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 15px ui-monospace, monospace';
    ctx.fillText('settings  ( \\ )', x + 16, y + 14);

    ctx.fillStyle = HINT;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('arrows or w-s to move - enter to change - esc to close', x + 16, y + 36);

    // Active-look digest — name the cosmetic DISPLAY values in one dim line
    // so the player reads tint / HUD / calm state at a glance without
    // scanning each row's value column. Each segment leads with the SAME
    // value-preview glyph its row draws (a night-tint swatch, the scaled
    // "A", the on/off pip), so the caption mirrors its rows in the glyph
    // language, not only the words. Pure formatter + render reuse.
    {
      const parts = settingsLegendParts(settings);
      const legendY = y + 52;
      const cy = legendY + 5; // vertical centre of the 10px line
      const GLYPH_SLOT = 18; // right-align slot for the row glyph
      const GLYPH_GAP = 3;
      const SEG_GAP = 12;
      let px = x + 16;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Echo the row's preview glyph, right-aligned in its slot.
        this.drawValuePreview(
          ctx,
          settingsRowPreview(part.row, settings),
          px + GLYPH_SLOT,
          cy,
        );
        // Reset the text state drawValuePreview may have changed (the scale
        // case flips align/baseline), then draw this segment's text.
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = ACCENT;
        ctx.font = 'bold 10px ui-monospace, monospace';
        const tx = px + GLYPH_SLOT + GLYPH_GAP;
        ctx.fillText(part.text, tx, legendY);
        const textW = ctx.measureText(part.text).width;
        px = tx + textW + SEG_GAP;
      }
    }

    // Walk the sections, drawing a divider header above each run of rows,
    // then the headerless close verb at the end. A running ry threads the
    // dividers + rows so the panel reads as the rest of the family while
    // the index-based selection highlight stays exact.
    let ry = y + 76;
    for (const section of sections) {
      this.drawSectionHeader(ctx, section.header, x, ry);
      ry += sectionH;
      for (const row of section.rows) {
        this.drawRow(ctx, row, ROWS.indexOf(row), settings, x, ry, rowH);
        ry += rowH + rowGap;
      }
    }
    // Loose rows (close) — no header, drawn after the sections.
    for (const row of looseRows) {
      this.drawRow(ctx, row, ROWS.indexOf(row), settings, x, ry, rowH);
      ry += rowH + rowGap;
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Reset Save erases your local farm permanently.', x + PANEL_W / 2, y + h - 16);
    ctx.restore();
  }

  /** Small section divider, e.g. "DISPLAY" + a trailing rule. Mirrors the
   * codex / almanac / quest-log dividers so settings speaks the dialect. */
  private drawSectionHeader(
    ctx: CanvasRenderingContext2D,
    header: string,
    x: number,
    ry: number,
  ): void {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = SECTION_LABEL;
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.fillText(header, x + 16, ry + 5);
    const labelW = ctx.measureText(header).width;
    ctx.fillStyle = SECTION_RULE;
    ctx.fillRect(x + 16 + labelW + 8, ry + 9, PANEL_W - 32 - labelW - 8, 1);
  }

  /** Draw one settings row at top `ry` (height rowH). `gi` is the row's
   * global ROWS index, used for the selection highlight. */
  private drawRow(
    ctx: CanvasRenderingContext2D,
    row: RowKey,
    gi: number,
    settings: Settings,
    x: number,
    ry: number,
    rowH: number,
  ): void {
    const isSelected = gi === this.index;
    const isReset = row === 'reset';
    const showResetWarn = isReset && this.resetArmed;
    ctx.fillStyle = showResetWarn ? CONFIRM_BG : isSelected ? ROW_BG_SELECTED : ROW_BG;
    ctx.fillRect(x + 14, ry, PANEL_W - 28, rowH);
    ctx.strokeStyle = showResetWarn ? CONFIRM_BORDER : isSelected ? TITLE_COLOR : ROW_BORDER;
    ctx.lineWidth = isSelected || showResetWarn ? 2 : 1;
    ctx.strokeRect(x + 14 + 0.5, ry + 0.5, PANEL_W - 29, rowH - 1);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(rowLabel(row), x + 26, ry + 6);

    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.fillText(rowHint(row, settings, this.resetArmed), x + 26, ry + 22);

    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillStyle = ACCENT;
    ctx.textAlign = 'right';
    const valueText = rowValue(row, settings, this.resetArmed);
    ctx.fillText(valueText, x + PANEL_W - 26, ry + 10);

    // Inline value preview — a tiny swatch/glyph just LEFT of the value
    // text so the DISPLAY toggles show their effect (a dimmed night-tint
    // swatch, a scaled glyph for HUD size, a filled/hollow on-off pip)
    // instead of only a text value. The reset/close rows have no preview.
    const valueW = ctx.measureText(valueText).width;
    const previewRight = x + PANEL_W - 26 - valueW - 10;
    this.drawValuePreview(ctx, settingsRowPreview(row, settings, this.resetArmed), previewRight, ry + rowH / 2);
  }

  /**
   * Paint a value preview's pixels at right edge `rx`, vertically centred
   * on `cy`. The swatch sits in the row's value column, right-aligned so it
   * tucks left of the text value. No-op for the `none` kind (reset/close).
   */
  private drawValuePreview(
    ctx: CanvasRenderingContext2D,
    preview: SettingsRowPreview,
    rx: number,
    cy: number,
  ): void {
    switch (preview.kind) {
      case 'tint': {
        // A 16x12 swatch washed at the night-tint alpha over a pale base so
        // a heavier tint reads visibly darker. A thin border keeps a 0%
        // (fully transparent) swatch legible as an empty frame.
        const w = 16;
        const h = 12;
        const sx = rx - w;
        const sy = Math.round(cy - h / 2);
        ctx.fillStyle = '#C9B89A'; // pale daylight base
        ctx.fillRect(sx, sy, w, h);
        ctx.fillStyle = `rgba(20, 22, 48, ${preview.alpha.toFixed(2)})`;
        ctx.fillRect(sx, sy, w, h);
        ctx.strokeStyle = ROW_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1);
        break;
      }
      case 'scale': {
        // A glyph "A" sized to the HUD scale so the typography bump is
        // visible. 11px base * scale, baseline-aligned to the row centre.
        const px = Math.round(11 * preview.scale);
        ctx.fillStyle = ACCENT;
        ctx.font = `bold ${px}px ui-monospace, monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('A', rx, cy);
        ctx.textBaseline = 'top';
        break;
      }
      case 'toggle': {
        // A filled pip when on, a hollow ring when off — a glanceable
        // boolean preview beside the on/off text.
        const r = 5;
        const px = rx - r;
        ctx.lineWidth = 1;
        if (preview.on) {
          ctx.fillStyle = '#A3D77A';
          ctx.beginPath();
          ctx.arc(px, cy, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = ROW_BORDER;
          ctx.beginPath();
          ctx.arc(px, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'danger': {
        // A warning triangle with a bang, so the destructive reset row reads
        // as dangerous before the player commits. Dim while idle; once armed
        // (the two-step confirm), it brightens to the confirm red so the
        // "about to erase" state is visible in the glyph, not only the text.
        const w = 11;
        const hh = 9;
        const sx = rx - w;
        const sy = Math.round(cy - hh / 2);
        ctx.fillStyle = preview.armed ? CONFIRM_BORDER : 'rgba(224, 122, 138, 0.5)';
        // Triangle outline: a row-by-row widening band from apex to base.
        const apexX = sx + Math.floor(w / 2);
        for (let row = 0; row < hh; row++) {
          const half = Math.round((row / (hh - 1)) * (w / 2));
          const yy = sy + row;
          if (row === hh - 1) {
            // Base edge.
            ctx.fillRect(sx, yy, w, 1);
          } else {
            // Two side pixels of the triangle border.
            ctx.fillRect(apexX - half, yy, 1, 1);
            ctx.fillRect(apexX + half, yy, 1, 1);
          }
        }
        // The exclamation bang: a short stem + a dot near the base.
        ctx.fillStyle = preview.armed ? '#1A1426' : 'rgba(26, 20, 38, 0.85)';
        ctx.fillRect(apexX, sy + 3, 1, 3);
        ctx.fillRect(apexX, sy + 7, 1, 1);
        break;
      }
      case 'none':
        break;
    }
  }
}

function rowLabel(row: RowKey): string {
  switch (row) {
    case 'autoSave': return 'Auto-save on sleep';
    case 'nightTint': return 'Night tint';
    case 'hudScale': return 'HUD scale';
    case 'reduceMotion': return 'Reduce motion';
    case 'reset': return 'Reset save';
    case 'close': return 'Close menu';
  }
}

function rowHint(row: RowKey, _s: Settings, armed: boolean): string {
  switch (row) {
    case 'autoSave': return 'Write a snapshot at every day rollover.';
    case 'nightTint': return 'Dim the world overlay at dusk + night.';
    case 'hudScale': return 'Top bar + quest panel size.';
    case 'reduceMotion': return 'Hide rain + forage particle effects.';
    case 'reset':
      return armed
        ? 'Press Enter again to ERASE every saved field.'
        : 'Erase the local save file (cannot undo).';
    case 'close': return 'Dismiss this panel.';
  }
}

function rowValue(row: RowKey, s: Settings, armed: boolean): string {
  switch (row) {
    case 'autoSave': return s.autoSave ? 'on' : 'off';
    case 'nightTint': return `${Math.round(s.nightTintScale * 100)}%`;
    case 'hudScale': return `${s.hudScale.toFixed(2)}x`;
    case 'reduceMotion': return s.reduceMotion ? 'on' : 'off';
    case 'reset': return armed ? 'CONFIRM' : 'erase';
    case 'close': return '';
  }
}
