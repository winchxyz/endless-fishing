import type { Settings } from './Settings.js';

/**
 * The game's clock.
 *
 * Default behaviour is the only behaviour that matters: the world time *is* the user's system
 * time, advancing 1:1. The time-scale multiplier and the manual override exist for testing
 * and screenshots, and both are off by default.
 *
 * Everything downstream consumes `epochMs` (UTC milliseconds). Nothing else in the codebase
 * calls `Date.now()`, so a screenshot at an overridden timestamp is bit-identical to the real
 * thing at that instant.
 */
export class Time {
  /** Current world time, UTC epoch milliseconds. */
  epochMs: number;
  /** World milliseconds elapsed in the last frame, after the time-scale multiplier. */
  deltaMs = 0;

  private readonly settings: Settings;
  private lastOverride: number | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
    this.epochMs = settings.world.timeOverrideMs ?? Date.now();
    this.lastOverride = settings.world.timeOverrideMs;
  }

  /** Advance by a real-time delta in seconds. */
  advance(realDeltaSeconds: number): void {
    const override = this.settings.world.timeOverrideMs;

    if (override !== null && override !== this.lastOverride) {
      // A new override was set: jump to it.
      this.epochMs = override;
      this.deltaMs = 0;
      this.lastOverride = override;
      return;
    }
    if (override === null && this.lastOverride !== null) {
      // Override cleared: snap back to the wall clock.
      this.epochMs = Date.now();
      this.deltaMs = 0;
      this.lastOverride = null;
      return;
    }
    this.lastOverride = override;

    const scale = this.settings.world.timeScale;
    if (override === null && scale === 1) {
      // The common case. Read the system clock directly so we never drift from it.
      const now = Date.now();
      this.deltaMs = now - this.epochMs;
      this.epochMs = now;
      return;
    }

    this.deltaMs = realDeltaSeconds * 1000 * scale;
    this.epochMs += this.deltaMs;
  }

  get date(): Date {
    return new Date(this.epochMs);
  }

  /** Local time of day in hours, 0..24, in the user's own timezone. */
  get localHours(): number {
    const d = this.date;
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  /** Minutes to add to UTC to get local time. Negative west of Greenwich. */
  get timezoneOffsetMinutes(): number {
    return -this.date.getTimezoneOffset();
  }
}
