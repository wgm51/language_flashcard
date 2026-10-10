import { flagCard, gradeCard, markKnown, nextCard } from './planner';
import { PhaseTimer, type Clock } from './timer';
import type { AppState, StoredCard, VocabEntry } from './types';

export type Phase = 'prompt' | 'answer' | 'done';

export interface SessionSummary {
  reviewed: number;
  correct: number;
  missed: number;
  timedOut: number;
}

export interface SessionDeps {
  state: AppState;
  entries: VocabEntry[];
  clock: Clock;
  /** Wall-clock time for scheduling (Date.now in the app). */
  wallNow: () => number;
  save: () => void;
  onChange: () => void;
}

/**
 * Hands-free auto-play (FR-1..FR-13, FR-20..FR-22): prompt → answer → grade,
 * driven by timers. Silence during the answer phase counts as correct.
 */
export class Session {
  phase: Phase = 'prompt';
  card: StoredCard | null = null;
  /** Set when "missed" is pressed during the prompt: reveal, then grade as missed. */
  preMarkedMissed = false;
  readonly timer: PhaseTimer;
  readonly summary: SessionSummary = { reviewed: 0, correct: 0, missed: 0, timedOut: 0 };
  private cardShownAt = 0;

  constructor(private deps: SessionDeps) {
    this.timer = new PhaseTimer(deps.clock);
  }

  get paused(): boolean {
    return this.timer.paused;
  }

  start(): void {
    this.advance();
  }

  private advance(): void {
    const { state, entries } = this.deps;
    const limit = state.settings.sessionCardLimit;
    const next = limit > 0 && this.summary.reviewed >= limit
      ? null
      : nextCard(state, entries, this.deps.wallNow(), this.card?.id);
    this.deps.save();
    this.preMarkedMissed = false;
    if (!next) {
      this.finish();
      return;
    }
    this.card = next;
    this.phase = 'prompt';
    this.cardShownAt = this.deps.clock.now();
    this.timer.start(state.settings.promptSeconds * 1000, () => this.reveal());
    this.deps.onChange();
  }

  /** Show the answer (timer end, or the learner asked to see it early). */
  reveal(): void {
    if (this.phase !== 'prompt' || this.paused) return;
    this.phase = 'answer';
    this.timer.start(this.deps.state.settings.answerSeconds * 1000, () =>
      this.grade(!this.preMarkedMissed, true),
    );
    this.deps.onChange();
  }

  grade(correct: boolean, timedOut = false): void {
    if (this.phase !== 'answer' || !this.card || (this.paused && !timedOut)) return;
    this.timer.cancel();
    gradeCard(this.deps.state, this.card.id, correct, this.deps.wallNow(), {
      timedOut,
      responseMs: Math.round(this.deps.clock.now() - this.cardShownAt),
    });
    this.summary.reviewed++;
    if (correct) this.summary.correct++;
    else this.summary.missed++;
    if (timedOut && correct) this.summary.timedOut++;
    this.advance();
  }

  /** "Got it" input: reveals during the prompt, grades during the answer. */
  pressCorrect(): void {
    if (this.paused) return;
    if (this.phase === 'prompt') this.reveal();
    else if (this.phase === 'answer') this.grade(true);
  }

  /** "Missed it" input: during the prompt, shows the answer and pre-marks the card missed. */
  pressMissed(): void {
    if (this.paused) return;
    if (this.phase === 'prompt') {
      this.preMarkedMissed = true;
      this.reveal();
    } else if (this.phase === 'answer') {
      this.grade(false);
    }
  }

  pause(): void {
    if (this.phase === 'done') return;
    this.timer.pause();
    this.deps.onChange();
  }

  resume(): void {
    if (this.phase === 'done') return;
    this.timer.resume();
    this.deps.onChange();
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  /** Hide a bad card (FR-43) and move on without grading. */
  flag(): void {
    if (!this.card || this.phase === 'done') return;
    this.timer.cancel();
    flagCard(this.deps.state, this.card.id);
    this.advance();
  }

  /** "Already know" (FR-41): retire the word and move on. */
  known(): void {
    if (!this.card || this.phase === 'done') return;
    this.timer.cancel();
    markKnown(this.deps.state, this.card.id);
    this.advance();
  }

  finish(): void {
    this.timer.cancel();
    this.phase = 'done';
    this.deps.save();
    this.deps.onChange();
  }
}
