// Achievements panel — `V` toggles a list of earned + locked badges.
//
// Layout: centred modal-ish panel, not too big — sits on top of the
// world but doesn't block movement. Rows are grouped under EARNED /
// LOCKED section dividers (earned first) so the badge list reads as
// "what I've unlocked / what's still ahead" instead of one flat scroll
// keyed only by a pip colour. Earned rows show the "done" copy + the
// day they landed; locked rows show the teaser hint. A small progress
// meter sits in the top right of the panel.
//
// The list scrolls (26+ badges), so headers + rows are flattened into
// one display-item list and scrolled together over a fixed pixel budget
// — the panel height never jumps as a divider scrolls in or out.

import type { Player } from '../world/world';
import {
  buildAchievements,
  achievementSections,
  achievementsNextUp,
  achievementsNextUpLine,
  applyAchievementFilter,
  cycleAchievementFilter,
  achievementFilterLabel,
  type AchievementRow,
  type AchievementFilter,
} from '../game/achievements';
import { ribbonHallCaption } from '../game/ribbon-hall';
import { nextFilterHint } from '../game/panel-empty';
import { panelOpenAlpha } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const EARNED_PIP = '#F0C24A';
const LOCKED_PIP = '#7a6a9a';
const RIBBON_CAPTION = '#E8B23A';
const NEXTUP_CAPTION = 'rgba(245, 233, 212, 0.6)';
const SECTION_RULE = 'rgba(74, 59, 110, 0.5)';
const FILTER_CHIP = 'rgba(200, 182, 232, 0.7)';

const PANEL_W = 440;
const ROW_H = 30;
/** Section-divider band height (label + a touch of breathing room). */
const SECTION_H = 20;
/**
 * Fixed body budget in pixels — sized to hold ~8 badge rows plus both
 * section dividers so the player still sees a healthy page, and the
 * panel height stays constant no matter where the scroll sits.
 */
const BODY_H = 8 * ROW_H + 2 * SECTION_H;

/** One drawable line in the scrolled body: a divider or a badge row. */
type DisplayItem =
  | { kind: 'header'; header: string; count: number }
  | { kind: 'row'; row: AchievementRow };

export class AchievementsPanel {
  private opened = false;
  private lockoutMs = 0;
  private scroll = 0;
  /** Panel-local earn-state filter. Resets to 'all' on open. */
  private filter: AchievementFilter = 'all';

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.scroll = 0;
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

  /** Active earn-state filter — exposed for tests. */
  currentFilter(): AchievementFilter {
    return this.filter;
  }

  /** Cycle the earn-state filter (all -> earned -> locked). Resets scroll. */
  cycleFilter(): void {
    if (!this.opened) return;
    this.filter = cycleAchievementFilter(this.filter);
    this.scroll = 0;
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  scrollDown(player: Player): void {
    if (!this.opened) return;
    const items = this.displayItems(player);
    this.scroll = Math.min(this.maxScroll(items), this.scroll + 1);
  }

  scrollUp(): void {
    if (!this.opened) return;
    this.scroll = Math.max(0, this.scroll - 1);
  }

  /** Flatten the (filtered) earned/locked sections into one line list. */
  private displayItems(player: Player): DisplayItem[] {
    const filtered = applyAchievementFilter(buildAchievements(player), this.filter);
    const sections = achievementSections(filtered);
    const items: DisplayItem[] = [];
    for (const s of sections) {
      items.push({ kind: 'header', header: s.header, count: s.rows.length });
      for (const row of s.rows) items.push({ kind: 'row', row });
    }
    return items;
  }

  /** Pixel height of a single display item. */
  private itemHeight(item: DisplayItem): number {
    return item.kind === 'header' ? SECTION_H : ROW_H;
  }

  /** How many items fit in the body budget starting at `start`. */
  private visibleCountFrom(items: DisplayItem[], start: number): number {
    let used = 0;
    let n = 0;
    for (let i = start; i < items.length; i++) {
      const ih = this.itemHeight(items[i]);
      if (used + ih > BODY_H) break;
      used += ih;
      n++;
    }
    return n;
  }

  /** Smallest scroll index that still reaches the last item. */
  private maxScroll(items: DisplayItem[]): number {
    for (let start = 0; start < items.length; start++) {
      if (start + this.visibleCountFrom(items, start) >= items.length) return start;
    }
    return Math.max(0, items.length - 1);
  }

  /** Render the panel. No-op when closed. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const rows = buildAchievements(player);
    const items = this.displayItems(player);
    // Clamp scroll defensively in case the earn-state shifted while open.
    this.scroll = Math.min(this.scroll, this.maxScroll(items));
    const start = this.scroll;
    const visN = this.visibleCountFrom(items, start);
    const end = start + visN;

    // The catalog is never empty, so the only way the body empties is a
    // filter that hides every row (e.g. "earned" on a fresh save). That
    // gets a plain note pointing at the `f` cycle instead of a blank panel.
    const filterEmpty = items.length === 0;

    const caption = ribbonHallCaption(player);
    const captionH = caption ? 18 : 0;
    // Next-up digest band under the title — names the next locked badge +
    // the earned/remaining tally so the player has a goal at a glance. The
    // header already shows the bare earned/total fraction top-right; this
    // adds the actionable "next" target. Always present (the catalog is
    // never empty), so it's a fixed band that offsets the body.
    const nextUpLine = achievementsNextUpLine(achievementsNextUp(rows));
    const nextUpH = nextUpLine ? 16 : 0;
    // A filter that empties the list reserves two body rows for the note;
    // otherwise the fixed body budget keeps the panel height constant.
    const bodyH = filterEmpty ? 2 * ROW_H : BODY_H;
    const h = 40 + nextUpH + bodyH + 22 + captionH;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in — eased alpha off the open lockout so the panel glides
    // in over its first ~160ms; reduce-motion snaps it solid. Scoped to
    // this panel's save()/restore() so it never leaks to other draws.
    ctx.globalAlpha = panelOpenAlpha(this.lockoutMs, getSettings(player).reduceMotion);
    // Soft dim behind so the badges read well.
    ctx.fillStyle = 'rgba(10, 6, 18, 0.32)';
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
    ctx.fillText('achievements  (V)', x + 14, y + 12);

    // Filter chip — dim pill right of the title when the filter narrows the
    // view, so the `f` cycle is discoverable. Quiet on 'all' (no narrowing).
    if (this.filter !== 'all') {
      ctx.font = 'bold 14px ui-monospace, monospace';
      const titleW = ctx.measureText('achievements  (V)').width;
      ctx.fillStyle = FILTER_CHIP;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`- ${achievementFilterLabel(this.filter)}`, x + 14 + titleW + 8, y + 15);
    }

    const earned = rows.filter((r) => r.earned).length;
    ctx.fillStyle = DIM;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${earned}/${rows.length}`, x + PANEL_W - 14, y + 14);

    // Next-up caption — dim digest under the title naming the badge the
    // player is closest to (next locked in display order). Drawn in the
    // band the body offset reserves.
    if (nextUpLine) {
      ctx.fillStyle = NEXTUP_CAPTION;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(nextUpLine, x + 14, y + 32);
    }

    if (filterEmpty) {
      // A filter (earned on a fresh save / locked at 100%) hid every row —
      // a plain note pointing at the `f` cycle AND naming where it lands.
      ctx.fillStyle = HINT;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`no ${achievementFilterLabel(this.filter)} badges`, x + PANEL_W / 2, y + 48 + nextUpH);
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(nextFilterHint(this.filter, cycleAchievementFilter, achievementFilterLabel), x + PANEL_W / 2, y + 64 + nextUpH);
    } else {
      // Walk the visible display items, drawing dividers + rows in one pass
      // so the EARNED / LOCKED groups stay legible while the list scrolls.
      let ry = y + 40 + nextUpH;
      for (let i = start; i < end; i++) {
        const item = items[i];
        if (item.kind === 'header') {
          this.drawSectionHeader(ctx, item.header, item.count, x, ry);
        } else {
          this.drawRow(ctx, item.row, x, ry);
        }
        ry += this.itemHeight(item);
      }
    }

    // Scroll indicator if the list is taller than the visible window.
    if (start > 0 || end < items.length) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const top = start === 0 ? '' : 'up ';
      const bot = end >= items.length ? '' : 'down';
      ctx.fillText(`${top}${bot}`.trim(), x + PANEL_W / 2, y + h - 30);
    }

    // Ribbon-hall caption — names the tournament rosettes mounted on the
    // farmhouse wall in plain words, so the tiny pixel medals are legible
    // to a player who can't make them out. Sits on its own line above the
    // scroll indicator + close hint. Only when at least one is shown.
    if (caption) {
      ctx.fillStyle = RIBBON_CAPTION;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(caption, x + PANEL_W / 2, y + h - 46);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('V / Esc to close - w/s scroll - f filter', x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }

  /** Small section divider, e.g. "EARNED  7" + a trailing rule. */
  private drawSectionHeader(
    ctx: CanvasRenderingContext2D,
    header: string,
    count: number,
    x: number,
    ry: number,
  ): void {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = DIM;
    ctx.font = 'bold 9px ui-monospace, monospace';
    const label = `${header}  ${count}`;
    ctx.fillText(label, x + 14, ry + 7);
    // A thin rule trailing off to the right so the divider reads as a
    // section break without shouting (mirrors the codex / almanac).
    const labelW = ctx.measureText(label).width;
    ctx.fillStyle = SECTION_RULE;
    ctx.fillRect(x + 14 + labelW + 8, ry + 11, PANEL_W - 28 - labelW - 8, 1);
  }

  /** Draw one badge row at top `ry` (height ROW_H). */
  private drawRow(
    ctx: CanvasRenderingContext2D,
    r: AchievementRow,
    x: number,
    ry: number,
  ): void {
    // Pip
    ctx.fillStyle = r.earned ? EARNED_PIP : LOCKED_PIP;
    ctx.fillRect(x + 14, ry + 8, 6, 6);

    ctx.fillStyle = r.earned ? TEXT_COLOR : DIM;
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(r.name, x + 28, ry + 2);

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(r.description, x + 28, ry + 16);

    if (r.earned && r.earnedDay !== null) {
      ctx.fillStyle = EARNED_PIP;
      ctx.textAlign = 'right';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`day ${r.earnedDay}`, x + PANEL_W - 14, ry + 6);
    }
  }
}
