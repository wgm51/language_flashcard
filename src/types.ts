export type Direction = 'target-base' | 'base-target';

export interface VocabEntry {
  /** Stable across list swaps: derived from the (word, translation) pair. */
  id: string;
  rank: number;
  word: string;
  translation: string;
}

export interface Settings {
  promptSeconds: number;
  answerSeconds: number;
  direction: Direction;
  newPerDay: number;
  batchSize: number;
  /** Correct answers in a row each batch card needs before the next batch unlocks. */
  batchPassStreak: number;
  /** New words pause when more than this many reviews are due today. */
  reviewGuard: number;
  /** 0 = no limit. */
  sessionCardLimit: number;
}

/** ts-fsrs Card with dates stored as epoch milliseconds. */
export interface StoredFsrs {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: number;
}

export interface StoredCard {
  id: string;
  entryId: string;
  direction: Direction;
  /** Snapshot so the card still works if its entry disappears from a swapped list. */
  word: string;
  translation: string;
  fsrs: StoredFsrs;
  introducedAt: number;
  batchId: number;
  correctStreak: number;
  suspended: boolean;
  flagged: boolean;
}

export interface ReviewLogEntry {
  cardId: string;
  ts: number;
  correct: boolean;
  timedOut: boolean;
  responseMs: number;
}

export interface DayState {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** Entry ids whose first card was introduced today. */
  newEntryIds: string[];
}

export interface AppState {
  version: 1;
  packId: string;
  settings: Settings;
  cards: Record<string, StoredCard>;
  log: ReviewLogEntry[];
  day: DayState;
  nextBatchId: number;
  currentBatch: string[];
  /** Entry ids the learner marked "already know". */
  known: string[];
  /** A user-imported word list that replaces the bundled one. */
  customList?: { name: string; entries: VocabEntry[] };
}
