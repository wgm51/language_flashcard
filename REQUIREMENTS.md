# Language Flashcard App — Requirements

Status: draft v1 · Last updated: 2026-10-10

Priorities use MoSCoW: **Must**, **Should**, **Could**, **Won't (v1)**.

---

## 1. Overview

A flashcard web app for learning vocabulary and verb conjugations with spaced repetition,
designed to need **as little screen interaction as possible**.

- **Primary language:** Spanish (English ↔ Spanish).
- **Swappable languages:** the word list and grammar data are loaded from a *language pack*.
  Switching to another language, especially a Romance language with conjugated verbs
  (Italian, Portuguese, French, Catalan, Romanian), requires new data files only, no code
  changes.

### Goals
1. Daily study that works hands-free: cards advance on timers, and silence counts as
   "I knew it."
2. Learn the most useful words first, in order of frequency.
3. Introduce new words in manageable chunks so the review load stays sustainable.
4. Keep the engine language-agnostic, including conjugation.

### Non-goals (v1)
- User accounts, cloud sync, social features.
- Native iOS/Android apps (the PWA is installable instead).
- AI/speech grading of answers.

---

## 2. Users & use cases

- **Single learner** with ergonomic limitations. They use a phone and a desktop and want to
  minimize taps and clicks.
- Typical session: 5–20 minutes. Open the app, press start, watch cards cycle, and tap
  only when a word was missed.
- Occasional tasks: change settings, import a new word list, switch languages, view stats.

---

## 3. Functional requirements

### 3.1 Hands-free auto-play review (primary mode)

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-1 | Must | Each card shows the **prompt** word for a user-set **prompt duration** (seconds, e.g. 1–30, default 4). |
| FR-2 | Must | **Direction toggle:** English→Spanish or Spanish→English. *Could:* a "mixed" option that alternates or randomizes direction. |
| FR-3 | Must | When the prompt timer ends, the **answer** in the other language is revealed automatically and stays for a user-set **answer duration** (default 4 s). |
| FR-4 | Must | While the answer is showing, display a large **green ✓ (got it)** button and a large **red ✗ (missed it)** button. |
| FR-5 | Must | If the user does **not** press anything before the answer timer ends, the card is graded **correct** and the next card starts automatically. |
| FR-6 | Must | Pressing green or red grades the card immediately and advances (no waiting for the timer). |
| FR-7 | Must | A visible countdown (progress bar or ring) shows time left in each phase. |
| FR-8 | Must | Every control has a keyboard equivalent. Defaults: `Space` = pause/resume, `→`/`G` = correct, `←`/`R` = missed, `F` = flag card. Keys can be remapped. |
| FR-9 | Should | Works with Bluetooth page-turner/presentation remotes and media keys, which send arrow, page or media key events. |
| FR-10 | Should | Keep the screen awake during a session (Screen Wake Lock API). |
| FR-11 | Must | The session ends when the due queue is empty, or when an optional user limit (card count or minutes) is reached. A summary is then shown. |
| FR-12 | Must | Settings persist across sessions: durations, direction, limits, key mappings. |
| FR-13 | Could | A manual mode (tap to flip) for users who prefer it. |

### 3.2 Pause

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-20 | Must | A large **pause/resume** button is always visible during a session (and `Space` / remote). |
| FR-21 | Must | Pausing **freezes the timer mid-phase**. A paused card is never auto-graded "correct". Resume continues the same phase with the remaining time. |
| FR-22 | Must | The app auto-pauses when the tab or app goes to the background or the screen locks (Page Visibility API). |
| FR-23 | Should | While paused, show options to resume, end the session, or open settings. |

### 3.3 Spaced repetition

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-30 | Must | Schedule cards with **FSRS** (SM-2 acceptable as a fallback). Target retention is configurable (default 90%). |
| FR-31 | Must | Auto-play grading is binary: **red = Again**, **green or timeout = Good**. |
| FR-32 | Could | Optional 4-button grading (Again/Hard/Good/Easy) in manual mode. |
| FR-33 | Must | The queue order is (1) learning/relearning cards due now, (2) review cards due today, (3) new cards (see 3.5). |
| FR-34 | Must | Store a review log for every answer: card, timestamp, grade, whether it timed out, response time. |
| FR-35 | Must | The two directions of a word (EN→ES, ES→EN) are scheduled as **separate cards**. A user can enable either direction or both. |

### 3.4 Frequency-ordered new words

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-40 | Must | Each vocab entry has a frequency **rank**. New cards are introduced in rank order, most common first. |
| FR-41 | Must | The user can mark a word **"already know"**, which skips it or schedules it far out, and can **suspend** a card. |
| FR-42 | Should | The user can filter which new words are introduced by tag or part of speech without losing frequency order. |
| FR-43 | Should | A **"flag this card"** action (key, remote or button, no typing) hides a bad card and records it in a cleanup list that can be exported. |
| FR-44 | Could | When a verb is introduced, its conjugation cards unlock. The most common tenses come first (Spanish: present indicative → preterite → imperfect → …). |

### 3.5 Chunked introduction of new words

Research summary: there is no controlled-study "optimal" number. The consensus among
spaced-repetition guides and language learners is **10–20 new cards per day**, starting
around 10. Teachers' advice is often **5–10**. A practical rule of thumb from the Anki
manual is that learning 20 new cards a day leads to about 200 reviews a day after a few
months, so a lower default keeps auto-play sessions short. Sources are listed in §10.

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-50 | Must | **Daily new-word limit:** default **10**, adjustable 0–25 (higher allowed with a warning). Each word counts once, even when both directions are enabled. |
| FR-51 | Must | New words are introduced in **mini-batches of 5** (configurable 3–10). The next batch unlocks only after every card in the current batch has been graded correct at least once in a row (configurable to 2). |
| FR-52 | Must | **Review-load guard:** if the number of due reviews exceeds a threshold (default 100), the new-word limit for that day is reduced or set to zero automatically, with a notice. |
| FR-53 | Should | A **"more new words"** button allows one extra batch on demand. |
| FR-54 | Should | A **forecast** shows expected daily reviews over the next 30 days at the current settings. |

### 3.6 Card types

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-60 | Must | **Vocab card:** word ↔ translation, in either direction. |
| FR-61 | Should | **Conjugation card:** prompt "infinitive + tense + person" (e.g. *tener · present · nosotros*) → answer *tenemos*. Works in auto-play: show the prompt, then reveal the answer. |
| FR-62 | Could | **Example sentence/cloze card** when the pack provides examples. |
| FR-63 | Could | **Pronunciation:** optional text-to-speech (Web Speech API) of the target-language word when a card is shown, in the pack's locale (e.g. `es-ES`, `es-MX`). Can be turned on or off. |

### 3.7 Conjugation engine (language-agnostic)

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-70 | Should | Generate regular forms from **per-language rule tables** (conjugation class → endings for each tense and person). |
| FR-71 | Should | Per-verb **irregular overrides** for any tense/person cell, plus stem-change and spelling-change rules (e.g. `e→ie`, `c→qu`). |
| FR-72 | Should | Support reflexive verbs (pronoun added) and compound tenses (auxiliary + participle). The auxiliary is defined per language: *haber*, *avere/essere*, *avoir/être*. |
| FR-73 | Should | The learner chooses which **tenses and persons** to study (e.g. present only, skip *vosotros*). |
| FR-74 | Could | A pack "lint" reports verbs whose generated forms look wrong or are missing. |

### 3.8 Language packs, import & export

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-80 | Must | Load a language pack (see §4). Several packs can be installed; one is active at a time. Progress is kept separately for each pack. |
| FR-81 | Must | **Import a ranked word list** from CSV/TSV (`rank, target word, translation`, plus optional columns) or JSON. |
| FR-82 | Must | **Safe list swapping:** importing a new list replaces the new-word order. Cards already studied **keep their progress** when they match on (target word, translation). Unmatched old cards can be kept or retired, as the user chooses. |
| FR-83 | Must | Import does only mechanical cleanup: trims whitespace and stray trailing punctuation, uses file order when a rank is duplicated or missing, and reports what it changed. |
| FR-84 | Must | **Export and restore progress** (settings, cards, review log) as a JSON file for backup. |
| FR-85 | Should | Export the flagged-card cleanup list as CSV. |

### 3.9 Stats

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-90 | Should | Show cards due today, new words left today, words learned, and current streak. |
| FR-91 | Could | Retention rate over time, review forecast chart, and hardest cards. |

---

## 4. Language pack specification

A pack is a folder (or a single zipped bundle) with:

```
packs/es/
  language.json    # metadata + grammar definition
  vocab.json       # or vocab.tsv — ranked word list
  verbs.json       # optional — conjugation data
```

### 4.1 `language.json`

```json
{
  "code": "es",
  "name": "Spanish",
  "base_language": "en",
  "tts_locale": "es-ES",
  "special_characters": ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"],
  "persons": [
    { "id": "1s", "label": "yo" },
    { "id": "2s", "label": "tú" },
    { "id": "3s", "label": "él/ella/usted" },
    { "id": "1p", "label": "nosotros" },
    { "id": "2p", "label": "vosotros" },
    { "id": "3p", "label": "ellos/ellas/ustedes" }
  ],
  "tenses": [
    { "id": "pres", "label": "present", "mood": "indicative", "order": 1 },
    { "id": "pret", "label": "preterite", "mood": "indicative", "order": 2 },
    { "id": "impf", "label": "imperfect", "mood": "indicative", "order": 3 },
    { "id": "fut", "label": "future", "mood": "indicative", "order": 4 },
    { "id": "cond", "label": "conditional", "mood": "indicative", "order": 5 },
    { "id": "subj_pres", "label": "present subjunctive", "mood": "subjunctive", "order": 6 }
  ],
  "conjugation_classes": {
    "ar": {
      "pres": ["o", "as", "a", "amos", "áis", "an"],
      "pret": ["é", "aste", "ó", "amos", "asteis", "aron"]
    },
    "er": {
      "pres": ["o", "es", "e", "emos", "éis", "en"],
      "pret": ["í", "iste", "ió", "imos", "isteis", "ieron"]
    },
    "ir": {
      "pres": ["o", "es", "e", "imos", "ís", "en"],
      "pret": ["í", "iste", "ió", "imos", "isteis", "ieron"]
    }
  },
  "frequency_source": {
    "name": "Strommen Inc — 1000 Most Common Spanish Words",
    "url": "https://strommeninc.com/1000-most-common-spanish-words-frequency-vocabulary/",
    "license": "unknown — personal use"
  }
}
```

Another Romance language supplies its own `persons`, `tenses` and `conjugation_classes`.
For example, Italian uses `are`/`ere`/`ire` and French uses its verb groups. The engine
just applies the tables.

### 4.2 Vocab entry

Required: `id`, `rank`, `word`, `translation`. Everything else is optional and reserved so
a better list can fill it in later.

```json
{
  "id": "es-0020-palabra",
  "rank": 20,
  "word": "palabra",
  "translation": "word",
  "pos": "noun",
  "gender": "f",
  "plural": "palabras",
  "lemma": "palabra",
  "form_of": null,
  "example": "No entiendo esa palabra.",
  "tags": ["top-100"],
  "needs_review": false
}
```

- `lemma` / `form_of`: link an inflected form (e.g. `era`) to its dictionary form (`ser`).
- `needs_review`: excludes the card from study until it is fixed.
- `id` must be stable across list updates so progress survives edits (see FR-82).

### 4.3 Verb entry

```json
{ "infinitive": "hablar", "translation": "to speak", "class": "ar" }
```

```json
{
  "infinitive": "tener",
  "translation": "to have",
  "class": "er",
  "stem_change": { "pres": { "from": "e", "to": "ie", "persons": ["2s", "3s", "3p"] } },
  "irregular": {
    "pres": { "1s": "tengo" },
    "pret": ["tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron"],
    "fut_stem": "tendr"
  },
  "reflexive": false
}
```

### 4.4 Validation

- A JSON Schema validates each file when it is loaded. Errors name the file, the entry and
  the field.
- A pack linter warns about duplicate IDs, missing translations, verbs with unknown
  classes, and conjugation cells that cannot be generated.

---

## 5. Initial word list (v1)

- **Source:** Strommen Inc, "1000 Most Common Spanish Words"
  (<https://strommeninc.com/1000-most-common-spanish-words-frequency-vocabulary/>), stored
  unchanged in [`data/es/strommen-1000.tsv`](data/es/strommen-1000.tsv) (columns:
  `Number`, `Spanish`, `in English`; 1,000 rows).
- **Decision:** use it **as-is** for now. It will be replaced by a better or longer list
  later through FR-81/82.

### Known limitations of this list
- It appears to be an **English** frequency list that was machine-translated, so the order
  reflects English usage, and some translations are wrong in context. Examples:
  `lata`=can, `sierra`=saw, `auto`=self, `satélite`=sat, `ahora`=far, `gusta`=idea,
  `unidad`=drive, `lo hará`=will.
- **Duplicate Spanish words** with different English meanings: `su` ×4, `que` ×4, `en` ×3,
  `caliente` ×3, `lugar` ×3, `hecho` ×3. Each row stays a separate card in v1.
- **Inflected forms** instead of dictionary forms: `era`, `son`, `tenido`, `hizo`, `vino`,
  and others. Linking them to infinitives (`form_of`) is a later improvement.
- **Rank typos:** 921 (should be 821), 284 (should be 824) and 840 (should be 849) each
  appear twice. The importer uses row order (FR-83).
- Stray punctuation: `a su vez,`, `por tanto,`, `particular,`.
- No part of speech or gender columns.

FR-43 (flag card) is the low-effort way to clean bad entries during normal study.

---

## 6. Non-functional requirements

| ID | Pri | Requirement |
|----|-----|-------------|
| NFR-1 | Must | **Web app / PWA:** installable, works **fully offline** after first load. |
| NFR-2 | Must | **Local-first storage** in IndexedDB. No backend or account needed in v1. |
| NFR-3 | Must | **Responsive:** works on phone (portrait) and desktop. Buttons on the phone layout are large (≥ 64 px) and within thumb reach. |
| NFR-4 | Must | **Timing accuracy:** phase timers are accurate to ±100 ms and don't drift when the app is paused or backgrounded. |
| NFR-5 | Must | Card transitions render in < 200 ms. The app loads in < 2 s on a mid-range phone. |
| NFR-6 | Should | **Accessibility:** WCAG 2.1 AA contrast, full keyboard operation, screen-reader labels, and red/green buttons also distinguished by icon and position (not color alone). Reduced-motion setting respected. |
| NFR-7 | Should | Large, adjustable font size for the card word. Light and dark themes. |
| NFR-8 | Must | No data leaves the device unless the user exports it. |
| NFR-9 | Should | Unit tests cover the scheduler, batching logic, importer and conjugation engine. |

---

## 7. Data model (conceptual)

- **LanguagePack** — `code`, metadata, grammar tables, version.
- **VocabEntry / VerbEntry** — from the pack (§4).
- **Card** — `id`, `pack`, `entry_id`, `type` (vocab | conjugation), `direction`, and for
  conjugation `tense` and `person`; FSRS state (`due`, `stability`, `difficulty`, `reps`,
  `lapses`, `state`); `suspended`, `flagged`, `batch_id`.
- **ReviewLog** — `card_id`, `timestamp`, `grade`, `timed_out`, `response_ms`.
- **Batch** — `id`, `date`, `card_ids`, `unlocked`, `completed`.
- **Settings** — durations, direction(s), limits, batch size, key map, theme, active pack.

---

## 8. Suggested technology (non-binding)

- TypeScript + Vite; React or Svelte for the UI.
- `ts-fsrs` for scheduling.
- Dexie.js (IndexedDB) for storage.
- Workbox / `vite-plugin-pwa` for offline support.
- JSON Schema (Ajv) for pack validation; Vitest for unit tests; Playwright for an
  end-to-end auto-play test.

---

## 9. Milestones & acceptance criteria

**M1 — MVP: hands-free Spanish vocab**
- Imports `data/es/strommen-1000.tsv`. New words appear in rank order, 10 per day, in
  batches of 5.
- Auto-play runs a full session using only the keyboard, or with no input at all.
  Timeouts are graded correct, and red/green work.
- Pause freezes the timer, and backgrounding the app auto-pauses.
- FSRS schedules cards, and progress persists across reloads and offline.

**M2 — Conjugation drills**
- Spanish present, preterite and imperfect for regular verbs plus about 20 common
  irregular verbs, as auto-play conjugation cards.
- Tense and person selection works.

**M3 — Portability**
- Swap to a new Spanish list without losing progress on matching cards (FR-82).
- Add a second Romance language pack (e.g. Italian) using **data only**, with no code
  changes.

**M4 — Polish**
- Stats and forecast, TTS, remote/media-key support, flag-card export.

---

## 10. Research sources (new-word pacing)

The figures below are practitioner heuristics, not results of controlled studies.

- Migaku — *Best Anki Settings for Language Learning*:
  <https://migaku.com/blog/language-fun/anki-settings-for-language-learning>
- StudyCardsAI — *Anki settings for language learning*:
  <https://studycardsai.com/blog/anki-settings-for-language-learning>
- RevisionDojo — *How many new words should you learn each day?*:
  <https://revisiondojo.com/blog/how-many-new-words-should-you-learn-each-day-in-your-target-language>
- StoryLearning — *How many words can you learn per day*:
  <https://storylearning.com/how-many-words-can-you-learn-per-day>
- SpanishDict — *Learn 1,000 Words in 15 Hours*:
  <https://spanishdict.com/guide/learn-1000-words-in-15-hours>
- Anki manual rule of thumb: 20 new cards/day ≈ 200 reviews/day once the backlog matures.

---

## 11. Open questions

1. Default prompt and answer durations: start at 4 s / 4 s and tune after use?
2. Which Spanish dialect for TTS and for *vosotros*: Spain (`es-ES`) or Latin America
   (`es-MX`, *vosotros* hidden by default)?
3. Should conjugation cards ever ask EN→ES ("we have" → *tenemos*), or only
   infinitive + person → form?
4. The longer word list: source, format, and whether it includes part of speech and
   gender.
