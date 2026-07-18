/**
 * The staged-levels SRS model (SPEC §3) — deliberately simple, not SM-2.
 *
 *   New → Learning 1 → Learning 2 → Familiar → Practiced → Known → Mastered
 *
 * Only GROUP STUDY moves `stage`. Review/Test refresh `lastReinforced` only
 * (the freshness axis, scheduling.ts) and can never demote a word.
 */

export const STAGE_NAMES = ['New', 'Learning 1', 'Learning 2', 'Familiar', 'Practiced', 'Known', 'Mastered'] as const;

/** Stage as an index into STAGE_NAMES: 0=New … 6=Mastered. */
export type Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const NEW: Stage = 0;
export const LEARNING_1: Stage = 1;
export const MASTERED: Stage = 6;

/**
 * Days a word must wait after being answered at (i.e. having just reached)
 * each stage before it's quiz-eligible again. New/Learning stages repeat
 * within the same session (SPEC §3).
 */
export const STAGE_INTERVAL_DAYS: Record<Stage, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 1, // Familiar ≈ next day
  4: 3, // Practiced ≈ 3 days
  5: 7, // Known ≈ 7 days
  6: 21, // Mastered ≈ 21 days
};

/** Correct answer bumps one stage up (caps at Mastered). */
export function stageAfterCorrect(stage: Stage): Stage {
  return Math.min(stage + 1, MASTERED) as Stage;
}

/**
 * Wrong answer drops one stage back — but never to zero (SPEC §3): a word
 * that has left New can floor at Learning 1. A still-New word just stays New.
 */
export function stageAfterWrong(stage: Stage): Stage {
  if (stage === NEW) return NEW;
  return Math.max(stage - 1, LEARNING_1) as Stage;
}

/**
 * Misses (wrong answers in Group Study) needed to auto-flag a word as
 * difficult (SPEC §3's "regress 2+ times"). Skips never count (SPEC §8 —
 * honest skipping must not be penalized like guessing).
 */
export const DIFFICULT_MISS_THRESHOLD = 2;

/**
 * Sidebar dot display: 7 dots. A never-studied word shows 0; each stage past
 * New fills stage+1 dots so Mastered fills all 7. (The one-dot state is
 * deliberately unused — unseen-empty and Mastered-full both read correctly,
 * which matters more than arithmetic purity.)
 */
export function dotsFor(stage: Stage): number {
  return stage === NEW ? 0 : stage + 1;
}
