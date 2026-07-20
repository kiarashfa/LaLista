/**
 * The 9 workbook exercise types (Grammar.md §4).
 * Field sets verified against all 528 authored exercises — `note` appears on
 * multiple-choice, error-correction and gender-agreement.
 */

export const BOOT_PRONOUNS = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'] as const;
export type BootPronoun = (typeof BOOT_PRONOUNS)[number];

interface ExerciseBase {
  id: string;
  prompt: string;
  note?: string;
}

export interface MultipleChoiceExercise extends ExerciseBase {
  type: 'multiple-choice';
  options: string[];
  correctAnswer: string;
}

export interface FillBlankExercise extends ExerciseBase {
  type: 'fill-blank';
  correctAnswer: string;
}

export interface ErrorCorrectionExercise extends ExerciseBase {
  type: 'error-correction';
  incorrectSentence: string;
  correctSentence: string;
}

export interface ConjugationGridExercise extends ExerciseBase {
  type: 'conjugation-grid';
  verb: string;
  givenForms: Partial<Record<BootPronoun, string>>;
  blankForms: BootPronoun[];
  correctAnswers: Partial<Record<BootPronoun, string>>;
}

export interface SentenceReorderExercise extends ExerciseBase {
  type: 'sentence-reorder';
  words: string[];
  correctOrder: string[];
}

export interface GenderAgreementExercise extends ExerciseBase {
  type: 'gender-agreement';
  word: string;
  options: string[];
  correctAnswer: string;
}

export interface SentenceTransformationExercise extends ExerciseBase {
  type: 'sentence-transformation';
  originalSentence: string;
  instruction: string;
  correctAnswer: string;
}

export interface MatchingPairsExercise extends ExerciseBase {
  type: 'matching-pairs';
  pairs: { left: string; right: string }[];
}

export interface ClozePassageExercise extends ExerciseBase {
  type: 'cloze-passage';
  /** Blanks appear as {0}, {1}, … */
  passage: string;
  blanks: string[];
}

export type Exercise =
  | MultipleChoiceExercise
  | FillBlankExercise
  | ErrorCorrectionExercise
  | ConjugationGridExercise
  | SentenceReorderExercise
  | GenderAgreementExercise
  | SentenceTransformationExercise
  | MatchingPairsExercise
  | ClozePassageExercise;

export type ExerciseType = Exercise['type'];
