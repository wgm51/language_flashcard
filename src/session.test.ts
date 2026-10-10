import { describe, expect, it } from 'vitest';
import { createState } from './planner';
import { Session } from './session';
import { FakeClock } from './testClock';
import { PhaseTimer } from './timer';
import type { VocabEntry } from './types';

const T0 = new Date(2026, 9, 10, 9, 0, 0).getTime();

const entries: VocabEntry[] = Array.from({ length: 20 }, (_, i) => ({
  id: `es:w${i + 1}|t${i + 1}`,
  rank: i + 1,
  word: `w${i + 1}`,
  translation: `t${i + 1}`,
}));

function setup() {
  const clock = new FakeClock();
  const state = createState('es', T0);
  state.settings.promptSeconds = 3;
  state.settings.answerSeconds = 2;
  const session = new Session({
    state,
    entries,
    clock,
    wallNow: () => T0 + clock.now(),
    save: () => {},
    onChange: () => {},
  });
  return { clock, state, session };
}

describe('PhaseTimer', () => {
  it('keeps the remaining time across a pause', () => {
    const clock = new FakeClock();
    const timer = new PhaseTimer(clock);
    let fired = 0;
    timer.start(1000, () => fired++);
    clock.advance(400);
    timer.pause();
    clock.advance(10_000);
    expect(fired).toBe(0);
    expect(timer.fractionLeft()).toBeCloseTo(0.6);
    timer.resume();
    clock.advance(599);
    expect(fired).toBe(0);
    clock.advance(1);
    expect(fired).toBe(1);
  });
});

describe('Session auto-play', () => {
  it('reveals the answer after the prompt time, then grades correct on timeout', () => {
    const { clock, state, session } = setup();
    session.start();
    const first = session.card!;
    expect(session.phase).toBe('prompt');
    clock.advance(2999);
    expect(session.phase).toBe('prompt');
    clock.advance(1);
    expect(session.phase).toBe('answer');
    clock.advance(2000);
    expect(state.log).toHaveLength(1);
    expect(state.log[0]).toMatchObject({ cardId: first.id, correct: true, timedOut: true });
    expect(session.phase).toBe('prompt');
    expect(session.card!.id).not.toBe(first.id);
  });

  it('grades missed immediately when red is pressed during the answer', () => {
    const { clock, state, session } = setup();
    session.start();
    clock.advance(3000);
    session.pressMissed();
    expect(state.log[0]).toMatchObject({ correct: false, timedOut: false });
  });

  it('red during the prompt shows the answer, then grades missed when it times out', () => {
    const { clock, state, session } = setup();
    session.start();
    clock.advance(1000);
    session.pressMissed();
    expect(session.phase).toBe('answer');
    expect(state.log).toHaveLength(0);
    clock.advance(2000);
    expect(state.log[0]).toMatchObject({ correct: false, timedOut: true });
  });

  it('never auto-grades while paused', () => {
    const { clock, state, session } = setup();
    session.start();
    clock.advance(3500);
    session.pause();
    clock.advance(60_000);
    expect(state.log).toHaveLength(0);
    session.pressCorrect();
    expect(state.log).toHaveLength(0);
    session.resume();
    clock.advance(1499);
    expect(state.log).toHaveLength(0);
    clock.advance(1);
    expect(state.log).toHaveLength(1);
  });

  it('ends after the session card limit', () => {
    const { clock, session, state } = setup();
    state.settings.sessionCardLimit = 3;
    session.start();
    clock.advance(5000 * 3);
    expect(session.phase).toBe('done');
    expect(session.summary).toMatchObject({ reviewed: 3, correct: 3, timedOut: 3 });
  });

  it('flagging skips the card without grading it', () => {
    const { session, state } = setup();
    session.start();
    const id = session.card!.id;
    session.flag();
    expect(state.cards[id].flagged).toBe(true);
    expect(state.log).toHaveLength(0);
    expect(session.card!.id).not.toBe(id);
  });
});
