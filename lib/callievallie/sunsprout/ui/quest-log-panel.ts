// Quest log panel — `'` toggles a panel listing active + completed quests
// with progress bars, hints, and reward lines. Matches the design language
// of AchievementsPanel and MoneyLogPanel so the cozy panel family stays
// consistent.
//
// Rows are grouped under ACTIVE / DONE section dividers (active first) so
// the log reads as "what I'm working on / what I've finished" instead of
// one flat scroll keyed only by a pip colour. Headers + rows flatten into
// one display-item list scrolled over a fixed pixel budget, so the panel
// height never jumps as a divider scrolls in or out.

import type { Player } from '../world/world';
import {
  buildQuestLog,
  questCounts,
  questLogSections,
  questProgressSummary,
  questBoardProgress,
  questBoardFraction,
  questActiveRemaining,
  questRemainingLabel,
  applyQuestFilter,
  cycleQuestFilter,
  questFilterLabel,
  rewardGlyphColor,
  rewardGlyphCountTag,
  type QuestLogEntry,
  type QuestFilter,
  type RewardGlyphKind,
} from '../game/quest-log';
import { PANEL_EMPTY_STATES, nextFilterHint } from '../game/panel-empty';
import { drawEmptyState } from './empty-state';
import { panelOpenAlpha } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const ACCENT = '#F0C24A';
const DONE_PIP = '#A3D77A';
const ACTIVE_PIP = '#F0C24A';
const SECTION_LINE = 'rgba(74, 59, 110, 0.6)';
const SECTION_RULE = 'rgba(74, 59, 110, 0.5)';
const FILTER_CHIP = 'rgba(200, 182, 232, 0.7)';

const PANEL_W = 460;
const ROW_H = 46;
/** Section-divider band height (label + breathing room). */
const SECTION_H = 18;
/** Header progress-summary band — "X% done - next: <quest>" caption + bar. */
const SUMMARY_H = 26;
/** Fixed body budget — holds ~6 quest rows plus both dividers. */
const BODY_H = 6 * ROW_H + 2 * SECTION_H;

/** One drawable line in the scrolled body: a divider or a quest row. */
type DisplayItem =
  | { kind: 'header'; header: string; count: number }
  | { kind: 'row'; row: QuestLogEntry };

export class QuestLogPanel {
  private opened = false;
  private lockoutMs = 0;
  private scroll = 0;
  /** Panel-local status filter. Resets to 'all' on open. */
  private filter: QuestFilter = 'all';

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

  /** Active status filter — exposed for tests. */
  currentFilter(): QuestFilter {
    return this.filter;
  }

  /** Cycle the status filter (all -> active -> done). Resets scroll. */
  cycleFilter(): void {
    if (!this.opened) return;
    this.filter = cycleQuestFilter(this.filter);
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

  /** Flatten the active/done sections into one scrollable line list. */
  private displayItems(player: Player): DisplayItem[] {
    const filtered = applyQuestFilter(buildQuestLog(player), this.filter);
    const sections = questLogSections(filtered);
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
    const rows = buildQuestLog(player);
    const counts = questCounts(player);
    const items = this.displayItems(player);
    this.scroll = Math.min(this.scroll, this.maxScroll(items));
    const start = this.scroll;
    const visN = this.visibleCountFrom(items, start);
    const end = start + visN;

    // The whole board having quests vs. the active FILTER hiding every row
    // are different empty states: the former shows the shared empty panel,
    // the latter a "nothing X - press f" note so the player isn't stranded.
    const hasAnyRows = rows.length > 0;
    const filterEmpty = hasAnyRows && items.length === 0;
    const showEmpty = !hasAnyRows || filterEmpty;

    // Empty board / filtered-empty reserves two body rows for the message +
    // hint; otherwise the fixed body budget keeps the panel height constant.
    // A progress summary band sits under the header whenever there are quests.
    const summary = questProgressSummary(player);
    const summaryH = rows.length === 0 ? 0 : SUMMARY_H;
    const bodyH = showEmpty ? 2 * ROW_H : BODY_H;
    const h = 70 + summaryH + bodyH + 22;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout; reduce-motion snaps it solid.
    ctx.globalAlpha = panelOpenAlpha(this.lockoutMs, getSettings(player).reduceMotion);
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
    ctx.fillText("quest log  ( ' )", x + 14, y + 12);

    // Filter chip — dim pill right of the title when the filter narrows the
    // view, so the `f` cycle is discoverable. Quiet on 'all' (no narrowing).
    if (this.filter !== 'all') {
      ctx.font = 'bold 14px ui-monospace, monospace';
      const titleW = ctx.measureText("quest log  ( ' )").width;
      ctx.fillStyle = FILTER_CHIP;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`- ${questFilterLabel(this.filter)}`, x + 14 + titleW + 8, y + 15);
    }

    ctx.fillStyle = DIM;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${counts.completed}/${counts.total} done`, x + PANEL_W - 14, y + 14);

    // Progress summary caption — overall completion percent + the active
    // quest nearest to done, so the player sees how far the whole board is
    // AND what they're about to finish. Only when there are quests; the
    // divider + body shift down by SUMMARY_H to match.
    if (rows.length > 0) {
      const pctText = `${summary.completedPct}% complete`;
      const nextText = summary.closest
        ? `  -  next: ${summary.closest.name} (${summary.closest.progress}/${summary.closest.goal})`
        : '  -  all quests complete';
      ctx.textAlign = 'left';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.fillStyle = ACCENT;
      ctx.fillText(pctText, x + 14, y + 32);
      const pctW = ctx.measureText(pctText).width;
      ctx.font = '10px ui-monospace, monospace';
      // Active-quest pip — a 4px gold dot before the "next:" header text
      // echoing the active row's pip, so the closest quest's header + row
      // read as one accent. Only when a closest quest exists (a clear board
      // shows "all quests complete" with no target to pip). Sits in the
      // "  -  " gap so the title figure never shifts.
      if (summary.closest) {
        ctx.fillStyle = ACTIVE_PIP;
        ctx.fillRect(x + 14 + pctW + 8, y + 33, 4, 4);
      }
      ctx.fillStyle = HINT;
      ctx.fillText(nextText, x + 14 + pctW, y + 32);
      // Remaining-work caption — "3 quests, 11 steps left" right-aligned on
      // the pct line, pairing the board bar's visual fill with the figure of
      // effort still ahead. Quiet when the board is fully clear (no active
      // quests). Reserves room so it never collides with the next-up text.
      const remaining = questRemainingLabel(questActiveRemaining(player));
      if (remaining) {
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillStyle = DIM;
        ctx.textAlign = 'right';
        ctx.fillText(remaining, x + PANEL_W - 14, y + 33);
        ctx.textAlign = 'left';
      }
      // Thin whole-board progress bar — the SUM of every quest's progress
      // over the sum of every goal, so even an all-active board shows real
      // momentum the binary %-done count can't. Drawn as a faint track +
      // accent fill, with a "47 / 80 steps" cap on the right.
      const board = questBoardProgress(player);
      if (board.total > 0) {
        const frac = questBoardFraction(board);
        const trackX = x + 14;
        const trackW = PANEL_W - 28;
        const barY = y + 46;
        ctx.fillStyle = 'rgba(40, 30, 60, 0.85)';
        ctx.fillRect(trackX, barY, trackW, 4);
        ctx.fillStyle = ACCENT;
        ctx.fillRect(trackX, barY, Math.round(trackW * frac), 4);
        ctx.fillStyle = DIM;
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${board.done} / ${board.total} steps`, x + PANEL_W - 14, y + 47);
      }
    }

    // Section divider under the header — keeps the title tidy.
    ctx.fillStyle = SECTION_LINE;
    ctx.fillRect(x + 14, y + 38 + summaryH, PANEL_W - 28, 1);

    if (showEmpty) {
      if (filterEmpty) {
        // The board has quests but the filter hid them all — a plain note
        // pointing at the `f` cycle AND naming where the next press lands.
        ctx.fillStyle = HINT;
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`no ${questFilterLabel(this.filter)} quests`, x + PANEL_W / 2, y + 56 + summaryH);
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(nextFilterHint(this.filter, cycleQuestFilter, questFilterLabel), x + PANEL_W / 2, y + 72 + summaryH);
      } else {
        drawEmptyState(ctx, PANEL_EMPTY_STATES.questLog, x + PANEL_W / 2, y + 58);
      }
    } else {
      // Walk the visible display items, drawing ACTIVE / DONE dividers +
      // quest rows in one pass so the groups stay legible while scrolling.
      let ry = y + 50 + summaryH;
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

    if (start > 0 || end < items.length) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const top = start === 0 ? '' : 'up ';
      const bot = end >= items.length ? '' : 'down';
      ctx.fillText(`${top}${bot}`.trim(), x + PANEL_W / 2, y + h - 30);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    const closeHint = hasAnyRows
      ? "' or Esc to close - w/s scroll - f filter"
      : "' or Esc to close - arrows or w/s to scroll";
    ctx.fillText(closeHint, x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }

  /** Small section divider, e.g. "ACTIVE  2" + a trailing rule. */
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
    ctx.fillText(label, x + 14, ry + 5);
    const labelW = ctx.measureText(label).width;
    ctx.fillStyle = SECTION_RULE;
    ctx.fillRect(x + 14 + labelW + 8, ry + 9, PANEL_W - 28 - labelW - 8, 1);
  }

  /** Draw one quest row at top `ry` (height ROW_H). */
  private drawRow(
    ctx: CanvasRenderingContext2D,
    r: QuestLogEntry,
    x: number,
    ry: number,
  ): void {
    // Pip color: gold for active, green for done.
    ctx.fillStyle = r.status === 'completed' ? DONE_PIP : ACTIVE_PIP;
    ctx.fillRect(x + 14, ry + 12, 6, 6);
    // Title row
    ctx.fillStyle = r.status === 'completed' ? DIM : TEXT_COLOR;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(r.name, x + 28, ry + 4);
    // Hint / description line
    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(r.hint, x + 28, ry + 18);
    // Reward line — right side. A small glyph pip (coin / crate / star)
    // sits just LEFT of the text per reward segment so the board scans like
    // the bag, not as a wall of "+50g, +3 tomato" strings. The reward TEXT
    // keeps the row's earned/active tint, but each PIP is tinted by its own
    // kind (coin gold / crate green / star violet — the toast-rail palette)
    // so the reward type reads from the hues alone; a completed quest drops
    // every pip to one dim tint so the earned reward recedes.
    const done = r.status === 'completed';
    const rewardColor = done ? DONE_PIP : ACCENT;
    ctx.fillStyle = rewardColor;
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(r.rewardLine, x + PANEL_W - 14, ry + 6);
    const rewardW = ctx.measureText(r.rewardLine).width;
    // Lay the pips left-to-right just LEFT of the text, in the same order
    // formatReward lists the segments — so the leftmost pip is the first
    // thing the text names (gold, then items, then cosmetic). The cluster's
    // right edge sits a small gap before the text's left edge.
    const GLYPH_W = 7;
    const GLYPH_GAP = 3;
    const pips = r.rewardGlyphs;
    if (pips.length > 0) {
      const clusterW = pips.length * GLYPH_W + (pips.length - 1) * GLYPH_GAP;
      const textLeft = x + PANEL_W - 14 - rewardW;
      let gx = textLeft - 6 - clusterW;
      for (const kind of pips) {
        this.drawRewardGlyph(ctx, kind, gx, ry + 3, rewardGlyphColor(kind, done));
        gx += GLYPH_W + GLYPH_GAP;
      }
      // "xN" count tag just LEFT of a busy cluster (3+ pips) so the player
      // reads the payout count without tallying pips; quiet for 1-2 pips.
      const tag = rewardGlyphCountTag(pips);
      if (tag) {
        ctx.fillStyle = done ? DONE_PIP : rewardColor;
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        const clusterLeft = textLeft - 6 - clusterW;
        ctx.fillText(tag, clusterLeft - 3, ry + 6);
      }
    }
    // Progress bar
    const barW = PANEL_W - 56;
    const barX = x + 28;
    const barY = ry + 30;
    ctx.fillStyle = 'rgba(40, 30, 60, 0.85)';
    ctx.fillRect(barX, barY, barW, 6);
    const filledW = Math.max(0, Math.min(barW, (r.progress / r.goal) * barW));
    ctx.fillStyle = r.status === 'completed' ? DONE_PIP : ACTIVE_PIP;
    ctx.fillRect(barX, barY, filledW, 6);
    ctx.fillStyle = DIM;
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${r.progress}/${r.goal}`, x + PANEL_W - 14, barY - 1);
  }

  /**
   * Draw one ~7x7 reward pip at (gx, gy) in `color`: a coin for gold, a
   * crate for an item payout, a star for a cosmetic unlock. Tiny hand-placed
   * pixel silhouettes in the same monochrome-glyph spirit as the bag glyphs
   * (single tint, no emoji), so the reward line scans at a glance.
   */
  private drawRewardGlyph(
    ctx: CanvasRenderingContext2D,
    kind: RewardGlyphKind,
    gx: number,
    gy: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    if (kind === 'gold') {
      // Coin — a filled 5x5 disc with a centre notch knocked out.
      const coin = [
        [1, 0], [2, 0], [3, 0],
        [0, 1], [1, 1], [3, 1], [4, 1],
        [0, 2], [2, 2], [4, 2],
        [0, 3], [1, 3], [3, 3], [4, 3],
        [1, 4], [2, 4], [3, 4],
      ];
      for (const [px, py] of coin) ctx.fillRect(gx + 1 + px, gy + py, 1, 1);
    } else if (kind === 'item') {
      // Crate — a 6x6 box outline with a diagonal slat.
      const crate = [
        [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [0, 1], [5, 1],
        [0, 2], [2, 2], [3, 2], [5, 2],
        [0, 3], [2, 3], [3, 3], [5, 3],
        [0, 4], [5, 4],
        [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5],
      ];
      for (const [px, py] of crate) ctx.fillRect(gx + px, gy + py, 1, 1);
    } else {
      // Star — a 5x5 plus/diamond burst.
      const star = [
        [2, 0],
        [1, 1], [2, 1], [3, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
        [1, 3], [2, 3], [3, 3],
        [0, 4], [4, 4],
      ];
      for (const [px, py] of star) ctx.fillRect(gx + 1 + px, gy + py, 1, 1);
    }
  }
}
