/**
 * Progress state shapes. This is the LOCALSTORAGE WORKING CACHE layer of
 * SPEC §5 — Round 5 wraps it in the versioned on-disk SaveFile (load file →
 * populate cache → study → write file back out).
 *
 * schemaVersion is present from day one per SPEC §5; pre-launch the v1 shape
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
  /** Best attempt EVER — dashboard never regresses on a worse retake (SPEC §9). */
  best: WorkbookBest | null;
  attempts: number;
}

export interface SessionState {
  schemaVersion: 1;
  grammar: Record<string, GrammarLessonProgress>;
}

export const EMPTY_LESSON_PROGRESS: GrammarLessonProgress = {
  readAt: null,
  best: null,
  attempts: 0,
};
