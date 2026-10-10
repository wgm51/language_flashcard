import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from 'ts-fsrs';
import type { StoredFsrs } from './types';

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }));

export { State };

export function toStored(card: Card): StoredFsrs {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.getTime(),
  };
}

export function fromStored(s: StoredFsrs): Card {
  return {
    ...s,
    state: s.state as State,
    due: new Date(s.due),
    last_review: s.last_review === undefined ? undefined : new Date(s.last_review),
  };
}

export function newFsrs(now: number): StoredFsrs {
  return toStored(createEmptyCard(new Date(now)));
}

/** Auto-play grading is binary: missed = Again, correct (or timed out) = Good. */
export function review(s: StoredFsrs, correct: boolean, now: number): StoredFsrs {
  const { card } = scheduler.next(fromStored(s), new Date(now), correct ? Rating.Good : Rating.Again);
  return toStored(card);
}
