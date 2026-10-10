import { describe, expect, it } from 'vitest';
import {
  batchComplete,
  cardId,
  createState,
  gradeCard,
  markKnown,
  nextCard,
  stats,
  unlockNextBatch,
} from './planner';
import { State } from './srs';
import type { VocabEntry } from './types';

const T0 = new Date(2026, 9, 10, 9, 0, 0).getTime();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function makeEntries(n: number): VocabEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `es:w${i + 1}|t${i + 1}`,
    rank: i + 1,
    word: `w${i + 1}`,
    translation: `t${i + 1}`,
  }));
}

const meta = { timedOut: false, responseMs: 1000 };

describe('new-word batches', () => {
  it('introduces words in rank order, 5 at a time', () => {
    const state = createState('es', T0);
    const entries = makeEntries(30);
    expect(unlockNextBatch(state, entries, T0)).toBe(5);
    expect(state.currentBatch).toEqual(entries.slice(0, 5).map((e) => cardId(e.id, 'target-base')));
  });

  it('keeps the next batch locked until each card in the batch is answered correctly', () => {
    const state = createState('es', T0);
    const entries = makeEntries(30);
    unlockNextBatch(state, entries, T0);
    const [first, ...rest] = state.currentBatch;

    gradeCard(state, first, false, T0, meta);
    for (const id of rest) gradeCard(state, id, true, T0, meta);
    expect(batchComplete(state)).toBe(false);
    expect(unlockNextBatch(state, entries, T0)).toBe(0);

    gradeCard(state, first, true, T0 + MIN, meta);
    expect(batchComplete(state)).toBe(true);
    expect(unlockNextBatch(state, entries, T0 + MIN)).toBe(5);
  });

  it('stops at the daily limit and resets the next day', () => {
    const state = createState('es', T0);
    const entries = makeEntries(30);
    const passBatch = (now: number) => {
      for (const id of state.currentBatch) gradeCard(state, id, true, now, meta);
    };
    expect(unlockNextBatch(state, entries, T0)).toBe(5);
    passBatch(T0);
    expect(unlockNextBatch(state, entries, T0)).toBe(5);
    passBatch(T0);
    expect(unlockNextBatch(state, entries, T0)).toBe(0);
    expect(stats(state, entries, T0).newLeftToday).toBe(0);

    expect(unlockNextBatch(state, entries, T0 + DAY)).toBe(5);
  });

  it('"more new words" ignores the daily limit but not an unfinished batch', () => {
    const state = createState('es', T0);
    state.settings.newPerDay = 0;
    const entries = makeEntries(30);
    expect(unlockNextBatch(state, entries, T0)).toBe(0);
    expect(unlockNextBatch(state, entries, T0, { ignoreDailyLimit: true })).toBe(5);
    expect(unlockNextBatch(state, entries, T0, { ignoreDailyLimit: true })).toBe(0);
  });

  it('pauses new words when too many reviews are due', () => {
    const state = createState('es', T0);
    state.settings.reviewGuard = 2;
    const entries = makeEntries(30);
    unlockNextBatch(state, entries, T0);
    for (const id of state.currentBatch) {
      const c = state.cards[id];
      c.correctStreak = 1;
      c.fsrs = { ...c.fsrs, state: State.Review, due: T0 };
    }
    expect(stats(state, entries, T0).guardActive).toBe(true);
    expect(unlockNextBatch(state, entries, T0)).toBe(0);
  });

  it('skips words marked as already known', () => {
    const state = createState('es', T0);
    const entries = makeEntries(30);
    unlockNextBatch(state, entries, T0);
    markKnown(state, state.currentBatch[0]);
    expect(state.cards[state.currentBatch[0]].suspended).toBe(true);
    expect(batchComplete(state)).toBe(false);
    for (const id of state.currentBatch.slice(1)) gradeCard(state, id, true, T0, meta);
    expect(batchComplete(state)).toBe(true);
  });

  it('creates separate cards per direction', () => {
    const state = createState('es', T0);
    const entries = makeEntries(30);
    unlockNextBatch(state, entries, T0);
    state.settings.direction = 'base-target';
    state.currentBatch = [];
    state.settings.newPerDay = 20;
    unlockNextBatch(state, entries, T0);
    expect(state.cards[cardId(entries[0].id, 'base-target')]).toBeDefined();
    expect(state.cards[cardId(entries[0].id, 'target-base')]).toBeDefined();
    // The same word in both directions only counts once against the daily limit.
    expect(state.day.newEntryIds).toHaveLength(5);
  });
});

describe('nextCard', () => {
  it('shows new cards, repeats missed ones, and ends when nothing is due', () => {
    const state = createState('es', T0);
    state.settings.newPerDay = 5;
    const entries = makeEntries(30);
    let now = T0;
    const seen: string[] = [];
    let last: string | undefined;
    for (let i = 0; i < 200; i++) {
      const card = nextCard(state, entries, now, last);
      if (!card) break;
      seen.push(card.word);
      // Miss w1 the first time it shows; everything else is correct.
      const correct = !(card.word === 'w1' && seen.filter((w) => w === 'w1').length === 1);
      gradeCard(state, card.id, correct, now, meta);
      last = card.id;
      now += 5000;
    }
    expect(new Set(seen)).toEqual(new Set(['w1', 'w2', 'w3', 'w4', 'w5']));
    expect(seen.filter((w) => w === 'w1').length).toBeGreaterThan(1);
    expect(nextCard(state, entries, now)).toBeNull();
    // Learning cards graduate to review within the session.
    expect(Object.values(state.cards).every((c) => c.fsrs.state === State.Review)).toBe(true);
  });

  it('puts due reviews before new words', () => {
    const state = createState('es', T0);
    const entries = makeEntries(30);
    unlockNextBatch(state, entries, T0);
    const reviewId = state.currentBatch[4];
    state.cards[reviewId].fsrs = { ...state.cards[reviewId].fsrs, state: State.Review, due: T0 - MIN };
    expect(nextCard(state, entries, T0)?.id).toBe(reviewId);
  });

  it('does not show flagged cards', () => {
    const state = createState('es', T0);
    state.settings.newPerDay = 1;
    state.settings.batchSize = 1;
    const entries = makeEntries(3);
    const card = nextCard(state, entries, T0)!;
    state.cards[card.id].flagged = true;
    expect(nextCard(state, entries, T0)).toBeNull();
  });
});
