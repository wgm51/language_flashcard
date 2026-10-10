# language_flashcard
A language flashcard app that requires minimum interation with the screen.

See [REQUIREMENTS.md](REQUIREMENTS.md) for the full requirements. The starter Spanish word list is in [`data/es/strommen-1000.tsv`](data/es/strommen-1000.tsv).

## Running the app

Requires Node 20+.

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # production build in dist/ (installable, works offline)
```

### How it works (MVP)
- Press **Start**. Each word shows for a few seconds, then the answer appears on its own.
- Do nothing to count it as **got it**, or press **✗ Missed** (or `←`). `Space` pauses.
- New words come in frequency order: 10 a day, in batches of 5. The next batch
  opens once you've got every word in the current one right.
- Progress is saved in the browser. Use **Word list & backup** to export it or
  to import a different word list.
