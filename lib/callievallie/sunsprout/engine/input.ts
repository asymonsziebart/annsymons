// Keyboard input handler. Tracks both "currently held" keys (`pressed`) and
// "pressed-this-frame" keys (`justPressed`). The Game loop calls
// clearJustPressed() at the end of every fixed-timestep update so consumers
// see each press exactly once.
//
// We normalise key names: arrow keys map to WASD-style direction names so
// the rest of the engine only needs one vocabulary. Raw KeyboardEvent.key
// values (lowercased) are also kept so anyone can poll the literal key.

type Dir = { dx: number; dy: number };

const UP = new Set(['w', 'arrowup']);
const DOWN = new Set(['s', 'arrowdown']);
const LEFT = new Set(['a', 'arrowleft']);
const RIGHT = new Set(['d', 'arrowright']);

export class Input {
  public pressed: Set<string> = new Set();
  public justPressed: Set<string> = new Set();

  private readonly target: Window | HTMLElement;
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;
  private readonly onBlur: () => void;

  constructor(target: Window | HTMLElement = window) {
    this.target = target;
    this.onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Avoid letting browser scroll on arrow / space / WASD inside the game.
      if (
        key.startsWith('arrow') ||
        key === ' ' ||
        key === 'tab' ||
        key === 'w' ||
        key === 'a' ||
        key === 's' ||
        key === 'd'
      ) {
        e.preventDefault();
      }
      if (!this.pressed.has(key)) {
        this.justPressed.add(key);
      }
      this.pressed.add(key);
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      this.pressed.delete(key);
    };

    this.onBlur = () => {
      // If the window loses focus we drop all held keys so the player
      // doesn't keep moving when the user tabs away.
      this.pressed.clear();
    };

    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
    if ('addEventListener' in target) {
      (target as Window).addEventListener('blur', this.onBlur);
    }
  }

  /**
   * Returns the current desired movement vector based on WASD / arrow keys.
   * Diagonal-favouring is intentionally avoided — the World logic only moves
   * one tile at a time and prefers horizontal axis when both are held.
   */
  getDirection(): Dir {
    let dx = 0;
    let dy = 0;
    for (const k of this.pressed) {
      if (UP.has(k)) dy -= 1;
      else if (DOWN.has(k)) dy += 1;
      else if (LEFT.has(k)) dx -= 1;
      else if (RIGHT.has(k)) dx += 1;
    }
    // Normalise to single-axis movement (grid-snapped travel feels off when
    // diagonals are allowed). Horizontal wins ties to feel responsive.
    if (dx !== 0 && dy !== 0) {
      dy = 0;
    }
    // Clamp in case multiple opposing keys were held simultaneously.
    if (dx < -1) dx = -1;
    if (dx > 1) dx = 1;
    if (dy < -1) dy = -1;
    if (dy > 1) dy = 1;
    return { dx, dy };
  }

  /** True if the key transitioned from up→down this frame. */
  isJustPressed(key: string): boolean {
    return this.justPressed.has(key.toLowerCase());
  }

  /** True if the key is currently held. */
  isPressed(key: string): boolean {
    return this.pressed.has(key.toLowerCase());
  }

  /** Called by Game at the end of each fixed update tick. */
  clearJustPressed(): void {
    this.justPressed.clear();
  }

  /** Detach listeners — call from Game.stop() on React unmount. */
  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    if ('removeEventListener' in this.target) {
      (this.target as Window).removeEventListener('blur', this.onBlur);
    }
    this.pressed.clear();
    this.justPressed.clear();
  }
}
