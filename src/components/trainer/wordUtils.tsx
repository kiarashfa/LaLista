/** Shared helpers for the vocabulary trainer islands. */
import type { ReactNode } from 'react';
import { shuffle } from '../../lib/shuffle';
import { normalizeEnglish } from '../../lib/duplicateDetection';
import type { Word } from '../../types/word';

/** Renders the workbook's **bold** markers in an example sentence. */
export function renderExample(example: string): ReactNode[] {
  return example.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>));
}

export const POS_LABEL: Record<Word['partOfSpeech'], string> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adjective',
  adverb: 'adverb',
  pronoun: 'pronoun',
  preposition: 'preposition',
  conjunction: 'conjunction',
  interjection: 'interjection',
  'noun-adjective': 'noun/adjective',
};

export const GENDER_LABEL: Record<Exclude<Word['gender'], null>, string> = {
  masc: 'el · masculine',
  fem: 'la · feminine',
  neut: 'neuter',
  invariable: 'invariable',
  'masc-fem': 'el/la',
};

/**
 * Quiz direction/mode. Group Study stays 'en-es';
 * Review and Test let the user choose, including the two listening modes.
 */
export type QuizMode = 'en-es' | 'es-en' | 'listen-es' | 'listen-en';

export const MODE_INFO: Record<QuizMode, { title: string; desc: string }> = {
  'en-es': { title: 'EN → ES', desc: 'See the English, pick the Spanish.' },
  'es-en': { title: 'ES → EN', desc: 'See the Spanish, pick the meaning.' },
  'listen-es': { title: '🔊 Listen → ES', desc: 'Hear the word, pick the Spanish spelling.' },
  'listen-en': { title: '🔊 Listen → EN', desc: 'Hear the word, pick the meaning.' },
};

/** Which word field the answer options are drawn from for a given mode. */
export function optionFieldFor(mode: QuizMode): 'spanish' | 'english' {
  return mode.endsWith('-es') ? 'spanish' : 'english';
}

/**
 * 4/6/3 answer choices: the correct answer + distractors drawn
 * from the same topic group, preferring the same part of speech. Candidates
 * sharing the target's Spanish OR normalized English are excluded — a twin
 * or synonym would create a second right answer (critical for listening
 * modes, where e.g. both senses of "claro" sound identical).
 */
export function buildChoices(word: Word, pool: Word[], count: number, field: 'spanish' | 'english' = 'spanish'): string[] {
  const targetEnglish = normalizeEnglish(word.english);
  const usable = pool.filter(
    (w) => w.id !== word.id && w.spanish !== word.spanish && normalizeEnglish(w.english) !== targetEnglish,
  );
  const samePos = usable.filter((w) => w.partOfSpeech === word.partOfSpeech);
  const rest = usable.filter((w) => w.partOfSpeech !== word.partOfSpeech);

  const picked: string[] = [];
  for (const source of [shuffle(samePos), shuffle(rest)]) {
    for (const w of source) {
      if (picked.length >= count - 1) break;
      if (!picked.includes(w[field]) && w[field] !== word[field]) picked.push(w[field]);
    }
  }
  return shuffle([word[field], ...picked]);
}
