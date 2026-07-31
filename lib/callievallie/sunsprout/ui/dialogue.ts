// Dialogue box. Opens when the player presses E next to an NPC; shows a
// speech panel pinned to the bottom-centre of the viewport with the
// NPC's name, role, and a single warm line. Tap any key (or E again) to
// close.

const PANEL_W = 640;
const PANEL_H = 120;
const BG = 'rgba(26, 20, 38, 0.92)';
const BORDER = '#F5C9A0';
const NAME_COLOR = '#F5C9A0';
const ROLE_COLOR = '#C8B4E8';
const BODY_COLOR = '#F5E9D4';
const HINT_COLOR = 'rgba(245, 233, 212, 0.5)';

/** Wraps `text` to lines of at most `maxChars` characters at word boundaries.
 *  Hard `\n` characters split paragraphs so a multi-line letter renders with
 *  its blank line preserved. */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let cur = '';
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if (candidate.length > maxChars) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = candidate;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

export class DialogueBox {
  private isOpen = false;
  private name = '';
  private role = '';
  private line = '';
  private elapsed = 0;
  /** Used to throttle "close on key" — small lockout so the same E doesn't close it. */
  private openLockout = 0;

  open(name: string, role: string, line: string): void {
    this.name = name;
    this.role = role;
    this.line = line;
    this.isOpen = true;
    this.elapsed = 0;
    this.openLockout = 200; // ms
  }

  close(): void {
    this.isOpen = false;
  }

  get open_(): boolean {
    return this.isOpen;
  }

  isVisible(): boolean {
    return this.isOpen;
  }

  /** Decrements the open-lockout. Called from Game.update. */
  update(dtMs: number): void {
    if (!this.isOpen) return;
    this.elapsed += dtMs;
    if (this.openLockout > 0) {
      this.openLockout = Math.max(0, this.openLockout - dtMs);
    }
  }

  /** True if the box has settled and can be dismissed by a key press. */
  canDismiss(): boolean {
    return this.isOpen && this.openLockout <= 0;
  }

  /** Renders the panel on top of the world. */
  draw(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    if (!this.isOpen) return;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = canvasH - PANEL_H - 80;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Panel
    ctx.fillStyle = BG;
    ctx.fillRect(x, y, PANEL_W, PANEL_H);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, PANEL_W - 2, PANEL_H - 2);

    // Decorative corner pixels
    ctx.fillStyle = BORDER;
    ctx.fillRect(x + 4, y + 4, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + 4, 4, 4);
    ctx.fillRect(x + 4, y + PANEL_H - 8, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + PANEL_H - 8, 4, 4);

    // Name + role header
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = NAME_COLOR;
    ctx.font = 'bold 16px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillText(this.name, x + 16, y + 12);
    ctx.fillStyle = ROLE_COLOR;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(this.role, x + 16, y + 32);

    // Divider
    ctx.fillStyle = BORDER;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x + 16, y + 48, PANEL_W - 32, 1);
    ctx.globalAlpha = 1;

    // Body — wrap to ~64 chars per line.
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillStyle = BODY_COLOR;
    const lines = wrap(this.line, 64);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x + 16, y + 56 + i * 18);
    }

    // Hint
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = HINT_COLOR;
    ctx.textAlign = 'right';
    ctx.fillText('press any key to continue', x + PANEL_W - 16, y + PANEL_H - 16);

    ctx.restore();
  }
}
