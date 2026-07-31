// Money log panel — `Q` opens a list of the last 20 gold deltas.
//
// Each row shows the day, the reason tag, and the delta in coloured
// green/red. Renders top-left like the crop journal so it doesn't fight
// the right-hand stack.

import type { Player } from '../world/world';
import { getMoneyLog, netChange, totalIn, totalOut, classifyMoneyEntry, moneyCategoryTotals, purseSavingsCaption, purseSavingsSplit, purseSavingsLow, groupMoneyEntriesByDay, applyMoneyFilter, cycleMoneyFilter, moneyFilterLabel, runningBalanceMap, purseTrend, purseSparkline, purseSparklineExtremes, purseExtremesCaption, purseArrowGlyph, type MoneyCategory, type MoneyFilter, type PurseSparklineExtremes, type PurseDirection } from '../game/money-log';
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
const GAIN = '#A3D77A';
const LOSS = '#E07A8A';
const GOLD = '#F0C24A';
const FILTER_CHIP = 'rgba(200, 182, 232, 0.7)';
/** Faint running-balance figure — dim so it trails the delta, not competes. */
const BALANCE_COLOR = 'rgba(245, 233, 212, 0.36)';

/**
 * Per-category rail colour, mirroring the toast colour-rail language:
 * sale = green (income earned), reward = violet (a gift/payout), purchase
 * = amber (money spent). Drawn as a thin left rail so a busy ledger scans
 * by hue, the same way the toast stack does.
 */
const RAIL_COLOR: Record<MoneyCategory, string> = {
  sale: '#7FB069',
  reward: '#C8A0E8',
  purchase: '#E0A24A',
};

const PANEL_W = 340;
const ROW_H = 18;
/** Day-divider band height — a small "Day N" header above each day's run. */
const DAY_DIVIDER_H = 14;
/** Purse sparkline box on the summary stripe (left of the endpoints text). */
const SPARK_W = 46;
const SPARK_H = 11;
/** Gap between the sparkline box and the endpoints text. */
const SPARK_GAP = 6;

export class MoneyLogPanel {
  private opened = false;
  private lockoutMs = 0;
  private filter: MoneyFilter = 'all';

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

  /** Active ledger filter — exposed for tests. */
  currentFilter(): MoneyFilter {
    return this.filter;
  }

  /** Cycle the category filter (all -> sales -> rewards -> spending). */
  cycleFilter(): void {
    if (!this.opened) return;
    this.filter = cycleMoneyFilter(this.filter);
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  draw(ctx: CanvasRenderingContext2D, player: Player, _canvasW: number, _canvasH: number): void {
    if (!this.opened) return;
    const log = getMoneyLog(player);
    // The ledger has rows iff the underlying log is non-empty; the active
    // filter then narrows WHICH rows show. We distinguish "you have no
    // ledger at all" (the shared empty state) from "nothing matches this
    // filter" (a filter-specific note) so a filtered-empty view isn't a
    // dead end.
    const hasAnyRows = log.length > 0;
    const filtered = applyMoneyFilter(log.slice(0, 20), this.filter);
    const rows = filtered;
    const visible = Math.max(rows.length, 1);
    // Day-group dividers add a small "Day N" band above each day's run, so
    // the panel grows by one band per distinct day in the FILTERED window.
    const dayGroups = groupMoneyEntriesByDay(filtered);
    const dividersH = rows.length === 0 ? 0 : dayGroups.length * DAY_DIVIDER_H;
    // Reserve a second line of body space for the empty state's hint.
    // When there's a ledger, reserve a footer band for the per-category
    // totals line (sales / rewards / spent) above the close hint.
    const footerH = !hasAnyRows ? 0 : 16;
    const h = 60 + (rows.length === 0 ? 2 : visible) * ROW_H + dividersH + footerH + 22;
    const x = 12;
    const y = 40;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout; reduce-motion snaps it solid.
    ctx.globalAlpha = panelOpenAlpha(this.lockoutMs, getSettings(player).reduceMotion);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillText('money log  (Q)', x + 12, y + 8);

    // Filter chip — dim pill right of the title showing the active filter
    // when it's narrowing the view, so the `f` cycle is discoverable and
    // the current scope is legible. Quiet on 'all' (no narrowing).
    if (this.filter !== 'all') {
      ctx.font = 'bold 13px ui-monospace, monospace';
      const titleW = ctx.measureText('money log  (Q)').width;
      ctx.fillStyle = FILTER_CHIP;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`- ${moneyFilterLabel(this.filter)}`, x + 12 + titleW + 8, y + 11);
    }

    ctx.fillStyle = GOLD;
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${player.gold}g on hand`, x + PANEL_W - 12, y + 9);

    // Summary stripe
    const tin = totalIn(player);
    const tout = totalOut(player);
    const net = netChange(player);
    // Purse trend — the endpoints of the logged window ("320g -> 412g") so
    // the player reads where the purse WAS vs where it IS, the span the
    // per-row running-balance column traces row by row. Drawn right-aligned
    // on the summary line, tinted by direction (gain green / loss red /
    // flat dim). Null (and so suppressed) until there are >=2 rows to span.
    // A tiny sparkline of the running balances sits just LEFT of the
    // endpoints, so the player reads the SHAPE of the window (a steady
    // climb vs a dip-and-recover) not only its two ends.
    const trend = purseTrend(player);
    const spark = purseSparkline(player);
    const sparkExtremes = purseSparklineExtremes(player);
    const trendText = trend ? `${trend.start}g -> ${trend.end}g` : '';
    ctx.font = '10px ui-monospace, monospace';
    // A 5x5 direction arrow precedes the endpoints so the move reads as a
    // shape (up/down/flat) before the text — gap + glyph + gap reserved.
    const ARROW_W = 5;
    const arrowReserve = trendText ? ARROW_W + 5 : 0;
    const trendW = trendText
      ? ctx.measureText(trendText).width + arrowReserve + 10 // +arrow +gap before in/out/net
      : 0;
    // Sparkline geometry — a small fixed box left of the endpoints, only
    // when there's a trend to show (>=2 rows). Reserved so the in/out/net
    // text clips before either the sparkline or the endpoints.
    const sparkW = spark ? SPARK_W : 0;
    const sparkGap = spark ? SPARK_GAP : 0;
    const rightReserve = trendW + sparkW + sparkGap;
    ctx.fillStyle = HINT;
    ctx.textAlign = 'left';
    // Clip the in/out/net text so it never runs into the trend cluster.
    ctx.fillText(
      `in +${tin}g  /  out -${tout}g  /  net ${net >= 0 ? '+' : ''}${net}g`,
      x + 12,
      y + 28,
      PANEL_W - 24 - rightReserve,
    );
    if (trendText && trend) {
      const trendColor =
        trend.direction === 'up' ? GAIN : trend.direction === 'down' ? LOSS : HINT;
      ctx.fillStyle = trendColor;
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(trendText, x + PANEL_W - 12, y + 28);
      const trendTextW = ctx.measureText(trendText).width;
      // Direction arrow just left of the endpoints, in the trend tint, so
      // the move reads up/down/flat from a shape before the figures.
      const arrowX = x + PANEL_W - 12 - trendTextW - ARROW_W - 4;
      this.drawArrow(ctx, trend.direction, arrowX, y + 28, trendColor);
      // Sparkline just left of the arrow, tinted to match the trend
      // direction so the cluster reads as one unit.
      if (spark) {
        const sparkRight = arrowX - SPARK_GAP;
        this.drawSparkline(ctx, spark, sparkRight - SPARK_W, y + 27, SPARK_W, SPARK_H, trendColor, sparkExtremes);
      }
    }

    // Separator
    ctx.fillStyle = 'rgba(74, 59, 110, 0.55)';
    ctx.fillRect(x + 12, y + 46, PANEL_W - 24, 1);

    // Sparkline extremes caption — names the marked peak + low in plain
    // figures ("peak 412g / low 280g") so a colour-blind player reads the
    // window's best + worst purse moments without resolving the pips. Dim +
    // centred in the gap between the stripe and the separator; only present
    // when the sparkline is (>=2 rows).
    const extCaption = purseExtremesCaption(sparkExtremes);
    if (extCaption) {
      ctx.fillStyle = BALANCE_COLOR;
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(extCaption, x + PANEL_W / 2, y + 38);
    }

    if (rows.length === 0) {
      // Distinguish a truly empty ledger from a filter that hides every
      // row: the latter gets a plain "nothing here under this filter" note
      // pointing at the `f` cycle, so the player isn't left at a dead end.
      if (!hasAnyRows) {
        drawEmptyState(ctx, PANEL_EMPTY_STATES.moneyLog, x + PANEL_W / 2, y + 58);
      } else {
        ctx.fillStyle = HINT;
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`no ${moneyFilterLabel(this.filter)} this window`, x + PANEL_W / 2, y + 60);
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(nextFilterHint(this.filter, cycleMoneyFilter, moneyFilterLabel), x + PANEL_W / 2, y + 76);
      }
    } else {
      // Walk the day groups, drawing a small "Day N  +/-net" divider above
      // each day's run so the ledger reads as dated buckets. A running ry
      // advances by a divider band then each row in the group.
      // Running-balance lookup is computed over the WHOLE log (anchored on
      // current gold) so each shown row's "= Ng" trailing figure is the
      // true purse after it posted, even when a filter hides rows between.
      const balances = runningBalanceMap(player);
      // Reserve a fixed right region for the delta + balance columns so the
      // reason text clips before it can collide with either (a 5-digit
      // balance like "= 20000g" is the widest the column gets).
      const RIGHT_RESERVE = 120;
      let ry = y + 54;
      for (const group of dayGroups) {
        this.drawDayDivider(ctx, group.day, group.net, x, ry);
        ry += DAY_DIVIDER_H;
        for (const r of group.entries) {
          // Category colour rail — a thin left bar tinted sale/reward/purchase
          // so the ledger scans by hue like the toast stack. Drawn first so
          // the reason text sits just to its right (the day stamp is now the
          // divider's job, so the row leads with the reason).
          ctx.fillStyle = RAIL_COLOR[classifyMoneyEntry(r)];
          ctx.fillRect(x + 12, ry, 3, ROW_H - 3);
          // Reason on the left, indented past the rail. Clipped to leave the
          // right reserve free for the balance + delta columns.
          ctx.fillStyle = TEXT_COLOR;
          ctx.textAlign = 'left';
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillText(r.reason, x + 22, ry + 1, PANEL_W - 22 - RIGHT_RESERVE);
          // Delta in colour on the right
          ctx.fillStyle = r.delta >= 0 ? GAIN : LOSS;
          ctx.font = 'bold 11px ui-monospace, monospace';
          ctx.textAlign = 'right';
          const tag = r.delta >= 0 ? `+${r.delta}g` : `${r.delta}g`;
          ctx.fillText(tag, x + PANEL_W - 12, ry + 1);
          // Running balance — a faint "= Ng" just left of the delta so the
          // player can trace how the purse reached its current value. Right-
          // aligned at a fixed offset so the column stays tidy down the list.
          const bal = balances.get(r);
          if (bal !== undefined) {
            ctx.fillStyle = BALANCE_COLOR;
            ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(`= ${bal}g`, x + PANEL_W - 12 - 52, ry + 2);
          }
          ry += ROW_H;
        }
      }
    }

    // Per-category totals footer — a one-line breakdown of the WHOLE
    // logged window (not the filtered slice) tinted to the rail colours
    // (sales green / rewards violet / spent amber) so the player can read
    // the shape of their economy at a glance. Shown whenever there's a
    // ledger, so it stays put even when a filter hides every row; sits
    // just above the close hint.
    if (hasAnyRows) {
      const totals = moneyCategoryTotals(player);
      const fy = y + h - 30;
      ctx.textBaseline = 'top';
      ctx.font = 'bold 10px ui-monospace, monospace';
      // Draw the three segments left-to-right, each prefixed by a small
      // swatch of its rail colour so the line reads as the same dialect
      // as the per-row rails above it.
      const segs: Array<{ color: string; text: string }> = [
        { color: RAIL_COLOR.sale, text: `sales +${totals.sales}g` },
        { color: RAIL_COLOR.reward, text: `rewards +${totals.rewards}g` },
        { color: RAIL_COLOR.purchase, text: `spent -${totals.spent}g` },
      ];
      let sx = x + 12;
      for (const seg of segs) {
        // Swatch
        ctx.fillStyle = seg.color;
        ctx.fillRect(sx, fy + 1, 3, 9);
        ctx.textAlign = 'left';
        ctx.fillText(seg.text, sx + 7, fy);
        sx += 7 + ctx.measureText(seg.text).width + 12;
      }
      // Savings-rate caption — distils the three gross figures into "kept N%
      // of income" so the player reads whether the window was thrifty or a
      // splurge without dividing the numbers. Right-aligned on the totals
      // row, dim so the per-category figures stay primary. '' (no income)
      // suppresses it; the cluster never collides since the segments clip.
      const savings = purseSavingsCaption(totals);
      if (savings) {
        ctx.fillStyle = BALANCE_COLOR;
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(savings, x + PANEL_W - 12, fy + 1);
        // Thrift mini-gauge — a thin kept/spent split bar just LEFT of the
        // caption so the savings ratio reads as a shape too: kept (sale
        // green) | spent (purchase amber), reusing the rail palette. Sits in
        // the totals-vs-caption gap; quiet when there's no income to split.
        // On a low-kept window (the player banked under a fifth of income)
        // the kept-half flips from green to the loss red so an overspend
        // reads as a COLOUR change, not just a shrinking sliver — the same
        // on/off cue the seed-warning + reset-danger glyphs use.
        const split = purseSavingsSplit(totals);
        if (split) {
          const gw = 30;
          const gh = 5;
          const capW = ctx.measureText(savings).width;
          const gx = x + PANEL_W - 12 - capW - 8 - gw;
          const gy = fy + 2;
          const keptW = Math.round(gw * split.kept);
          ctx.fillStyle = purseSavingsLow(split) ? LOSS : RAIL_COLOR.sale;
          ctx.fillRect(gx, gy, keptW, gh);
          ctx.fillStyle = RAIL_COLOR.purchase;
          ctx.fillRect(gx + keptW, gy, gw - keptW, gh);
        }
      }
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Q or Esc to close - f filter', x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }

  /**
   * Draw a tiny purse sparkline inside the box at (bx, by, bw, bh). The
   * points arrive normalised (x 0..1 left-to-right, y 0..1 low-to-high);
   * we flip y to screen space (canvas y grows downward) and inset by a 1px
   * margin so the polyline never clips the box edge. A faint baseline sits
   * under it for a sense of scale, and a small dot marks the newest (right-
   * most) point so the "where it ends" reads at a glance. Tinted to the
   * passed trend colour so the whole trend cluster reads as one unit.
   *
   * When `extremes` is supplied, the window's high + low balance vertices
   * also get a marker — a bright pip at the peak, a dim pip at the low — so
   * the player can see the window's best + worst purse moments, not just its
   * end. The endpoint dot still draws on top so "where it ends" stays clear.
   */
  /**
   * Draw a 5x5 direction arrow with its top-left near (ax, ay) in `color` —
   * an up-chevron on a gain, down on a loss, a flat bar on break-even. One
   * device pixel per glyph cell, vertically nudged so it sits on the trend
   * baseline. Reuses the pure purseArrowGlyph bitmap so shape lives in model.
   */
  private drawArrow(
    ctx: CanvasRenderingContext2D,
    direction: PurseDirection,
    ax: number,
    ay: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    for (const [cx, cy] of purseArrowGlyph(direction)) {
      ctx.fillRect(ax + cx, ay + cy, 1, 1);
    }
  }

  private drawSparkline(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    bx: number,
    by: number,
    bw: number,
    bh: number,
    color: string,
    extremes: PurseSparklineExtremes | null = null,
  ): void {
    if (points.length < 2) return;
    const m = 1; // inset margin
    const innerW = bw - 2 * m;
    const innerH = bh - 2 * m;
    const px = (x: number) => bx + m + x * innerW;
    // Flip: normalised y=1 (high balance) maps to the TOP of the box.
    const py = (y: number) => by + m + (1 - y) * innerH;
    // Faint baseline so an upward slope reads as rising off a floor.
    ctx.strokeStyle = 'rgba(74, 59, 110, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + m, by + bh - m + 0.5);
    ctx.lineTo(bx + bw - m, by + bh - m + 0.5);
    ctx.stroke();
    // The polyline itself.
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const sx = px(points[i].x);
      const sy = py(points[i].y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    // Peak + low markers — a bright pip at the window's high balance and a
    // dim pip at its low, so the extremes read without eyeballing the line.
    if (extremes) {
      ctx.fillStyle = GAIN;
      ctx.fillRect(Math.round(px(extremes.peak.x)) - 1, Math.round(py(extremes.peak.y)) - 1, 2, 2);
      ctx.fillStyle = LOSS;
      ctx.fillRect(Math.round(px(extremes.low.x)) - 1, Math.round(py(extremes.low.y)) - 1, 2, 2);
    }
    // Endpoint dot on the newest (rightmost) point — drawn last so it sits
    // on top of any coincident extreme marker.
    const last = points[points.length - 1];
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(px(last.x)) - 1, Math.round(py(last.y)) - 1, 2, 2);
  }

  /**
   * Small "Day N" divider above a day's run of rows, with a faint signed
   * net subtotal on the right so the player can read each day's bottom line
   * at a glance. Mirrors the section-divider language of the codex /
   * almanac panels (dim bold label + a trailing rule).
   */
  private drawDayDivider(
    ctx: CanvasRenderingContext2D,
    day: number,
    net: number,
    x: number,
    ry: number,
  ): void {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = DIM;
    ctx.font = 'bold 9px ui-monospace, monospace';
    const label = `DAY ${day}`;
    ctx.fillText(label, x + 12, ry + 3);
    const labelW = ctx.measureText(label).width;
    // Signed net subtotal, right-aligned and tinted like a delta but dim so
    // it reads as a summary, not a row. A 5x5 direction arrow leads it
    // (reusing purseArrowGlyph) so a day's gain/loss reads as a shape before
    // the figure, matching the trend arrow up top.
    const netTag = `${net >= 0 ? '+' : ''}${net}g`;
    const netDir: PurseDirection = net > 0 ? 'up' : net < 0 ? 'down' : 'flat';
    const netColor = net > 0 ? 'rgba(163, 215, 122, 0.6)' : net < 0 ? 'rgba(224, 122, 138, 0.6)' : DIM;
    ctx.textAlign = 'right';
    ctx.fillStyle = netColor;
    ctx.fillText(netTag, x + PANEL_W - 12, ry + 3);
    const netW = ctx.measureText(netTag).width;
    // Arrow just left of the net tag, in the net's tint.
    const arrowX = x + PANEL_W - 12 - netW - 4 - 5;
    this.drawArrow(ctx, netDir, arrowX, ry + 3, netColor);
    // A thin rule between the label and the arrow + net tag.
    ctx.fillStyle = 'rgba(74, 59, 110, 0.5)';
    ctx.fillRect(x + 12 + labelW + 8, ry + 7, PANEL_W - 24 - labelW - netW - 16 - 9, 1);
  }
}
