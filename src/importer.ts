import type { VocabEntry } from './types';

export interface ImportReport {
  rows: number;
  /** Source ranks that appeared more than once; file order was used instead. */
  duplicateRanks: number[];
  /** Rows whose text had whitespace or trailing punctuation removed. */
  cleaned: number;
  /** Rows dropped because the same word/translation pair appeared earlier. */
  duplicatePairs: string[];
  /** Rows dropped because a column was missing or empty. */
  skipped: number;
}

export interface ImportResult {
  entries: VocabEntry[];
  report: ImportReport;
}

export function normalizeKey(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

export function entryId(packId: string, word: string, translation: string): string {
  return `${packId}:${normalizeKey(word)}|${normalizeKey(translation)}`;
}

function cleanCell(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s,;]+$/, '');
}

/** Splits one CSV line, honouring double-quoted cells. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parses a ranked word list: `rank, target word, translation` as TSV or CSV,
 * with or without a header row. Only mechanical cleanup is done (FR-83):
 * ranks follow file order, cells are trimmed, exact duplicate pairs are dropped.
 */
export function parseWordList(text: string, packId: string): ImportResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const useTabs = lines.some((l) => l.includes('\t'));
  const report: ImportReport = { rows: 0, duplicateRanks: [], cleaned: 0, duplicatePairs: [], skipped: 0 };
  const entries: VocabEntry[] = [];
  const seenRanks = new Set<number>();
  const dupRanks = new Set<number>();
  const seenIds = new Set<string>();

  lines.forEach((line, i) => {
    const cells = useTabs ? line.split('\t') : splitCsv(line);
    const sourceRank = Number(cells[0]?.trim());
    if (i === 0 && !Number.isFinite(sourceRank)) return; // header
    report.rows++;
    if (Number.isFinite(sourceRank)) {
      if (seenRanks.has(sourceRank)) dupRanks.add(sourceRank);
      seenRanks.add(sourceRank);
    }
    if (cells.length < 3) {
      report.skipped++;
      return;
    }
    const word = cleanCell(cells[1]);
    const translation = cleanCell(cells[2]);
    if (!word || !translation) {
      report.skipped++;
      return;
    }
    if (word !== cells[1] || translation !== cells[2]) report.cleaned++;
    const id = entryId(packId, word, translation);
    if (seenIds.has(id)) {
      report.duplicatePairs.push(`${word} = ${translation}`);
      return;
    }
    seenIds.add(id);
    entries.push({ id, rank: entries.length + 1, word, translation });
  });

  report.duplicateRanks = [...dupRanks].sort((a, b) => a - b);
  return { entries, report };
}
