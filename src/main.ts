import './style.css';
import { parseWordList } from './importer';
import { spanishPack } from './packs';
import { createState, stats, unlockNextBatch } from './planner';
import { Session } from './session';
import { exportState, loadState, parseBackup, saveState } from './storage';
import { realClock } from './timer';
import type { AppState, Direction, Settings, VocabEntry } from './types';

const pack = spanishPack();
const app = document.getElementById('app')!;

let state: AppState;
let session: Session | null = null;
let rafId = 0;
let wakeLock: { release(): Promise<void> } | null = null;
let notice = '';

function entries(): VocabEntry[] {
  return state.customList?.entries ?? pack.entries;
}

function save(): void {
  void saveState(state);
}

function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// ---------- Home ----------

const SETTING_FIELDS: { key: keyof Settings; label: string; min: number; max: number; step?: number; help?: string }[] = [
  { key: 'promptSeconds', label: 'Show word for (seconds)', min: 1, max: 30, step: 0.5 },
  { key: 'answerSeconds', label: 'Show answer for (seconds)', min: 1, max: 30, step: 0.5 },
  { key: 'newPerDay', label: 'New words per day', min: 0, max: 50, help: 'Most guides suggest 10–20; start near 10.' },
  { key: 'batchSize', label: 'New words per batch', min: 1, max: 10 },
  { key: 'batchPassStreak', label: 'Correct in a row to finish a batch', min: 1, max: 3 },
  { key: 'reviewGuard', label: 'Pause new words above this many reviews due', min: 10, max: 1000 },
  { key: 'sessionCardLimit', label: 'Cards per session (0 = until done)', min: 0, max: 500 },
];

function renderHome(): void {
  const s = stats(state, entries(), Date.now());
  const set = state.settings;
  const dirLabel = (d: Direction) =>
    d === 'target-base' ? `${pack.name} → ${pack.baseName}` : `${pack.baseName} → ${pack.name}`;
  const listName = state.customList?.name ?? pack.sourceName;

  app.innerHTML = `
    <section class="home">
      <h1>${esc(pack.name)} flashcards</h1>
      ${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
      <dl class="stats">
        <div><dt>Due now</dt><dd>${s.dueNow}</dd></div>
        <div><dt>New left today</dt><dd>${s.newLeftToday}</dd></div>
        <div><dt>Learned</dt><dd>${s.learned}</dd></div>
        <div><dt>Not started</dt><dd>${s.unseen}</dd></div>
      </dl>
      ${s.guardActive ? `<p class="notice">Lots of reviews are due, so new words are paused today.</p>` : ''}

      <div class="direction" role="radiogroup" aria-label="Direction">
        ${(['target-base', 'base-target'] as Direction[])
          .map(
            (d) => `<button class="toggle ${set.direction === d ? 'on' : ''}" role="radio"
              aria-checked="${set.direction === d}" data-dir="${d}">${esc(dirLabel(d))}</button>`,
          )
          .join('')}
      </div>

      <button class="primary big" data-action="start">Start <kbd>Enter</kbd></button>
      <button class="secondary" data-action="more">Add 5 more new words now</button>

      <details>
        <summary>Settings</summary>
        <form class="settings">
          ${SETTING_FIELDS.map(
            (f) => `<label>${esc(f.label)}
              <input type="number" name="${f.key}" value="${set[f.key]}" min="${f.min}" max="${f.max}" step="${f.step ?? 1}" />
              ${f.help ? `<small>${esc(f.help)}</small>` : ''}</label>`,
          ).join('')}
        </form>
      </details>

      <details>
        <summary>Word list &amp; backup</summary>
        <p>Current list: <strong>${esc(listName)}</strong> (${entries().length} words).
          Flagged cards: ${s.flagged}.</p>
        <label class="file">Import a ranked word list (TSV/CSV: rank, ${esc(pack.name)}, ${esc(pack.baseName)})
          <input type="file" accept=".tsv,.csv,.txt" data-action="import-list" /></label>
        ${state.customList ? `<button class="secondary" data-action="bundled-list">Go back to the built-in list</button>` : ''}
        <button class="secondary" data-action="export-flagged">Download flagged cards (CSV)</button>
        <button class="secondary" data-action="export">Download progress backup</button>
        <label class="file">Restore progress from backup
          <input type="file" accept=".json" data-action="restore" /></label>
      </details>

      <details>
        <summary>Keyboard &amp; remote controls</summary>
        <ul class="keys">
          <li><kbd>Space</kbd> / play-pause key — pause or resume</li>
          <li><kbd>→</kbd> <kbd>G</kbd> <kbd>Page Down</kbd> — got it (or show answer early)</li>
          <li><kbd>←</kbd> <kbd>R</kbd> <kbd>Page Up</kbd> — missed it</li>
          <li><kbd>F</kbd> — flag a bad card · <kbd>K</kbd> — I already know this word</li>
          <li><kbd>Esc</kbd> — end the session</li>
          <li>Doing nothing while the answer shows counts as “got it”.</li>
        </ul>
      </details>
    </section>`;
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action],[data-dir]');
  if (!el) return;
  if (el.dataset.dir) {
    state.settings.direction = el.dataset.dir as Direction;
    save();
    renderHome();
    return;
  }
  switch (el.dataset.action) {
    case 'start': return startSession();
    case 'more': {
      const n = unlockNextBatch(state, entries(), Date.now(), { ignoreDailyLimit: true });
      notice = n ? `Added ${n} new words.` : 'Finish the current batch first, or there are no words left.';
      save();
      return renderHome();
    }
    case 'bundled-list':
      delete state.customList;
      notice = 'Switched back to the built-in list. Your progress is kept.';
      save();
      return renderHome();
    case 'export':
      return download(`flashcards-backup-${state.day.date}.json`, exportState(state), 'application/json');
    case 'export-flagged': {
      const rows = Object.values(state.cards)
        .filter((c) => c.flagged)
        .map((c) => [c.word, c.translation].map((v) => `"${v.replace(/"/g, '""')}"`).join(','));
      return download('flagged-cards.csv', [`${pack.name},${pack.baseName}`, ...rows].join('\n'), 'text/csv');
    }
    case 'pause': return session?.togglePause();
    case 'correct': return session?.pressCorrect();
    case 'missed': return session?.pressMissed();
    case 'flag': return session?.flag();
    case 'known': return session?.known();
    case 'end': return session?.finish();
    case 'home': return endSession();
  }
});

app.addEventListener('change', async (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.form?.classList.contains('settings')) {
    const key = input.name as keyof Settings;
    const field = SETTING_FIELDS.find((f) => f.key === key);
    const v = Number(input.value);
    if (field && Number.isFinite(v)) {
      (state.settings[key] as number) = Math.min(field.max, Math.max(field.min, v));
      save();
    }
    return;
  }
  const file = input.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    if (input.dataset.action === 'import-list') {
      const { entries: list, report } = parseWordList(text, pack.code);
      if (list.length === 0) throw new Error('No words found. Expected columns: rank, word, translation.');
      state.customList = { name: file.name, entries: list };
      notice = `Imported ${list.length} words from ${file.name}. Progress on matching words is kept.`
        + (report.duplicatePairs.length ? ` Skipped ${report.duplicatePairs.length} duplicates.` : '');
    } else if (input.dataset.action === 'restore') {
      state = parseBackup(text);
      notice = 'Progress restored.';
    }
    save();
  } catch (err) {
    notice = err instanceof Error ? err.message : String(err);
  }
  renderHome();
});

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Session ----------

function startSession(): void {
  notice = '';
  session = new Session({
    state,
    entries: entries(),
    clock: realClock,
    wallNow: () => Date.now(),
    save,
    onChange: renderSession,
  });
  void requestWakeLock();
  session.start();
  tick();
}

function endSession(): void {
  session?.timer.cancel();
  session = null;
  cancelAnimationFrame(rafId);
  void wakeLock?.release().catch(() => {});
  wakeLock = null;
  renderHome();
}

function renderSession(): void {
  if (!session) return;
  if (session.phase === 'done') {
    const s = session.summary;
    void wakeLock?.release().catch(() => {});
    wakeLock = null;
    app.innerHTML = `
      <section class="summary">
        <h1>Session done</h1>
        <dl class="stats">
          <div><dt>Reviewed</dt><dd>${s.reviewed}</dd></div>
          <div><dt>Got it</dt><dd>${s.correct}</dd></div>
          <div><dt>Missed</dt><dd>${s.missed}</dd></div>
        </dl>
        <button class="primary big" data-action="home">Done <kbd>Enter</kbd></button>
      </section>`;
    return;
  }
  const card = session.card!;
  const forward = card.direction === 'target-base';
  const prompt = forward ? card.word : card.translation;
  const answer = forward ? card.translation : card.word;
  const promptLang = forward ? pack.name : pack.baseName;
  const answerLang = forward ? pack.baseName : pack.name;
  const showAnswer = session.phase === 'answer';
  const paused = session.paused;

  app.innerHTML = `
    <section class="session ${paused ? 'is-paused' : ''}">
      <div class="topbar">
        <span>${session.summary.reviewed} done</span>
        <span class="phase">${paused ? 'Paused' : showAnswer ? 'Answer' : 'Think…'}</span>
        <button class="link" data-action="end">End</button>
      </div>
      <div class="countdown" aria-hidden="true"><div class="bar"></div></div>

      <div class="card" lang="${forward ? pack.code : 'en'}">
        <div class="lang">${esc(promptLang)}</div>
        <div class="word">${esc(prompt)}</div>
        <div class="answer ${showAnswer ? 'shown' : ''}" ${showAnswer ? '' : 'aria-hidden="true"'}>
          <div class="lang">${esc(answerLang)}</div>
          <div class="word">${showAnswer ? esc(answer) : '&nbsp;'}</div>
          ${showAnswer && session.preMarkedMissed ? '<div class="marked">Marked as missed</div>' : ''}
        </div>
      </div>

      <div class="extras">
        <button class="link" data-action="flag">Flag bad card <kbd>F</kbd></button>
        <button class="link" data-action="known">I know this <kbd>K</kbd></button>
      </div>

      <div class="controls">
        <button class="grade missed" data-action="missed" aria-label="Missed it">✗<span>Missed</span></button>
        <button class="pause" data-action="pause" aria-label="${paused ? 'Resume' : 'Pause'}">${paused ? '▶' : '❚❚'}<span>${paused ? 'Resume' : 'Pause'}</span></button>
        <button class="grade correct" data-action="correct" aria-label="${showAnswer ? 'Got it' : 'Show answer'}">✓<span>${showAnswer ? 'Got it' : 'Show'}</span></button>
      </div>
    </section>`;
}

function tick(): void {
  cancelAnimationFrame(rafId);
  const loop = () => {
    const bar = app.querySelector<HTMLElement>('.countdown .bar');
    if (bar && session) bar.style.transform = `scaleX(${session.timer.fractionLeft()})`;
    if (session && session.phase !== 'done') rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

async function requestWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
  } catch {
    wakeLock = null;
  }
}

// Auto-pause when the app is hidden (FR-22); the wake lock is dropped by the browser then.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    session?.pause();
  } else if (session && session.phase !== 'done') {
    void requestWakeLock();
  }
});

document.addEventListener('keydown', (ev) => {
  const target = ev.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
  const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;

  if (!session) {
    if (key === 'Enter') {
      ev.preventDefault();
      startSession();
    }
    return;
  }
  if (session.phase === 'done') {
    if (key === 'Enter' || key === ' ' || key === 'Escape') {
      ev.preventDefault();
      endSession();
    }
    return;
  }
  const actions: Record<string, () => void> = {
    ' ': () => session!.togglePause(),
    p: () => session!.togglePause(),
    MediaPlayPause: () => session!.togglePause(),
    ArrowRight: () => session!.pressCorrect(),
    g: () => session!.pressCorrect(),
    PageDown: () => session!.pressCorrect(),
    Enter: () => session!.pressCorrect(),
    MediaTrackNext: () => session!.pressCorrect(),
    ArrowLeft: () => session!.pressMissed(),
    r: () => session!.pressMissed(),
    PageUp: () => session!.pressMissed(),
    MediaTrackPrevious: () => session!.pressMissed(),
    f: () => session!.flag(),
    k: () => session!.known(),
    Escape: () => session!.finish(),
  };
  const action = actions[key];
  if (action) {
    ev.preventDefault();
    action();
  }
});

// Media Session lets headset / Bluetooth play-pause buttons control the session.
if ('mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('play', () => session?.resume());
    navigator.mediaSession.setActionHandler('pause', () => session?.pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => session?.pressCorrect());
    navigator.mediaSession.setActionHandler('previoustrack', () => session?.pressMissed());
  } catch {
    // Not supported for these actions in this browser.
  }
}

async function boot(): Promise<void> {
  state = (await loadState()) ?? createState(pack.code, Date.now());
  renderHome();
}

void boot();
