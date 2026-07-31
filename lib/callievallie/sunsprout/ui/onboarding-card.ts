// Onboarding card — a one-time welcome overlay on a fresh player's first
// boot. Renders the ONBOARDING_TIPS as rounded key-caps + labels in the
// same dark-violet chrome as the help overlay, dims the world behind it,
// and dismisses on the next keypress (the Game loop calls dismiss() and
// persists the seen flag). After the first dismissal it never appears
// again on this device.

import {
  ONBOARDING_TITLE,
  ONBOARDING_INTRO,
  ONBOARDING_TIPS,
  ONBOARDING_FOOTER,
} from '../game/onboarding';

const PANEL_BG = 'rgba(26, 20, 38, 0.98)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const INTRO_COLOR = 'rgba(245, 233, 212, 0.78)';
const KEY_BG = 'rgba(64, 48, 96, 0.92)';
const KEY_BORDER = '#6b5b8e';
const KEY_TEXT = '#F5E9D4';
const LABEL_COLOR = 'rgba(245, 233, 212, 0.88)';
const HINT = 'rgba(245, 233, 212, 0.6)';

const PANEL_W = 380;
const ROW_H = 26;
const PAD = 22;

export class OnboardingCard {
  private opened = false;
  /** Brief lockout so the keypress that boots the game doesn't dismiss it. */
  private lockoutMs = 0;

  open(): void {
    this.opened = true;
    this.lockoutMs = 220;
  }

  close(): void {
    this.opened = false;
  }

  isVisible(): boolean {
    return this.opened;
  }

  /** True once the brief open lockout has elapsed and a press may dismiss. */
  canDismiss(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  draw(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    if (!this.opened) return;

    const bodyH = ONBOARDING_TIPS.length * ROW_H;
    const h = PAD + 26 + 20 + bodyH + 24 + PAD;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Dim the world so the welcome reads cleanly.
    ctx.fillStyle = 'rgba(10, 6, 18, 0.55)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.fillText(ONBOARDING_TITLE, x + PANEL_W / 2, y + PAD);

    ctx.fillStyle = INTRO_COLOR;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(ONBOARDING_INTRO, x + PANEL_W / 2, y + PAD + 24);

    const bodyY = y + PAD + 24 + 22;
    for (let i = 0; i < ONBOARDING_TIPS.length; i++) {
      const tip = ONBOARDING_TIPS[i];
      const ry = bodyY + i * ROW_H;
      this.drawKeyCap(ctx, tip.keys, x + PAD + 8, ry);
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tip.label, x + PAD + 8 + 64, ry + 9);
      ctx.textBaseline = 'top';
    }

    ctx.fillStyle = HINT;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ONBOARDING_FOOTER, x + PANEL_W / 2, y + h - 28);
    ctx.restore();
  }

  /** A small rounded key-cap with the glyph centred (mirrors HelpOverlay). */
  private drawKeyCap(
    ctx: CanvasRenderingContext2D,
    keys: string,
    x: number,
    y: number,
  ): void {
    ctx.font = 'bold 11px ui-monospace, monospace';
    const capH = 18;
    const padX = 8;
    const textW = ctx.measureText(keys).width;
    const capW = Math.min(56, textW + padX * 2);
    ctx.fillStyle = KEY_BG;
    ctx.fillRect(x, y, capW, capH);
    ctx.strokeStyle = KEY_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, capW - 1, capH - 1);
    ctx.fillStyle = KEY_TEXT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(keys, x + padX, y + capH / 2, capW - padX * 2);
    ctx.textBaseline = 'top';
  }
}
