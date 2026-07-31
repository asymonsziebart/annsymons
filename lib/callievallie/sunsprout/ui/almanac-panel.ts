// Almanac panel — `0` toggles a two-week agenda of upcoming village
// events: festivals, NPC birthdays, Pip's cart visits and the seasonal
// friendship tournament, all in one place so the player can plan ahead
// (save a loved gift for a birthday, stock crops before the harvest
// festival, walk to the well for the contest). Same panel chrome as the
// other overlays. Data comes from the pure almanac.ts aggregator.

import type { TimeOfDay } from '../game/time';
import type { Player } from '../world/world';
import {
  buildAlmanac,
  whenLabel,
  dateLabel,
  almanacSections,
  applyAlmanacFilter,
  nextAlmanacFilter,
  almanacFilterLabel,
  almanacFilterKinds,
  almanacKindGlyph,
  almanacTodayGlyphKind,
  almanacTodayCount,
  almanacTodayChip,
  almanacSectionChip,
  almanacSectionBusiestKind,
  almanacCountSummary,
  almanacLookAhead,
  almanacLookAheadLine,
  almanacLookAheadGlyphKind,
  type AlmanacEntry,
  type AlmanacFilter,
  type AlmanacKind,
} from '../game/almanac';
import { panelOpenAlpha } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_BG = 'rgba(26, 20, 38, 0.97)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const TODAY = '#A3D77A';
/** Soft sage wash behind the TODAY section so "right now" pops. */
const TODAY_BAND = 'rgba(163, 215, 122, 0.10)';
const FILTER_CHIP = '#C8A0E8';

/** Per-kind accent colour + one-letter tag for the left rail. */
const KIND_STYLE: Record<AlmanacKind, { color: string; tag: string }> = {
  personal: { color: '#E25C7A', tag: 'M' },
  festival: { color: '#9ECDB5', tag: 'F' },
  birthday: { color: '#F5C9A0', tag: 'B' },
  cart: { color: '#C8923A', tag: 'P' },
  tournament: { color: '#C8A0E8', tag: 'T' },
};

const PANEL_W = 400;
const ROW_H = 34;
const HEADER_H = 44;
/** Extra header band for the per-kind count summary, when there's one. */
const SUMMARY_H = 16;
const SECTION_H = 18;
/** Footer band: filter chip (y+h-30) + close hint (y+h-14) + padding. */
const FOOTER_H = 40;

export class AlmanacPanel {
  private opened = false;
  private lockoutMs = 0;
  /** Active kind-filter. Resets to 'all' on open. */
  private filter: AlmanacFilter = 'all';

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.filter = 'all';
  }

  close(): void {
    this.opened = false;
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

  /** Cycle the kind-filter (all -> village -> birthdays -> personal). */
  cycleFilter(): void {
    if (!this.opened) return;
    this.filter = nextAlmanacFilter(this.filter);
  }

  /** Read-only filter accessor — used by tests. */
  currentFilter(): AlmanacFilter {
    return this.filter;
  }

  draw(ctx: CanvasRenderingContext2D, time: TimeOfDay, canvasW: number, canvasH: number, player?: Player): void {
    if (!this.opened) return;
    const allEntries = buildAlmanac(time, undefined, player);
    const entries = applyAlmanacFilter(allEntries, this.filter);
    const sections = almanacSections(entries);
    const bodyRows = Math.max(entries.length, 1);
    // Per-kind count summary ("2 birthdays, 1 festival ... in view"), tallied
    // over the FILTERED list so it agrees with what's actually shown. Empty
    // when nothing's in view, in which case the header band collapses.
    const summary = almanacCountSummary(entries);
    const summaryH = summary ? SUMMARY_H : 0;
    // Each section adds a small divider header above its rows; a footer
    // band holds the filter chip + close hint.
    const h = HEADER_H + summaryH + bodyRows * ROW_H + sections.length * SECTION_H + FOOTER_H;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout; reduce-motion snaps it solid.
    // player is optional here (HUD chip path), so fall back to no calm flag.
    ctx.globalAlpha = panelOpenAlpha(
      this.lockoutMs,
      player ? getSettings(player).reduceMotion : false,
    );
    ctx.fillStyle = 'rgba(10, 6, 18, 0.42)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText('almanac  (0)', x + 16, y + 12);

    ctx.fillStyle = DIM;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('next 2 weeks', x + PANEL_W - 16, y + 15);

    // Per-kind count summary under the title — the shape of the fortnight
    // at a glance ("2 birthdays, 1 festival, 1 hangout in view"). Only when
    // something's in view; the body offsets down by SUMMARY_H to match.
    if (summary) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(summary, x + 16, y + HEADER_H - 14);
    }
    const bodyY = y + HEADER_H + summaryH;

    if (entries.length === 0) {
      // Distinguish a genuinely quiet calendar from a filter that simply
      // hid everything, so the player knows the agenda isn't broken — just
      // narrowed.
      const quiet = allEntries.length === 0;
      const empty = quiet
        ? 'A quiet stretch ahead — nothing on the calendar.'
        : `Nothing ${almanacFilterLabel(this.filter)} in the next two weeks.`;
      ctx.fillStyle = DIM;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(empty, x + PANEL_W / 2, bodyY + 8);
      // Peek PAST the two-week horizon so an empty agenda still earns its
      // keep — name the soonest matching event ("next: Vallie's birthday in
      // 19 days"). Honours the active filter, so this is most useful when
      // the player narrows to e.g. birthdays and none land this fortnight
      // (the unfiltered fortnight is essentially never empty — Pip's cart
      // alone visits every 7 days).
      const lookAhead = almanacLookAhead(time, this.filter, player);
      const ahead = almanacLookAheadLine(lookAhead);
      if (ahead) {
        // Echo the look-ahead event's kind glyph large + very faint behind
        // the line, mirroring the TODAY band watermark: a calm empty agenda
        // still carries the cake/tent/cart/rosette/heart symbol of what's
        // next, so the player reads its category at a glance. Drawn BEFORE
        // the text so the line sits on top.
        const echoKind = almanacLookAheadGlyphKind(lookAhead);
        if (echoKind) {
          ctx.save();
          ctx.globalAlpha *= 0.1;
          ctx.translate(x + PANEL_W / 2 - 16, bodyY + 16);
          ctx.scale(6.4, 6.4);
          this.drawKindGlyph(ctx, echoKind, KIND_STYLE[echoKind].color, 0, 0);
          ctx.restore();
        }
        ctx.fillStyle = TODAY;
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillText(ahead, x + PANEL_W / 2, bodyY + 24);
      }
    } else {
      // Walk the sections, drawing a small TODAY / THIS WEEK / LATER
      // divider above each group so the agenda reads as buckets rather
      // than one long countdown. The TODAY group additionally gets a soft
      // highlight band behind its rows + a warm left rail, so "what's
      // happening right now" pops out of the agenda instead of reading
      // like any other countdown row.
      let cy = bodyY;
      for (const section of sections) {
        if (section.key === 'today') {
          // Soft tint band + left rail spanning the TODAY divider + its
          // rows, drawn BEFORE the header/rows so the text sits on top.
          const bandH = SECTION_H + section.entries.length * ROW_H;
          ctx.fillStyle = TODAY_BAND;
          ctx.fillRect(x + 10, cy + 2, PANEL_W - 20, bandH - 4);
          ctx.fillStyle = TODAY;
          ctx.fillRect(x + 10, cy + 2, 2, bandH - 4);
          // Echo the soonest TODAY event's kind glyph large + very faint on
          // the band's right side, so "what's happening right now" carries
          // its kind icon as a watermark behind the rows — the cake/tent/
          // cart/rosette/heart symbol ties the band to its category at a
          // glance without competing with the text. Reuses the same 5x5
          // bitmap the row pips use, scaled up and washed to a whisper.
          const watermark = almanacTodayGlyphKind(section.entries);
          if (watermark) {
            ctx.save();
            ctx.globalAlpha *= 0.10;
            ctx.translate(x + PANEL_W - 54, cy + 2 + (bandH - 4) / 2 - 16);
            ctx.scale(6.4, 6.4);
            this.drawKindGlyph(ctx, watermark, KIND_STYLE[watermark].color, 0, 0);
            ctx.restore();
          }
        }
        this.drawSectionHeader(ctx, section.header, x, cy);
        // "N today" weight chip on a busy day — right-aligned on the TODAY
        // divider when 2+ events stack, so the player reads the day's load
        // without counting rows. Quiet for a single event. Like the THIS
        // WEEK / LATER chips, it leads with the bucket's busiest-kind glyph
        // (cake / tent / cart / rosette / heart) so all three divider chips
        // speak the same icon language — but in the warm TODAY green, not the
        // dim ink, since "right now" stays the urgent one.
        if (section.key === 'today') {
          const chip = almanacTodayChip(almanacTodayCount(section.entries));
          if (chip) {
            ctx.font = 'bold 9px ui-monospace, monospace';
            ctx.textAlign = 'right';
            const chipW = ctx.measureText(chip).width;
            ctx.fillStyle = TODAY;
            ctx.fillText(chip, x + PANEL_W - 16, cy + 5);
            const busiest = almanacSectionBusiestKind(section.entries);
            if (busiest) {
              // 5px glyph + a 4px gap left of the chip text's left edge, in
              // the TODAY green so the chip reads as one urgent cluster.
              const glyphX = x + PANEL_W - 16 - chipW - 4 - 5;
              this.drawKindGlyph(ctx, busiest, TODAY, glyphX, cy + 6);
            }
            ctx.textAlign = 'left';
          }
        } else {
          // THIS WEEK / LATER buckets get the same weight chip in dim ink
          // (they're not urgent like TODAY), so every divider reads its load
          // at a glance. Quiet below 2 rows. The chip leads with the bucket's
          // busiest kind glyph (cake / tent / cart / rosette / heart) in that
          // kind's rail colour, so the chip says WHAT the bucket is mostly
          // made of, not only how many — the same glyph language as the rows.
          const chip = almanacSectionChip(section.key, section.entries.length);
          if (chip) {
            ctx.font = 'bold 9px ui-monospace, monospace';
            ctx.textAlign = 'right';
            const chipW = ctx.measureText(chip).width;
            ctx.fillStyle = DIM;
            ctx.fillText(chip, x + PANEL_W - 16, cy + 5);
            const busiest = almanacSectionBusiestKind(section.entries);
            if (busiest) {
              // 5px glyph + a 4px gap left of the chip text's left edge.
              const glyphX = x + PANEL_W - 16 - chipW - 4 - 5;
              this.drawKindGlyph(ctx, busiest, KIND_STYLE[busiest].color, glyphX, cy + 6);
            }
            ctx.textAlign = 'left';
          }
        }
        cy += SECTION_H;
        for (let i = 0; i < section.entries.length; i++) {
          this.drawRow(ctx, section.entries[i], x, cy, i > 0);
          cy += ROW_H;
        }
      }
    }

    // Filter chip — surfaces even on 'all' so the `f` cycle is discoverable,
    // and shows how many of the full agenda the active filter is showing.
    // A small row of per-kind colour pips sits just left of the chip text,
    // previewing WHAT the active filter admits (the kinds it keeps) using
    // the same KIND_STYLE rail colours the rows use — so the player reads
    // the filter's scope as colour, not only the label word.
    const chipText = `filter: ${almanacFilterLabel(this.filter)} (${entries.length}/${allEntries.length})  -  f to cycle`;
    ctx.font = 'bold 10px ui-monospace, monospace';
    const chipTextW = ctx.measureText(chipText).width;
    const kinds = almanacFilterKinds(this.filter);
    const PIP = 6;
    const PIP_GAP = 2;
    const pipsW = kinds.length * PIP + Math.max(0, kinds.length - 1) * PIP_GAP;
    const PIP_TEXT_GAP = 8;
    const clusterW = pipsW + (pipsW > 0 ? PIP_TEXT_GAP : 0) + chipTextW;
    const clusterLeft = x + PANEL_W / 2 - clusterW / 2;
    // Pips first, vertically centred against the chip text baseline. Each
    // pip is the kind's own 5x5 glyph (cake / tent / cart / rosette / heart)
    // in its rail colour, so the filter preview reads as the SAME icon
    // language as the rows it admits, not just a flat swatch.
    let pipX = clusterLeft;
    const pipY = y + h - 30 + 1;
    for (const kind of kinds) {
      this.drawKindGlyph(ctx, kind, KIND_STYLE[kind].color, pipX, pipY);
      pipX += PIP + PIP_GAP;
    }
    ctx.fillStyle = FILTER_CHIP;
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(chipText, clusterLeft + pipsW + (pipsW > 0 ? PIP_TEXT_GAP : 0), y + h - 30);

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0 or Esc to close', x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }

  /** Small section divider header, e.g. "TODAY" / "THIS WEEK" / "LATER". */
  private drawSectionHeader(
    ctx: CanvasRenderingContext2D,
    header: string,
    x: number,
    ry: number,
  ): void {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = DIM;
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.fillText(header, x + 16, ry + 5);
    // A thin rule trailing off to the right of the label, so the divider
    // reads as a section break without shouting.
    ctx.font = 'bold 9px ui-monospace, monospace';
    const labelW = ctx.measureText(header).width;
    ctx.fillStyle = 'rgba(74, 59, 110, 0.5)';
    ctx.fillRect(x + 16 + labelW + 8, ry + 9, PANEL_W - 28 - labelW - 8, 1);
  }

  private drawRow(
    ctx: CanvasRenderingContext2D,
    e: AlmanacEntry,
    x: number,
    ry: number,
    separator: boolean,
  ): void {
    const style = KIND_STYLE[e.kind];
    if (separator) {
      ctx.fillStyle = 'rgba(74, 59, 110, 0.5)';
      ctx.fillRect(x + 14, ry, PANEL_W - 28, 1);
    }
    // Left rail accent bar + kind glyph. A tiny 5x5 pixel symbol (cake /
    // tent / cart / rosette / heart) in the kind's rail colour replaces the
    // old one-letter tag (B/F/P/T/M) so the row's category reads as a
    // recognisable icon at a glance, matching the bag + quest glyph
    // language. The glyph sits where the letter did so the title column
    // never shifts.
    ctx.fillStyle = style.color;
    ctx.fillRect(x + 14, ry + 8, 3, ROW_H - 14);
    this.drawKindGlyph(ctx, e.kind, style.color, x + 21, ry + 9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Title + detail.
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(e.title, x + 38, ry + 11);
    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(e.detail, x + 38, ry + 23);

    // Right: when + date stamp.
    const today = e.daysUntil <= 0;
    ctx.textAlign = 'right';
    ctx.fillStyle = today ? TODAY : '#C8B6E8';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(whenLabel(e.daysUntil), x + PANEL_W - 16, ry + 11);
    ctx.fillStyle = DIM;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(dateLabel(e.season, e.day), x + PANEL_W - 16, ry + 23);

    ctx.textBaseline = 'top';
  }

  /**
   * Draw a kind's 5x5 pixel glyph with its top-left at (gx, gy) in `color`.
   * The cells come from the pure almanacKindGlyph bitmap so the symbol shape
   * lives in the model and the panel only paints it — same split as the
   * shop-banner / bag-glyph sprites. Each cell is one device pixel; the 5x5
   * grid tucks neatly beside the rail bar where the letter tag used to sit.
   */
  private drawKindGlyph(
    ctx: CanvasRenderingContext2D,
    kind: AlmanacKind,
    color: string,
    gx: number,
    gy: number,
  ): void {
    ctx.fillStyle = color;
    for (const [cx, cy] of almanacKindGlyph(kind)) {
      ctx.fillRect(gx + cx, gy + cy, 1, 1);
    }
  }
}
