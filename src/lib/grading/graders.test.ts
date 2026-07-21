import { describe, expect, it } from 'vitest';
import {
  gradeClozePassage,
  gradeConjugationGrid,
  gradeErrorCorrection,
  gradeFillBlank,
  gradeMultipleChoice,
  gradeSentenceReorder,
  gradeSentenceTransformation,
  isMatchingPair,
  normalizeAnswer,
  sentenceEquals,
} from './graders';
import { scoreBand } from './thresholds';

describe('normalizeAnswer', () => {
  it('is lenient on case and whitespace', () => {
    expect(normalizeAnswer('  Como   pan ')).toBe('como pan');
  });
  it('is STRICT on accents — they are often the tested content', () => {
    expect(normalizeAnswer('hablo')).not.toBe(normalizeAnswer('habló'));
    expect(normalizeAnswer('el')).not.toBe(normalizeAnswer('él'));
  });
  it('treats composed and decomposed Unicode as equal (NFC)', () => {
    expect(normalizeAnswer('excursión')).toBe(normalizeAnswer('excursión'));
  });
});

describe('sentenceEquals', () => {
  it('forgives a missing trailing period', () => {
    expect(sentenceEquals('No como carne.', 'no como carne')).toBe(true);
  });
  it('does not forgive missing question marks (real Spanish punctuation)', () => {
    expect(sentenceEquals('¿Dónde está?', 'Dónde está')).toBe(false);
  });
});

describe('graders', () => {
  it('multiple-choice: exact option match', () => {
    const ex = { id: 'x', type: 'multiple-choice', prompt: '', options: ['como', 'comes'], correctAnswer: 'comes' } as const;
    expect(gradeMultipleChoice(ex, 'comes')).toBe(true);
    expect(gradeMultipleChoice(ex, 'como')).toBe(false);
  });

  it('fill-blank: tri-state — accent-only miss is forgiven but flagged', () => {
    const ex = { id: 'x', type: 'fill-blank', prompt: '', correctAnswer: 'comí' } as const;
    expect(gradeFillBlank(ex, ' Comí ')).toBe('correct');
    expect(gradeFillBlank(ex, 'comi')).toBe('accent');
    expect(gradeFillBlank(ex, 'como')).toBe('wrong');
  });

  it('accent forgiveness never forgives ñ (a letter, not a tilde)', () => {
    const ex = { id: 'x', type: 'fill-blank', prompt: '', correctAnswer: 'año' } as const;
    expect(gradeFillBlank(ex, 'ano')).toBe('wrong');
    const ex2 = { id: 'x', type: 'fill-blank', prompt: '', correctAnswer: 'vergüenza' } as const;
    expect(gradeFillBlank(ex2, 'verguenza')).toBe('accent'); // diaeresis is forgiven
  });

  it('error-correction: sentence-lenient compare with accent tri-state', () => {
    const ex = {
      id: 'x',
      type: 'error-correction',
      prompt: '',
      incorrectSentence: 'Tu estas cansado.',
      correctSentence: 'Tú estás cansado.',
    } as const;
    expect(gradeErrorCorrection(ex, 'tú estás cansado')).toBe('correct');
    expect(gradeErrorCorrection(ex, 'Tu estas cansado.')).toBe('accent');
    expect(gradeErrorCorrection(ex, 'Tú es cansado.')).toBe('wrong');
  });

  it('sentence-transformation grades like error-correction', () => {
    const ex = {
      id: 'x',
      type: 'sentence-transformation',
      prompt: '',
      originalSentence: 'Como carne.',
      instruction: 'make negative',
      correctAnswer: 'No como carne.',
    } as const;
    expect(gradeSentenceTransformation(ex, 'no como carne')).toBe('correct');
  });

  it('conjugation-grid: per-cell tri-state; accent misses forgiven, wrong cells not', () => {
    const ex = {
      id: 'x',
      type: 'conjugation-grid',
      prompt: '',
      verb: 'beber',
      givenForms: { yo: 'bebo' },
      blankForms: ['tú', 'vosotros'],
      correctAnswers: { 'tú': 'bebes', 'vosotros': 'bebéis' },
    } as const;
    const accentOnly = gradeConjugationGrid(ex, { 'tú': 'bebes', 'vosotros': 'bebeis' });
    expect(accentOnly.cells['tú']).toBe('correct');
    expect(accentOnly.cells['vosotros']).toBe('accent');
    expect(accentOnly.correct).toBe(true); // forgiven
    expect(accentOnly.accentMisses).toBe(1);
    const withWrong = gradeConjugationGrid(ex, { 'tú': 'bebo', 'vosotros': 'bebéis' });
    expect(withWrong.correct).toBe(false);
    expect(gradeConjugationGrid(ex, { 'tú': 'Bebes', 'vosotros': 'bebéis' }).correct).toBe(true);
  });

  it('sentence-reorder: exact sequence', () => {
    const ex = {
      id: 'x',
      type: 'sentence-reorder',
      prompt: '',
      words: ['pan', 'Como'],
      correctOrder: ['Como', 'pan'],
    } as const;
    expect(gradeSentenceReorder(ex, ['Como', 'pan'])).toBe(true);
    expect(gradeSentenceReorder(ex, ['pan', 'Como'])).toBe(false);
    expect(gradeSentenceReorder(ex, ['Como'])).toBe(false);
  });

  it('matching-pairs: individual pair checks', () => {
    const ex = {
      id: 'x',
      type: 'matching-pairs',
      prompt: '',
      pairs: [
        { left: 'comer', right: 'to eat' },
        { left: 'beber', right: 'to drink' },
      ],
    } as const;
    expect(isMatchingPair(ex, 'comer', 'to eat')).toBe(true);
    expect(isMatchingPair(ex, 'comer', 'to drink')).toBe(false);
  });

  it('cloze-passage: per-blank tri-state, wrong blanks fail, accent blanks forgiven', () => {
    const ex = {
      id: 'x',
      type: 'cloze-passage',
      prompt: '',
      passage: 'Yo {0} y él {1}.',
      blanks: ['comí', 'come'],
    } as const;
    const r = gradeClozePassage(ex, ['comí', 'comes']);
    expect(r.blanks).toEqual(['correct', 'wrong']);
    expect(r.correct).toBe(false);
    const r2 = gradeClozePassage(ex, ['comi', 'come']);
    expect(r2.blanks).toEqual(['accent', 'correct']);
    expect(r2.correct).toBe(true);
    expect(r2.accentMisses).toBe(1);
  });
});

describe('scoreBand (80/50 thresholds)', () => {
  it('bands correctly at the boundaries', () => {
    expect(scoreBand(8, 10)).toBe('good');
    expect(scoreBand(7, 10)).toBe('fair');
    expect(scoreBand(5, 10)).toBe('fair');
    expect(scoreBand(4, 10)).toBe('poor');
    expect(scoreBand(0, 0)).toBe('none');
  });
});
