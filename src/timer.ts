export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realClock: Clock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (h) => window.clearTimeout(h as number),
};

/**
 * A one-shot countdown that can be paused mid-way and resumed with the
 * remaining time (FR-21). Elapsed time is measured from the clock, so timer
 * callback lateness doesn't make phases drift (NFR-4).
 */
export class PhaseTimer {
  private handle: unknown = null;
  private startedAt = 0;
  private remainingMs = 0;
  private durationMs = 0;
  private onDone: (() => void) | null = null;
  paused = false;

  constructor(private clock: Clock) {}

  start(durationMs: number, onDone: () => void): void {
    this.cancel();
    this.durationMs = durationMs;
    this.remainingMs = durationMs;
    this.onDone = onDone;
    this.paused = false;
    this.arm();
  }

  private arm(): void {
    this.startedAt = this.clock.now();
    this.handle = this.clock.setTimeout(() => this.fire(), this.remainingMs);
  }

  private fire(): void {
    this.handle = null;
    this.remainingMs = 0;
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  pause(): void {
    if (this.paused || this.handle === null) return;
    this.clock.clearTimeout(this.handle);
    this.handle = null;
    this.remainingMs = Math.max(0, this.remainingMs - (this.clock.now() - this.startedAt));
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.onDone) this.arm();
  }

  cancel(): void {
    if (this.handle !== null) this.clock.clearTimeout(this.handle);
    this.handle = null;
    this.onDone = null;
    this.paused = false;
  }

  /** Fraction of the phase remaining, 0..1. */
  fractionLeft(): number {
    if (this.durationMs <= 0) return 0;
    const left = this.paused || this.handle === null
      ? this.remainingMs
      : this.remainingMs - (this.clock.now() - this.startedAt);
    return Math.min(1, Math.max(0, left / this.durationMs));
  }
}
