/**
 * One pure grading function per exercise type (SPEC folder contract).
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

export function gradeFillBlank(ex: FillBlankExercise, answer: string): boolean {
  return normalizeAnswer(ex.correctAnswer) === normalizeAnswer(answer);
}

export function gradeErrorCorrection(ex: ErrorCorrectionExercise, answer: string): boolean {
  return sentenceEquals(ex.correctSentence, answer);
}

export function gradeSentenceTransformation(ex: SentenceTransformationExercise, answer: string): boolean {
  return sentenceEquals(ex.correctAnswer, answer);
}

export interface GridResult {
  cells: Record<string, boolean>;
  correct: boolean;
}

/** All blanks must be right for the exercise to count (complete-the-grid). */
export function gradeConjugationGrid(ex: ConjugationGridExercise, answers: Record<string, string>): GridResult {
  const cells: Record<string, boolean> = {};
  for (const pronoun of ex.blankForms) {
    cells[pronoun] = normalizeAnswer(ex.correctAnswers[pronoun] ?? '') === normalizeAnswer(answers[pronoun] ?? '');
  }
  return { cells, correct: Object.values(cells).every(Boolean) };
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
  blanks: boolean[];
  correct: boolean;
}

export function gradeClozePassage(ex: ClozePassageExercise, answers: string[]): ClozeResult {
  const blanks = ex.blanks.map((expected, i) => normalizeAnswer(expected) === normalizeAnswer(answers[i] ?? ''));
  return { blanks, correct: blanks.every(Boolean) };
}
