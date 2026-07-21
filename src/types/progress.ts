/**
 * Progress state shapes. This is the LOCALSTORAGE WORKING CACHE layer of
 * the save system — the versioned on-disk SaveFile wraps it (load file →
 * populate cache → study → write file back out).
 *
 * schemaVersion is present from day one; pre-launch the v1 shape
 * may still grow in place (no real users yet) — after launch, changes require
 * a migration.
 */

export interface WorkbookBest {
  correct: number;
  total: number;
  /** ISO timestamp of the best attempt. */
  at: string;
}

export interface GrammarLessonProgress {
  /** ISO timestamp of the manual "I've read this" action; null = unread. */
  readAt: string | null;
  /** Best attempt EVER — dashboard never regresses on a worse retake. */
  best: WorkbookBest | null;
  attempts: number;
}

/** Per-word SRS state. Only words the user has touched get an entry. */
export interface VocabWordProgress {
  /** 0=New … 6=Mastered (see src/lib/srs/stages.ts). Only Group Study changes this. */
  stage: number;
  /** Epoch ms of last exposure in ANY mode — drives cosmetic freshness only. */
  lastReinforced: number;
  /** Epoch ms when the word becomes quiz-eligible again in Group Study. */
  dueAt: number;
  /** Wrong answers in Group Study (skips excluded); ≥2 auto-flags difficult. */
  misses: number;
  /** In the difficult-words bucket (auto via misses, or manual mark). */
  difficult: boolean;
  /** User-excluded from Review & Test — the word is never prompted there. */
  excluded: boolean;
}

export interface TestBest {
  score: number;
  /** ISO timestamp. */
  at: string;
}

export interface TestScores {
  allTime: TestBest | null;
  /** Best today; `date` is YYYY-MM-DD so a new day starts a fresh board. */
  today: { score: number; date: string } | null;
}

export interface SessionState {
  schemaVersion: 1;
  /** null until the user creates or loads a profile. */
  profile: import('./profile').ProfileInfo | null;
  grammar: Record<string, GrammarLessonProgress>;
  vocabulary: Record<string, VocabWordProgress>;
  testScores: TestScores;
  streak: import('./profile').StreakState;
  notepad: string;
}

export const EMPTY_LESSON_PROGRESS: GrammarLessonProgress = {
  readAt: null,
  best: null,
  attempts: 0,
};

export function newWordProgress(now: number): VocabWordProgress {
  return { stage: 0, lastReinforced: now, dueAt: now, misses: 0, difficult: false, excluded: false };
}
