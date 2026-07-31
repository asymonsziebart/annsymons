// Owl post menu — modal for sending a gift via the village owl.
//
// Opens via `~` near the farmhouse mailbox. Up/Down picks a
// candidate, Enter dispatches the owl with the player's best gift
// for that candidate. Closes with Esc or `~`. The actual gift
// resolution is owned by ../game/owl-post.ts.

import type { Player } from '../world/world';
import { CANDIDATES } from '../game/hearts';
import { pickBestGift } from '../game/gifting';
import {
  OWL_POST_FEE,
  activeChainCountdownChip,
  chainBonusChip,
  dispatchOwl,
  isActiveChainTarget,
  owlCandidateIds,
  owlCandidateIdsForMenu,
  owlFluencyTierColor,
  owlPostFeeChip,
  owlPostFeeFor,
  previewChainLength,
  type OwlPostOutcome,
} from '../game/owl-post';
import type { TimeOfDay } from '../game/time';
import { panelOpenAlpha, MODAL_OPEN_LOCKOUT_MS } from '../game/panel-transition';
import { getSettings } from '../game/settings';

const PANEL_W = 540;
const PANEL_H = 340;
const BG = 'rgba(26, 20, 38, 0.94)';
const BORDER = '#9EB8DF';
const TITLE_COLOR = '#9EB8DF';
const ROW_BG = 'rgba(40, 30, 60, 0.85)';
const ROW_BG_SELECTED = 'rgba(108, 86, 158, 0.85)';
const ROW_BORDER = '#6b5b8e';
const TEXT = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.45)';
const GOLD = '#F0C24A';
const HINT = 'rgba(245, 233, 212, 0.55)';
/**
 * Bonus payout chip color — warm sage green, visually distinct from
 * the GOLD fee chip on the opposite end of the row. Reads as a
 * positive payout (the same tone the cart-rumor savings chip uses).
 */
const BONUS_GREEN = '#8FCC6A';
/**
 * Active-chain row halo color — same warm sage as the BONUS_GREEN
 * chip so the player's eye reads the halo + the chain bonus chip as
 * the same visual language ("this row is your active streak"). Used
 * only on the chain-target row (length >= 1 — even a freshly-started
 * length-1 chain gets the halo because it still represents the
 * player's active intent). Drawn at 60% alpha so it doesn't drown
 * out the selected-row tint when both apply at once.
 */
const CHAIN_HALO = 'rgba(143, 204, 106, 0.6)';

export class OwlMenu {
  private opened = false;
  private index = 0;
  private lockoutMs = 0;
  private flash = '';
  private flashFade = 0;
  /**
   * Snapshot of the candidate id list FOR THIS OPEN — captured on
   * open(player) so the active-chain hoist sticks while the menu is
   * open. Without the snapshot, dispatching to an NPC mid-session
   * (which moves the chain to that NPC) would re-order rows under
   * the player's selection and selectedId() would point at the wrong
   * row. Empty array when the menu has never been opened — open()
   * is the only mutation site.
   */
  private displayIds: string[] = [];

  open(player?: object): void {
    this.opened = true;
    this.index = 0;
    this.lockoutMs = MODAL_OPEN_LOCKOUT_MS;
    this.flash = '';
    this.flashFade = 0;
    // Snapshot the candidate list at open time so the row order
    // doesn't shift mid-session. When a player object is passed,
    // the active-chain target floats to the top via
    // owlCandidateIdsForMenu; without a player (older callers /
    // unit fixtures), fall back to the alphabetical default so
    // the contract stays backwards compatible.
    this.displayIds = player ? owlCandidateIdsForMenu(player) : owlCandidateIds();
  }

  close(): void {
    this.opened = false;
  }

  isVisible(): boolean {
    return this.opened;
  }

  /**
   * Returns the displayed candidate id list — snapshotted on open()
   * so mid-session chain changes don't reorder rows under the player's
   * selection. Returns the alphabetical default when the menu has
   * never been opened (defensive for callers that hit selectedId
   * pre-open).
   */
  candidateIds(): string[] {
    return this.displayIds.length > 0 ? this.displayIds : owlCandidateIds();
  }

  selectedId(): string {
    return this.candidateIds()[this.index];
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
    if (this.flashFade > 0) this.flashFade = Math.max(0, this.flashFade - dtMs);
  }

  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  selectPrev(): void {
    if (!this.opened) return;
    const n = this.candidateIds().length;
    this.index = (this.index - 1 + n) % n;
  }

  selectNext(): void {
    if (!this.opened) return;
    const n = this.candidateIds().length;
    this.index = (this.index + 1) % n;
  }

  confirm(player: Player, day: number, time?: TimeOfDay): OwlPostOutcome {
    // Snapshot the fee BEFORE dispatchOwl so the toast reports the
    // tier-discounted price the player actually paid. dispatchOwl bumps
    // the stamp book AFTER the gift lands, so reading the fee before
    // the call captures the pre-stamp tier (the tier the discount was
    // applied at). Without this snapshot the toast would over-report
    // the cost by occasionally tipping into a freshly-crossed tier.
    const fee = owlPostFeeFor(player, this.selectedId());
    const out = dispatchOwl(player, this.selectedId(), day, time);
    if (out.kind === 'sent') {
      this.setFlash(`Owl sent to ${out.npcName} (-${fee}g).`);
    } else if (out.kind === 'not-enough-gold') {
      this.setFlash(`Need ${out.need}g (have ${out.have}g).`);
    } else if (out.kind === 'already-today') {
      this.setFlash(`Already gifted ${out.npcName} today.`);
    } else if (out.kind === 'no-items') {
      this.setFlash(`Nothing nice to send ${out.npcName}.`);
    }
    return out;
  }

  private setFlash(s: string): void {
    this.flash = s;
    this.flashFade = 1800;
  }

  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number, day?: number): void {
    if (!this.opened) return;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - PANEL_H) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Open fade-in eased off the lockout, the same hook the info-panel
    // family + hearts use; reduce-motion snaps it solid. Scoped by the
    // save/restore so the scrim + panel ease in together.
    ctx.globalAlpha = panelOpenAlpha(
      this.lockoutMs,
      getSettings(player).reduceMotion,
      MODAL_OPEN_LOCKOUT_MS,
    );
    ctx.fillStyle = 'rgba(10, 6, 18, 0.45)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = BG;
    ctx.fillRect(x, y, PANEL_W, PANEL_H);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, PANEL_W - 2, PANEL_H - 2);
    ctx.fillStyle = BORDER;
    ctx.fillRect(x + 4, y + 4, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + 4, 4, 4);
    ctx.fillRect(x + 4, y + PANEL_H - 8, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + PANEL_H - 8, 4, 4);

    ctx.font = 'bold 16px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillStyle = TITLE_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Owl Post', x + 18, y + 14);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.fillText(`Send a gift across the valley for ${OWL_POST_FEE}g.`, x + 18, y + 36);
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(`${player.gold}g`, x + PANEL_W - 18, y + 18);

    const rowH = 50;
    const rowsTop = y + 64;
    const ids = this.candidateIds();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const def = CANDIDATES[id];
      const giftKey = pickBestGift(player.inventory, id);
      const rowX = x + 14;
      const rowY = rowsTop + i * (rowH + 4);
      const rowW = PANEL_W - 28;
      const selected = i === this.index;
      ctx.fillStyle = selected ? ROW_BG_SELECTED : ROW_BG;
      ctx.fillRect(rowX, rowY, rowW, rowH);
      // Active-chain row halo — distinct outline tint so the player
      // sees AT A GLANCE which row is their active streak target,
      // independent of the row-position sort that hoists it to row 0.
      // The halo color matches the chain-bonus chip green so the two
      // visual cues read as the same language ("this row is your
      // active streak"). When the row is ALSO selected, the halo
      // overrides the BORDER outline so the player gets the strongest
      // possible signal — selected + active chain = both indicators
      // collapse into one bold sage outline rather than a stack.
      const isChainTarget = isActiveChainTarget(player, id);
      if (isChainTarget) {
        ctx.strokeStyle = CHAIN_HALO;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = selected ? BORDER : ROW_BORDER;
        ctx.lineWidth = selected ? 2 : 1;
      }
      ctx.strokeRect(rowX + 0.5, rowY + 0.5, rowW - 1, rowH - 1);

      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.fillStyle = TEXT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      // Per-NPC owl fluency tier color chip — bronze/silver/gold dot
      // drawn just LEFT of the NPC name, mirroring the lore Folk row
      // chip. Skipped when below the first tier so casual recipients
      // keep a clean row. Closes the loop on the chip pattern —
      // tier color now shows up on BOTH the lore Folk row AND the
      // owl-menu row so the player reads "fluency rank" at a glance
      // from either surface.
      const tierColor = owlFluencyTierColor(player, id);
      let nameX = rowX + 10;
      if (tierColor) {
        ctx.fillStyle = '#1a1426';
        ctx.fillRect(rowX + 10, rowY + 10, 8, 8);
        ctx.fillStyle = tierColor;
        ctx.fillRect(rowX + 11, rowY + 11, 6, 6);
        nameX = rowX + 24;
        ctx.fillStyle = TEXT;
      }
      ctx.fillText(def.name, nameX, rowY + 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = giftKey ? GOLD : DIM;
      ctx.fillText(giftKey ? `gift: ${giftKey}` : 'no gift on hand', rowX + rowW - 10, rowY + 8);

      // Per-row hearts summary if available.
      const heartsRow = player.hearts?.[id];
      const hearts = heartsRow ? Math.floor(heartsRow.points / 100) : 0;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = HINT;
      ctx.textAlign = 'left';
      // Pending letter-chain preview — surfaces what chain length the
      // player would land at if they pressed Enter NOW. Only drawn
      // when the preview is >= 2 (a fresh-start chain at length 1 is
      // the floor — no signal worth surfacing). Lives next to the
      // existing hearts label so the player can scan both at once.
      let heartsLine = `hearts: ${hearts}`;
      if (typeof day === 'number') {
        const pendingChain = previewChainLength(player, id, day);
        if (pendingChain >= 2) {
          heartsLine = `${heartsLine}  ·  chain: ${pendingChain}`;
        }
      }
      ctx.fillText(heartsLine, rowX + 10, rowY + 28);
      // Per-NPC chain-bonus payout chip — surfaces the heart-points
      // multiplier the player would lock in if they sent NOW. Drawn
      // in green to read as a positive payout and visually distinct
      // from the gold-tinted fee chip on the opposite end of the row.
      // Skipped when the preview chain is below the bonus floor so
      // casual recipients keep a clean row.
      if (typeof day === 'number') {
        const bonusChip = chainBonusChip(player, id, day);
        if (bonusChip) {
          // Measure the hearts line so the bonus chip lands just after
          // it without overlapping; small left padding keeps the two
          // labels readable. ctx is already at 11px monospace from
          // the hearts label paint.
          const heartsW = ctx.measureText(heartsLine).width;
          ctx.fillStyle = BONUS_GREEN;
          ctx.fillText(bonusChip, rowX + 10 + heartsW + 14, rowY + 28);
        }
        // Active-chain countdown chip — surfaces the CURRENT chain
        // length (not the previewed-next length) on the active chain
        // target row. Reinforces the halo signal with an explicit
        // numeric count so the player reads "you're on a 3-day streak
        // with Maple" without having to do the +1 math the bonus chip
        // would require. Drawn in BONUS_GREEN (same sage as the halo
        // and bonus chip) so all three visual cues read as the same
        // "active streak" language. Length-1 streaks DO get the chip
        // because chainBonusChip doesn't fire there — this fills the
        // "streak exists but no bonus yet" gap. Drawn next to the
        // chain bonus chip when both are showing; alone when only the
        // streak chip applies.
        const streakChip = activeChainCountdownChip(player, id, day);
        if (streakChip) {
          const heartsW = ctx.measureText(heartsLine).width;
          // Bonus chip width measurement so the streak chip doesn't
          // overlap when both fire (length >= 2). Pass empty string
          // when no bonus chip so the offset collapses cleanly.
          const bonusChip = chainBonusChip(player, id, day);
          const bonusOffset = bonusChip ? ctx.measureText(bonusChip).width + 10 : 0;
          ctx.fillStyle = BONUS_GREEN;
          ctx.fillText(streakChip, rowX + 10 + heartsW + 14 + bonusOffset, rowY + 28);
        }
      }
      // Per-NPC fee chip — surfaces the tier-discounted price so the
      // player can SEE the savings before pressing Enter. Drawn on
      // the row's right edge under the gift label. The chip turns
      // gold when discounted (visual cue that you've earned a perk)
      // and stays dim/text when at full price.
      const chip = owlPostFeeChip(player, id);
      const isDiscounted = owlPostFeeFor(player, id) < OWL_POST_FEE;
      ctx.textAlign = 'right';
      ctx.fillStyle = isDiscounted ? GOLD : HINT;
      ctx.fillText(chip, rowX + rowW - 10, rowY + 28);
      const todayUsed = heartsRow && heartsRow.lastGiftDay >= 0 ? heartsRow.lastGiftDay : -1;
      void todayUsed;
    }

    if (this.flashFade > 0 && this.flash) {
      const alpha = Math.min(1, this.flashFade / 600);
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = `rgba(245, 233, 212, ${alpha.toFixed(2)})`;
      ctx.textAlign = 'center';
      ctx.fillText(this.flash, x + PANEL_W / 2, y + PANEL_H - 44);
    }

    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.textAlign = 'center';
    ctx.fillText('Up/Down to choose · Enter to send · Esc to leave', x + PANEL_W / 2, y + PANEL_H - 22);

    ctx.restore();
  }
}
