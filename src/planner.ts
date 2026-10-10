import { newFsrs, review, State } from './srs';
import type { AppState, Direction, Settings, StoredCard, VocabEntry } from './types';

export const DEFAULT_SETTINGS: Settings = {
  promptSeconds: 4,
  answerSeconds: 4,
  direction: 'target-base',
  newPerDay: 10,
  batchSize: 5,
  batchPassStreak: 1,
  reviewGuard: 100,
  sessionCardLimit: 0,
};

/** Learning cards due within this window are shown now rather than ending the session. */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

export function localDate(now: number): string {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function createState(packId: string, now: number): AppState {
  return {
    version: 1,
    packId,
    settings: { ...DEFAULT_SETTINGS },
    cards: {},
    log: [],
    day: { date: localDate(now), newEntryIds: [] },
    nextBatchId: 1,
    currentBatch: [],
    known: [],
  };
}

export function rollDay(state: AppState, now: number): void {
  const today = localDate(now);
  if (state.day.date !== today) state.day = { date: today, newEntryIds: [] };
}

export function cardId(entryId: string, direction: Direction): string {
  return `${entryId}#${direction}`;
}

function isActive(card: StoredCard, direction: Direction): boolean {
  return card.direction === direction && !card.suspended && !card.flagged;
}

function batchCardDone(state: AppState, card: StoredCard | undefined): boolean {
  return !card || card.suspended || card.flagged || card.correctStreak >= state.settings.batchPassStreak;
}

export function batchComplete(state: AppState): boolean {
  return state.currentBatch.every((id) => batchCardDone(state, state.cards[id]));
}

/** Review cards (not new or learning) due by the end of today. */
export function reviewsDueToday(state: AppState, now: number): number {
  const eod = endOfDay(now);
  const dir = state.settings.direction;
  return Object.values(state.cards).filter(
    (c) => isActive(c, dir) && c.fsrs.state === State.Review && c.fsrs.due <= eod,
  ).length;
}

export function newWordsLeftToday(state: AppState): number {
  return Math.max(0, state.settings.newPerDay - state.day.newEntryIds.length);
}

export function reviewGuardActive(state: AppState, now: number): boolean {
  return reviewsDueToday(state, now) > state.settings.reviewGuard;
}

/** Entries that have no card yet in the current direction, in rank order. */
export function unseenEntries(state: AppState, entries: VocabEntry[]): VocabEntry[] {
  const known = new Set(state.known);
  const dir = state.settings.direction;
  return entries.filter((e) => !known.has(e.id) && !state.cards[cardId(e.id, dir)]);
}

/**
 * Introduces the next mini-batch of new words (FR-50..52) if the current batch
 * is learned, today's limit isn't reached, and the review load is acceptable.
 * Returns the number of cards introduced.
 */
export function unlockNextBatch(
  state: AppState,
  entries: VocabEntry[],
  now: number,
  opts: { ignoreDailyLimit?: boolean } = {},
): number {
  rollDay(state, now);
  if (!batchComplete(state)) return 0;
  if (!opts.ignoreDailyLimit && reviewGuardActive(state, now)) return 0;
  const budget = opts.ignoreDailyLimit ? state.settings.batchSize : newWordsLeftToday(state);
  const size = Math.min(state.settings.batchSize, budget);
  if (size <= 0) return 0;

  const picked = unseenEntries(state, entries).slice(0, size);
  if (picked.length === 0) return 0;

  const dir = state.settings.direction;
  const batchId = state.nextBatchId++;
  state.currentBatch = [];
  for (const e of picked) {
    const id = cardId(e.id, dir);
    state.cards[id] = {
      id,
      entryId: e.id,
      direction: dir,
      word: e.word,
      translation: e.translation,
      fsrs: newFsrs(now),
      introducedAt: now,
      batchId,
      correctStreak: 0,
      suspended: false,
      flagged: false,
    };
    state.currentBatch.push(id);
    if (!state.day.newEntryIds.includes(e.id)) state.day.newEntryIds.push(e.id);
  }
  return picked.length;
}

function priority(card: StoredCard): number {
  switch (card.fsrs.state) {
    case State.Learning:
    case State.Relearning:
      return 0;
    case State.Review:
      return 1;
    default:
      return 2;
  }
}

function pickDue(state: AppState, now: number, avoidId?: string): StoredCard | null {
  const dir = state.settings.direction;
  const candidates = Object.values(state.cards)
    .filter((c) => isActive(c, dir))
    .filter((c) => {
      if (c.fsrs.state === State.Review) return c.fsrs.due <= now;
      return c.fsrs.due <= now + LEARN_AHEAD_MS;
    })
    .sort((a, b) => priority(a) - priority(b) || a.fsrs.due - b.fsrs.due);
  if (candidates.length === 0) return null;
  return candidates.find((c) => c.id !== avoidId) ?? candidates[0];
}

/**
 * Next card to show (FR-33): learning cards, then due reviews, then new cards.
 * Unlocks another batch when nothing is due. Returns null when the session is done.
 */
export function nextCard(
  state: AppState,
  entries: VocabEntry[],
  now: number,
  avoidId?: string,
): StoredCard | null {
  rollDay(state, now);
  const due = pickDue(state, now, avoidId);
  if (due) return due;
  if (unlockNextBatch(state, entries, now) > 0) return pickDue(state, now, avoidId);
  return null;
}

export function gradeCard(
  state: AppState,
  id: string,
  correct: boolean,
  now: number,
  meta: { timedOut: boolean; responseMs: number },
): void {
  const card = state.cards[id];
  if (!card) return;
  card.fsrs = review(card.fsrs, correct, now);
  card.correctStreak = correct ? card.correctStreak + 1 : 0;
  state.log.push({ cardId: id, ts: now, correct, timedOut: meta.timedOut, responseMs: meta.responseMs });
}

export function flagCard(state: AppState, id: string): void {
  const card = state.cards[id];
  if (card) card.flagged = true;
}

/** "Already know": retire every card for the word and skip it as a new word. */
export function markKnown(state: AppState, id: string): void {
  const card = state.cards[id];
  if (!card) return;
  if (!state.known.includes(card.entryId)) state.known.push(card.entryId);
  for (const c of Object.values(state.cards)) {
    if (c.entryId === card.entryId) c.suspended = true;
  }
}

export interface Stats {
  dueNow: number;
  newLeftToday: number;
  learned: number;
  unseen: number;
  flagged: number;
  guardActive: boolean;
}

export function stats(state: AppState, entries: VocabEntry[], now: number): Stats {
  rollDay(state, now);
  const dir = state.settings.direction;
  const active = Object.values(state.cards).filter((c) => isActive(c, dir));
  return {
    dueNow: active.filter((c) => c.fsrs.due <= now).length,
    newLeftToday: Math.min(newWordsLeftToday(state), unseenEntries(state, entries).length),
    learned: active.filter((c) => c.fsrs.state === State.Review).length,
    unseen: unseenEntries(state, entries).length,
    flagged: Object.values(state.cards).filter((c) => c.flagged).length,
    guardActive: reviewGuardActive(state, now),
  };
}
