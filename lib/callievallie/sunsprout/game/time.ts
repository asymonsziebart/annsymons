// Time-of-day, day counter, and season tracking.
//
// One in-game hour lasts HOUR_LENGTH_SEC real seconds. The "active" part
// of the day runs from DAY_START (06:00) to DAY_END (22:00). Outside
// that window the world is in "night" and the tint overlay darkens.
// Every SEASON_LENGTH in-game days rolls the season forward.
//
// `tick(dt)` is called from the Game's fixed-step update loop with
// `dt` in milliseconds; it returns `{ newDay: true }` on the frame the
// day flips so callers can trigger crop growth (`advanceDay(world)`)
// exactly once per day.

/** How many real-world seconds equal a single in-game hour. */
export const HOUR_LENGTH_SEC = 10;

/** The hour the player's "active" day begins. */
export const DAY_START = 6;
/** The hour the player's "active" day ends (after this the night tint kicks in). */
export const DAY_END = 22;

/** Number of days in a season. */
export const SEASON_LENGTH = 7;

/** Season names, indexed by `season`. */
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export type SeasonName = (typeof SEASONS)[number];

/** Bundle returned by tick() so the caller can react to day rollover. */
export interface TickResult {
  newDay: boolean;
}

/**
 * Mutable clock object. Construct once per game session.
 *
 * Internally we track `_elapsedSec` — fractional in-game seconds since the
 * start of the current day's DAY_START hour. `hour`/`minute` are derived
 * each tick. This avoids floating-point drift accumulating into the hour
 * counter.
 */
export class TimeOfDay {
  public hour: number = DAY_START;
  public minute: number = 0;
  public day: number = 1;
  public season: 0 | 1 | 2 | 3 = 0;

  /** Real seconds elapsed since the start of the current in-game day. */
  private _elapsedSec = 0;

  constructor(startHour: number = DAY_START) {
    this.hour = Math.floor(startHour);
    this.minute = 0;
    // Convert start hour offset to elapsed real seconds.
    this._elapsedSec = (this.hour - DAY_START) * HOUR_LENGTH_SEC;
    this.recalc();
  }

  /**
   * Advance the clock by `dtMs` milliseconds. Returns `{ newDay: true }`
   * on the frame the day count flips so the caller can run
   * end-of-day logic (crop growth, NPC schedule reset, etc.).
   */
  tick(dtMs: number): TickResult {
    const dtSec = dtMs / 1000;
    this._elapsedSec += dtSec;
    let newDay = false;
    const secondsPerDay = (DAY_END - DAY_START) * HOUR_LENGTH_SEC + HOUR_LENGTH_SEC * (24 - (DAY_END - DAY_START));
    // We model a full 24-hour day where each hour is HOUR_LENGTH_SEC real seconds.
    const fullDaySec = 24 * HOUR_LENGTH_SEC;
    void secondsPerDay;
    while (this._elapsedSec >= fullDaySec - DAY_START * HOUR_LENGTH_SEC) {
      // Rollover at midnight of the next day. Start counting from DAY_START
      // of the new day so we don't have to fast-forward through night each tick.
      this._elapsedSec -= fullDaySec;
      this.day += 1;
      if (this.day > SEASON_LENGTH) {
        this.day = 1;
        this.season = (((this.season + 1) % 4) as 0 | 1 | 2 | 3);
      }
      newDay = true;
    }
    this.recalc();
    return { newDay };
  }

  /** Recompute the hour/minute fields from the internal elapsed counter. */
  private recalc(): void {
    const hoursSinceDayStart = this._elapsedSec / HOUR_LENGTH_SEC;
    const absoluteHour = DAY_START + hoursSinceDayStart;
    // Wrap into [0, 24).
    const wrapped = ((absoluteHour % 24) + 24) % 24;
    this.hour = Math.floor(wrapped);
    this.minute = Math.floor((wrapped - this.hour) * 60);
  }

  /**
   * Returns a CSS rgba string suitable for `ctx.fillStyle` to overlay
   * onto the rendered scene as a night tint. Dawn/dusk transitions are
   * gentle; deep night is a soft indigo.
   */
  getTint(): string {
    const h = this.hour + this.minute / 60;
    // Daytime hours: no tint.
    if (h >= DAY_START + 1 && h <= DAY_END - 1) {
      return 'rgba(0,0,0,0)';
    }
    // Dawn ramp: 5:00 → 7:00.
    if (h >= 5 && h < DAY_START + 1) {
      const t = (DAY_START + 1 - h) / 2; // 1 at 5:00, 0 at 7:00
      return `rgba(36, 22, 64, ${(0.45 * t).toFixed(3)})`;
    }
    // Dusk ramp: 21:00 → 23:00.
    if (h > DAY_END - 1 && h < 23) {
      const t = (h - (DAY_END - 1)) / 2; // 0 at 21:00, 1 at 23:00
      return `rgba(36, 22, 64, ${(0.5 * t).toFixed(3)})`;
    }
    // Deep night: 23:00 → 5:00.
    return 'rgba(20, 14, 48, 0.55)';
  }

  /** Returns the current season's human-readable name. */
  seasonName(): SeasonName {
    return SEASONS[this.season];
  }

  /**
   * Formats the current time as "6:30 AM" style. 12-hour clock with no
   * leading zero on the hour.
   */
  formatClock(): string {
    let h = this.hour;
    const m = this.minute;
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, '0')} ${suffix}`;
  }

  /** Returns whether it's currently daytime (between DAY_START and DAY_END). */
  isDay(): boolean {
    const h = this.hour + this.minute / 60;
    return h >= DAY_START && h < DAY_END;
  }
}
