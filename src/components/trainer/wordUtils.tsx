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
 * 4/6/3 answer choices (SPEC §8): the correct Spanish + distractors drawn
 * from the same topic group, preferring the same part of speech. Words whose
 * English matches the target are excluded — a synonym would create a second
 * right answer.
 */
export function buildChoices(word: Word, pool: Word[], count: number, rng: () => number = Math.random): string[] {
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
      if (!picked.includes(w.spanish)) picked.push(w.spanish);
    }
  }
  const options = [word.spanish, ...picked];
  // Deterministic-ish shuffle position for the correct answer
  return shuffle(options);
}
