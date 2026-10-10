import { get, set } from 'idb-keyval';
import { DEFAULT_SETTINGS } from './planner';
import type { AppState } from './types';

const KEY = 'flashcards-state-v1';

export async function loadState(): Promise<AppState | null> {
  try {
    const s = await get<AppState>(KEY);
    return s ? upgrade(s) : null;
  } catch (err) {
    console.error('Could not read saved progress', err);
    return null;
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    await set(KEY, state);
  } catch (err) {
    console.error('Could not save progress', err);
  }
}

/** Fills in settings added after the state was first saved. */
function upgrade(s: AppState): AppState {
  s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
  s.known ??= [];
  s.currentBatch ??= [];
  return s;
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 1);
}

export function parseBackup(text: string): AppState {
  const s = JSON.parse(text) as AppState;
  if (s?.version !== 1 || typeof s.cards !== 'object' || !Array.isArray(s.log)) {
    throw new Error('This file is not a flashcard progress backup.');
  }
  return upgrade(s);
}
