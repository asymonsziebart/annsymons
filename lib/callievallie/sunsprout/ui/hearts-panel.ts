// Hearts panel — `H` toggles a relationships screen for the four
// candidates.
//
// Originally (slice 4 of v0.5.0) this was a bare name + heart-strip list.
// It now reads as a real relationships screen: each row carries the heart
// pips, a soft next-birthday countdown (so the player can plan the 8x
// gift day), a "loves" hint naming a couple of the candidate's adored
// gifts, and a status chip when the player is engaged or married to them.
// Rows sort by closeness (married/engaged first, then hearts, then the
// soonest birthday) so the people you care about most rise to the top.
//
// The heavy lifting is a pure `relationshipRows(player, time)` builder
// that the panel and unit tests share; the draw method is a thin layer.
// `heartsSummary` is kept untouched for back-compat with its callers/test.

import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import {
  CANDIDATES,
  MAX_HEARTS,
  getHearts,
  type GiftTaste,
  type HeartsState,
} from '../game/hearts';
import { giftReadiness } from '../game/gifting';
import { daysUntilBirthday } from '../game/birthdays';
import { spouseOf } from '../game/marriage';
import { fianceOf } from '../game/engagement';
import { giftKeyGlyph } from '../game/bag-glyph';
import { drawBagGlyph } from '../render/bag-glyph-sprite';
import { panelOpenAlpha } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_BG = 'rgba(26, 20, 38, 0.92)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const ACCENT = '#F5C9A0';
const HEART_FULL = '#E25C7A';
const HEART_EMPTY = '#3a2a4a';
const BDAY_COLOR = '#9FB0D0';
const BDAY_SOON = '#F0C24A';
const LOVE_HINT = 'rgba(245, 233, 212, 0.5)';
const STATUS_WED = '#E47ACF';
const STATUS_RING = '#A3D77A';
const HINT = 'rgba(245, 233, 212, 0.55)';
const SORT_CHIP = 'rgba(200, 182, 232, 0.7)';

/** Pure summary helper — used by older callers and the panel test. */
export interface HeartsRow {
  id: string;
  name: string;
  hearts: number;
  max: number;
}

export function heartsSummary(state: HeartsState | undefined): HeartsRow[] {
  const out: HeartsRow[] = [];
  for (const id of Object.keys(CANDIDATES)) {
    const def = CANDIDATES[id];
    out.push({
      id,
      name: def.name,
      hearts: state ? getHearts(state, id) : 0,
      max: MAX_HEARTS,
    });
  }
  return out;
}

/** Relationship status with a specific candidate. */
export type RelationshipStatus = 'single' | 'engaged' | 'married';

/** A full relationships-screen row: hearts + birthday + taste + status. */
export interface RelationshipRow {
  id: string;
  name: string;
  hearts: number;
  max: number;
  /** Days until this candidate's birthday (0 = today). */
  daysUntilBirthday: number;
  /** Glanceable countdown label, e.g. "birthday today" / "birthday in 5d". */
  birthdayLine: string;
  /** Short "loves ..." hint naming up to two adored gifts. */
  lovedHint: string;
  /**
   * Raw key of the first adored gift whose glyph resolves to a real
   * catalog sprite, or null when none of this candidate's loves have a
   * drawable pip (e.g. off-catalog tokens like frog / amethyst). The
   * panel draws this glyph in place of the "loves" bullet so the player
   * recognises the gift at a glance.
   */
  lovedGlyphKey: string | null;
  status: RelationshipStatus;
  /**
   * True when the player is carrying a giftable item for this candidate
   * AND hasn't gifted them today — i.e. a `G` press right now would land.
   * Surfaced as a chip so the player can court without trial-and-error.
   */
  giftReady: boolean;
  /** Taste tier of the gift the `G` press would pick, for the chip tint. */
  giftTaste: GiftTaste | null;
}

/** Prettify a gift inventory key into a short human label. */
export function prettyGiftKey(key: string): string {
  let k = key;
  if (k.endsWith('_harvest')) k = k.slice(0, -'_harvest'.length);
  if (k.startsWith('dish-')) k = k.slice('dish-'.length);
  return k.replace(/[-_]+/g, ' ');
}

/** Format a days-until-birthday count into a calm one-line countdown. */
export function birthdayCountdownLabel(days: number): string {
  if (days <= 0) return 'birthday today';
  if (days === 1) return 'birthday tomorrow';
  return `birthday in ${days}d`;
}

/** Days within which a birthday counts as "soon" — the 8x gift window worth
 * planning a loved gift for. Mirrors the summary header's 14-day threshold. */
export const BIRTHDAY_SOON_DAYS = 14;

/**
 * Whether a candidate's birthday is close enough to plan an 8x gift for, so
 * the panel can mark the row with a warm pip the way a gift-ready row gets
 * one. True within BIRTHDAY_SOON_DAYS (today included). Pure.
 */
export function birthdaySoon(days: number): boolean {
  return days >= 0 && days <= BIRTHDAY_SOON_DAYS;
}

/**
 * Pick the first adored-gift key (from the candidate's loved list) that
 * resolves to a real catalog sprite, so the panel can draw a recognisable
 * pip beside the "loves" hint. Returns null when none of the loves have a
 * drawable glyph (e.g. off-catalog tokens like frog / amethyst). Pure.
 */
export function lovedGlyphKeyFor(loved: readonly string[]): string | null {
  for (const key of loved) {
    if (giftKeyGlyph(key)) return key;
  }
  return null;
}

/**
 * Build the rich relationship rows. Pure: reads Player.hearts, the
 * birthday calendar, and the engagement / marriage state, then sorts by
 * closeness so the people the player is investing in lead the list:
 *   married first, then engaged, then by hearts (desc), then by the
 *   soonest birthday, then name for a stable final tie-break.
 */
export function relationshipRows(
  player: Player,
  time: TimeOfDay,
): RelationshipRow[] {
  const spouse = spouseOf(player);
  const fiance = fianceOf(player);
  const rows: RelationshipRow[] = Object.keys(CANDIDATES).map((id) => {
    const def = CANDIDATES[id];
    const status: RelationshipStatus =
      spouse === id ? 'married' : fiance === id ? 'engaged' : 'single';
    const days = daysUntilBirthday(id, time);
    const loved = def.loved.slice(0, 2).map(prettyGiftKey).join(', ');
    const ready = giftReadiness(player, id, time.day);
    return {
      id,
      name: def.name,
      hearts: player.hearts ? getHearts(player.hearts, id) : 0,
      max: MAX_HEARTS,
      daysUntilBirthday: days,
      birthdayLine: birthdayCountdownLabel(days),
      lovedHint: loved ? `loves ${loved}` : '',
      lovedGlyphKey: lovedGlyphKeyFor(def.loved),
      status,
      giftReady: ready.ready,
      giftTaste: ready.taste,
    };
  });
  const rank = (s: RelationshipStatus) =>
    s === 'married' ? 0 : s === 'engaged' ? 1 : 2;
  rows.sort((a, b) => {
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    if (a.hearts !== b.hearts) return b.hearts - a.hearts;
    if (a.daysUntilBirthday !== b.daysUntilBirthday) {
      return a.daysUntilBirthday - b.daysUntilBirthday;
    }
    return a.name.localeCompare(b.name);
  });
  return rows;
}

/**
 * How the relationships screen is ordered. 'closeness' is the canonical
 * order relationshipRows() returns (married > engaged > hearts > soonest
 * birthday > name). 'birthday' re-orders for gift PLANNING — soonest
 * birthday first — so the player can line up the 8x gift day. Cycled with
 * a panel-local `f`.
 */
export type RelationshipSortMode = 'closeness' | 'birthday';

/** Cycle order for the panel-local `f` keypress. */
export const RELATIONSHIP_SORT_MODES: readonly RelationshipSortMode[] = [
  'closeness',
  'birthday',
] as const;

/** Advance to the next sort mode, wrapping at the end. Pure. */
export function cycleRelationshipSort(m: RelationshipSortMode): RelationshipSortMode {
  const i = RELATIONSHIP_SORT_MODES.indexOf(m);
  return RELATIONSHIP_SORT_MODES[(i + 1) % RELATIONSHIP_SORT_MODES.length];
}

/** Short chip label for the active sort mode. Pure. */
export function relationshipSortLabel(m: RelationshipSortMode): string {
  return m === 'birthday' ? 'by birthday' : 'by closeness';
}

/**
 * Return a re-sorted COPY of the relationship rows for DISPLAY. 'closeness'
 * is the identity order (the rows already arrive closeness-sorted), so it
 * returns a shallow copy unchanged. 'birthday' sorts by the soonest
 * birthday first, tie-broken by hearts (desc) then name, so the gift-
 * planning view groups the people whose 8x day is closest at the top.
 *
 * Crucially this is a SEPARATE display sort: relationshipRows() stays
 * canonically closeness-ordered so relationshipSummary()'s "closest =
 * rows[0]" digest stays correct regardless of the player's chosen view.
 * Pure — never mutates the input.
 */
export function sortRelationshipRows(
  rows: readonly RelationshipRow[],
  mode: RelationshipSortMode,
): RelationshipRow[] {
  const copy = rows.slice();
  if (mode === 'closeness') return copy;
  copy.sort((a, b) => {
    if (a.daysUntilBirthday !== b.daysUntilBirthday) {
      return a.daysUntilBirthday - b.daysUntilBirthday;
    }
    if (a.hearts !== b.hearts) return b.hearts - a.hearts;
    return a.name.localeCompare(b.name);
  });
  return copy;
}

/**
 * Glance-level digest of the whole relationships screen — the summary
 * cousin of the quest-log %-complete and almanac count-summary headers.
 * Surfaces who the player is closest to, how many marriages / engagements
 * are on the books, and the single soonest birthday across everyone so
 * the player doesn't have to scan all four rows to find the next 8x gift
 * day. Pure: derives entirely from the already-built relationship rows.
 */
export interface RelationshipSummary {
  /** The closest candidate (rows are pre-sorted by closeness), or null. */
  closest: { name: string; hearts: number; max: number } | null;
  /** How many candidates the player has married / is engaged to. */
  married: number;
  engaged: number;
  /** The soonest upcoming birthday across all candidates, or null. */
  nextBirthday: { name: string; days: number } | null;
  /** How many candidates a gift would land on right now (carried + ungifted). */
  giftReady: number;
}

export function relationshipSummary(
  rows: readonly RelationshipRow[],
): RelationshipSummary {
  if (rows.length === 0) {
    return { closest: null, married: 0, engaged: 0, nextBirthday: null, giftReady: 0 };
  }
  // rows[0] is the closest by the existing closeness sort.
  const closest = { name: rows[0].name, hearts: rows[0].hearts, max: rows[0].max };
  let married = 0;
  let engaged = 0;
  let giftReady = 0;
  let nextBirthday: { name: string; days: number } | null = null;
  for (const r of rows) {
    if (r.status === 'married') married += 1;
    else if (r.status === 'engaged') engaged += 1;
    if (r.giftReady) giftReady += 1;
    if (nextBirthday === null || r.daysUntilBirthday < nextBirthday.days) {
      nextBirthday = { name: r.name, days: r.daysUntilBirthday };
    }
  }
  return { closest, married, engaged, nextBirthday, giftReady };
}

/**
 * Render the relationship summary as one compact caption line. Always
 * leads with the closest candidate; then appends the single most useful
 * second segment — an imminent birthday (within 14 days, since that's the
 * actionable 8x gift window) takes priority over a marriage/engagement
 * tally so the time-sensitive cue wins. '' when there are no rows (the
 * panel then draws no caption + collapses the band). Pure.
 */
export function relationshipSummaryLine(s: RelationshipSummary): string {
  if (!s.closest) return '';
  const segs = [`closest ${s.closest.name} ${s.closest.hearts}/${s.closest.max}`];
  // One second segment, most-useful-first so the line stays panel-width:
  // an imminent birthday (the actionable 8x window) wins, else how many
  // candidates a gift would land on today, else the wed/vow tally.
  if (s.nextBirthday && s.nextBirthday.days <= 14) {
    const d = s.nextBirthday.days;
    const when = d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `${d}d`;
    // Drop the repeated name when the soonest birthday belongs to the
    // person we just named as closest (common on a fresh save where the
    // closeness tie breaks on birthday), so the line doesn't stutter.
    const who = s.nextBirthday.name === s.closest.name ? '' : `${s.nextBirthday.name} `;
    segs.push(`${who}bday ${when}`);
  } else if (s.giftReady > 0) {
    segs.push(`${s.giftReady} gift-ready`);
  } else if (s.married > 0 || s.engaged > 0) {
    const tags: string[] = [];
    if (s.married > 0) tags.push(`${s.married} wed`);
    if (s.engaged > 0) tags.push(`${s.engaged} vow`);
    segs.push(tags.join(', '));
  }
  return segs.join('  -  ');
}

/** Short status chip label, or '' for a single candidate. */
export function statusChipLabel(status: RelationshipStatus): string {
  if (status === 'married') return 'wed';
  if (status === 'engaged') return 'vow';
  return '';
}

/**
 * Tiny chip text for a gift-ready candidate, tinted by how much they'll
 * love the best item in the player's bag. '' when nothing is ready (the
 * panel then draws no chip). Kept under ~10 chars so it tucks beside the
 * birthday line without crowding the loves hint.
 */
export function giftChipLabel(row: RelationshipRow): string {
  if (!row.giftReady) return '';
  if (row.giftTaste === 'loved') return 'loved gift';
  if (row.giftTaste === 'liked') return 'liked gift';
  return 'gift ready';
}

/** Chip rail colour by taste — loved warmest, neutral coolest. */
const GIFT_CHIP_COLOR: Record<GiftTaste, string> = {
  loved: '#E25C7A',
  liked: '#F0C24A',
  neutral: '#A3D77A',
  disliked: '#9D8FB8',
};

/** Chip rail colour for a row's ready gift, or a neutral fallback. */
export function giftChipColor(taste: GiftTaste | null): string {
  return taste ? GIFT_CHIP_COLOR[taste] : GIFT_CHIP_COLOR.neutral;
}

/** Draw a single pixel heart at (x,y), filled or empty. */
function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  filled: boolean,
): void {
  ctx.fillStyle = filled ? HEART_FULL : HEART_EMPTY;
  // 7x6 chubby heart shape.
  const pixels = [
    [1, 0], [2, 0], [4, 0], [5, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
    [2, 4], [3, 4], [4, 4],
    [3, 5],
  ];
  for (const [px, py] of pixels) ctx.fillRect(x + px, y + py, 1, 1);
}

/**
 * The relationships overlay (`H`) as a class panel, so it joins the shared
 * panelOpenAlpha fade family the way every other class panel does — the one
 * overlay that used to be a bare stateless function with no open clock now
 * eases in like its peers and gains a canAct lockout for free. The heavy
 * lifting is still the pure relationshipRows() / sortRelationshipRows()
 * builders above; this owns only the open/close/sort state + the draw.
 */
export class HeartsPanel {
  private opened = false;
  private lockoutMs = 0;
  /** Row sort: closeness (default) or by-birthday for gift planning. */
  private sortMode: RelationshipSortMode = 'closeness';

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    // Reset to the default closeness order each time the panel opens.
    this.sortMode = 'closeness';
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

  /** Active row sort — exposed for tests. */
  currentSort(): RelationshipSortMode {
    return this.sortMode;
  }

  /** Cycle the row sort (closeness <-> by-birthday). */
  cycleSort(): void {
    if (!this.opened) return;
    this.sortMode = cycleRelationshipSort(this.sortMode);
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  /** Render the relationships panel. No-op when closed. */
  draw(
    ctx: CanvasRenderingContext2D,
    player: Player,
    canvasW: number,
    time: TimeOfDay,
  ): void {
    if (!this.opened) return;
    const sortMode = this.sortMode;
    // Canonical closeness order — the summary digest reads rows[0] as the
    // closest, so it must see this order regardless of the display sort.
    const canonical = relationshipRows(player, time);
    if (canonical.length === 0) return;

    // Glance-level summary caption under the title — the digest cousin of
    // the quest-log %-complete + almanac count-summary headers. Present
    // only when there are rows (always, here), so the band offsets the
    // first row by a fixed summaryH the same way the other panels do.
    const summaryLine = relationshipSummaryLine(relationshipSummary(canonical));
    const summaryH = summaryLine ? 14 : 0;

    // Display order — a re-sorted COPY so the player can flip to a gift-
    // planning (soonest-birthday-first) view without disturbing the summary.
    const rows = sortRelationshipRows(canonical, sortMode);

    const w = 264;
    const rowH = 34;
    const h = 32 + summaryH + rows.length * rowH + 6;
    const x = canvasW - w - 12;
    const y = 40;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout; reduce-motion snaps it solid —
    // the same hook every other class panel uses, scoped by save/restore.
    ctx.globalAlpha = panelOpenAlpha(this.lockoutMs, getSettings(player).reduceMotion);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.fillStyle = ACCENT;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('relationships  (H)', x + 8, y + 6);

    // Sort-mode chip — right of the title, surfaced only when the player has
    // flipped off the default closeness order so the `f` toggle is legible
    // without shouting on the common view.
    if (sortMode !== 'closeness') {
      ctx.fillStyle = SORT_CHIP;
      ctx.font = '8px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(relationshipSortLabel(sortMode), x + w - 8, y + 8);
      ctx.textAlign = 'left';
    }

    // Summary caption — dim digest line, drawn in the band under the title.
    if (summaryLine) {
      ctx.fillStyle = HINT;
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText(summaryLine, x + 8, y + 20);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ry = y + 26 + summaryH + i * rowH;

      // Line 1: name (+ status chip) on the left, heart strip on the right.
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = TEXT_COLOR;
      ctx.textAlign = 'left';
      ctx.fillText(row.name, x + 8, ry);

      const chip = statusChipLabel(row.status);
      if (chip) {
        const nameW = ctx.measureText(row.name).width;
        const chipX = x + 8 + nameW + 6;
        ctx.font = 'bold 8px ui-monospace, monospace';
        const chipColor = row.status === 'married' ? STATUS_WED : STATUS_RING;
        const cw = ctx.measureText(chip).width + 6;
        ctx.fillStyle = 'rgba(40, 30, 60, 0.9)';
        ctx.fillRect(chipX, ry - 1, cw, 11);
        ctx.strokeStyle = chipColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(chipX + 0.5, ry - 0.5, cw - 1, 10);
        ctx.fillStyle = chipColor;
        ctx.fillText(chip, chipX + 3, ry + 1);
      }

      // Heart strip right-aligned: 10 small hearts, ~8px apart.
      const stripX = x + w - 8 - row.max * 8;
      for (let hi = 0; hi < row.max; hi++) {
        drawHeart(ctx, stripX + hi * 8, ry + 1, hi < row.hearts);
      }

      // Line 2: birthday countdown (left, warmer when soon) + loves hint.
      const sy = ry + 16;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      // A warm 4px pip leads the line when the birthday sits inside the 8x
      // gift window, mirroring the gift-ready row dot so both per-row planning
      // cues read together: the pip says "plan a gift", the dot says "gift's
      // ready now". Quiet outside the window; the text indents to clear it.
      const soon = birthdaySoon(row.daysUntilBirthday);
      let bdayX = x + 8;
      if (soon) {
        ctx.fillStyle = BDAY_SOON;
        ctx.fillRect(x + 8, sy + 2, 4, 4);
        bdayX = x + 8 + 7;
      }
      ctx.fillStyle = row.daysUntilBirthday <= 1 ? BDAY_SOON : BDAY_COLOR;
      ctx.fillText(row.birthdayLine, bdayX, sy);
      const line2X = bdayX + ctx.measureText(row.birthdayLine).width + 6;
      // Gift-ready chip — right-aligned on line 2 so the player can see who
      // a `G` press would land on, tinted by how loved the best bag item is.
      const giftChip = giftChipLabel(row);
      if (giftChip) {
        ctx.font = 'bold 8px ui-monospace, monospace';
        const gc = giftChipColor(row.giftTaste);
        const gw = ctx.measureText(giftChip).width + 6;
        const gx = x + w - 8 - gw;
        ctx.fillStyle = 'rgba(40, 30, 60, 0.9)';
        ctx.fillRect(gx, sy - 1, gw, 11);
        ctx.fillStyle = gc;
        ctx.fillRect(gx, sy - 1, 2, 11); // left rail accent
        ctx.fillText(giftChip, gx + 4, sy + 1);
        // Tiny taste-tinted pip just LEFT of the chip so a gift-ready row
        // carries the same dot the header tally counts — the per-row state
        // matches the "N gift-ready" digest at a glance. Dropped if it would
        // crowd the panel edge.
        if (gx - 7 > x + 8) {
          ctx.fillRect(gx - 7, sy + 2, 4, 4);
        }
      }
      if (row.lovedHint) {
        // Clip the loves hint short of the gift chip so they never overlap.
        const hintMaxX = giftChip ? x + w - 8 - 64 : x + w - 8;
        // Draw the actual loved-item glyph in place of the bullet when one
        // of this candidate's adored gifts has a drawable catalog sprite,
        // so the player recognises the gift at a glance instead of reading
        // the name. Falls back to the "·" bullet for off-catalog loves.
        const glyph = row.lovedGlyphKey ? giftKeyGlyph(row.lovedGlyphKey) : null;
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillStyle = LOVE_HINT;
        ctx.textAlign = 'left';
        if (glyph) {
          drawBagGlyph(ctx, line2X + 5, sy + 4, glyph);
          ctx.fillText(
            row.lovedHint,
            line2X + 13,
            sy,
            Math.max(0, hintMaxX - (line2X + 13)),
          );
        } else {
          ctx.fillText(`· ${row.lovedHint}`, line2X, sy, Math.max(0, hintMaxX - line2X));
        }
      }
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('H to close - f sort', x + w / 2, y + h - 13);
    ctx.restore();
  }
}
