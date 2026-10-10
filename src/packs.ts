import { parseWordList } from './importer';
import esList from '../data/es/strommen-1000.tsv?raw';
import type { VocabEntry } from './types';

export interface LanguagePack {
  code: string;
  name: string;
  baseName: string;
  ttsLocale: string;
  sourceName: string;
  entries: VocabEntry[];
}

export function spanishPack(): LanguagePack {
  return {
    code: 'es',
    name: 'Spanish',
    baseName: 'English',
    ttsLocale: 'es-ES',
    sourceName: 'Strommen 1000 most common words',
    entries: parseWordList(esList, 'es').entries,
  };
}
