import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { entryId, parseWordList } from './importer';

describe('parseWordList', () => {
  it('parses the bundled Spanish list with only mechanical cleanup', () => {
    const text = readFileSync(new URL('../data/es/strommen-1000.tsv', import.meta.url), 'utf8');
    const { entries, report } = parseWordList(text, 'es');

    expect(report.rows).toBe(1000);
    expect(report.duplicateRanks).toEqual([284, 840, 921]);
    // "caliente = hot" appears twice (rows 19 and 387).
    expect(report.duplicatePairs).toEqual(['caliente = hot']);
    expect(entries).toHaveLength(999);
    expect(entries[0]).toMatchObject({ rank: 1, word: 'como', translation: 'as' });
    expect(entries.map((e) => e.rank)).toEqual(entries.map((_, i) => i + 1));
    // Rows sharing a Spanish word but with different meanings stay separate.
    expect(entries.filter((e) => e.word === 'su')).toHaveLength(4);
    // Stray trailing punctuation is trimmed.
    expect(entries.find((e) => e.translation === 'turn')?.word).toBe('a su vez');
  });

  it('accepts CSV with quotes and no header', () => {
    const { entries } = parseWordList('1,"hola, amigo",hello\n2,gato,cat\n', 'es');
    expect(entries.map((e) => e.word)).toEqual(['hola, amigo', 'gato']);
  });

  it('uses file order for ranks and skips incomplete rows', () => {
    const { entries, report } = parseWordList('rank\tword\ttranslation\n5\tperro\tdog\n5\tgato\n1\tsol\tsun', 'es');
    expect(entries.map((e) => [e.rank, e.word])).toEqual([[1, 'perro'], [2, 'sol']]);
    expect(report.skipped).toBe(1);
    expect(report.duplicateRanks).toEqual([5]);
  });

  it('builds ids that ignore case and spacing', () => {
    expect(entryId('es', ' Cerrar ', 'Close')).toBe(entryId('es', 'cerrar', 'close'));
  });
});
