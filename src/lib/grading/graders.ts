/**
 * One pure grading function per exercise type.
 *
 * Normalization philosophy: lenient on case and whitespace, STRICT on accents
 * and ñ — accents are frequently the very thing being tested (él/el, hablo/
 * habló), so stripping them would grade wrong answers as right. Unicode is
 * NFC-normalized so decomposed input (é as e+◌́) still compares equal.
 */
import type {
  ClozePassageExercise,
  ConjugationGridExercise,
  ErrorCorrectionExercise,
  FillBlankExercise,
  GenderAgreementExercise,
  MatchingPairsExercise,
  MultipleChoiceExercise,
  SentenceReorderExercise,
  SentenceTransformationExercise,
} from '../../types/exercises';

/** Case/whitespace-lenient, accent-strict canonical form of an answer. */
export function normalizeAnswer(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Strips the ´ (acute) and ¨ (diaeresis) marks ONLY — for tilde-forgiveness
 * ("Estas" for "Estás" is the right conjugation with a
 * spelling slip, not a wrong answer). The ñ is deliberately NOT stripped:
 * it's a distinct letter, not an accent (año ≠ ano).
 */
export function stripSpanishAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0301\u0308]/g, '').normalize('NFC');
}

/**
 * Tri-state grade for typed answers:
 *  - 'correct' — exact (case/whitespace-lenient, accents right)
 *  - 'accent'  — right answer except acute/diaeresis marks (forgiven, taught)
 *  - 'wrong'   — anything else
 */
export type TypedGrade = 'correct' | 'accent' | 'wrong';

export function gradeTyped(expected: string, actual: string, sentence = false): TypedGrade {
  const eq = sentence
    ? sentenceEquals
    : (a: string, b: string) => normalizeAnswer(a) === normalizeAnswer(b);
  if (eq(expected, actual)) return 'correct';
  if (eq(stripSpanishAccents(expected), stripSpanishAccents(actual))) return 'accent';
  return 'wrong';
}

/**
 * Sentence comparison: normalized equality, additionally forgiving a missing
 * trailing period. Question/exclamation marks are NOT forgiven — ¿…? / ¡…!
 * pairs are real Spanish punctuation grammar, not decoration.
 */
export function sentenceEquals(expected: string, actual: string): boolean {
  const e = normalizeAnswer(expected);
  const a = normalizeAnswer(actual);
  if (e === a) return true;
  const strip = (s: string) => (s.endsWith('.') ? s.slice(0, -1) : s);
  return strip(e) === strip(a);
}

export function gradeMultipleChoice(ex: MultipleChoiceExercise | GenderAgreementExercise, selected: string): boolean {
  return selected === ex.correctAnswer;
}

export function gradeFillBlank(ex: FillBlankExercise, answer: string): TypedGrade {
  return gradeTyped(ex.correctAnswer, answer);
}

export function gradeErrorCorrection(ex: ErrorCorrectionExercise, answer: string): TypedGrade {
  return gradeTyped(ex.correctSentence, answer, true);
}

export function gradeSentenceTransformation(ex: SentenceTransformationExercise, answer: string): TypedGrade {
  return gradeTyped(ex.correctAnswer, answer, true);
}

export interface GridResult {
  cells: Record<string, TypedGrade>;
  /** No cell wrong — accent-only misses are forgiven (and taught in the UI). */
  correct: boolean;
  accentMisses: number;
}

/** All blanks must be at least accent-close for the exercise to count. */
export function gradeConjugationGrid(ex: ConjugationGridExercise, answers: Record<string, string>): GridResult {
  const cells: Record<string, TypedGrade> = {};
  for (const pronoun of ex.blankForms) {
    cells[pronoun] = gradeTyped(ex.correctAnswers[pronoun] ?? '', answers[pronoun] ?? '');
  }
  const values = Object.values(cells);
  return {
    cells,
    correct: values.every((v) => v !== 'wrong'),
    accentMisses: values.filter((v) => v === 'accent').length,
  };
}

/** Exact order, exact strings (validator guarantees words/correctOrder are the same multiset). */
export function gradeSentenceReorder(ex: SentenceReorderExercise, order: string[]): boolean {
  return order.length === ex.correctOrder.length && order.every((w, i) => w === ex.correctOrder[i]);
}

/** Matching runs interactively; a proposed pair is checked one at a time. */
export function isMatchingPair(ex: MatchingPairsExercise, left: string, right: string): boolean {
  return ex.pairs.some((p) => p.left === left && p.right === right);
}

export interface ClozeResult {
  blanks: TypedGrade[];
  /** No blank wrong — accent-only misses are forgiven (and taught in the UI). */
  correct: boolean;
  accentMisses: number;
}

export function gradeClozePassage(ex: ClozePassageExercise, answers: string[]): ClozeResult {
  const blanks = ex.blanks.map((expected, i) => gradeTyped(expected, answers[i] ?? ''));
  return {
    blanks,
    correct: blanks.every((b) => b !== 'wrong'),
    accentMisses: blanks.filter((b) => b === 'accent').length,
  };
}
