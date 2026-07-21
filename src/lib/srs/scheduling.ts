/**
 * Scheduling (date-gated re-eligibility) + the cosmetic freshness axis
 * Pure functions over VocabWordProgress.
 */
import type { VocabWordProgress } from '../../types/progress';
import { STAGE_INTERVAL_DAYS, type Stage } from './stages';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a word becomes quiz-eligible again after being answered while at
 * `stage`. Difficult words resurface at half the interval, so they show up
 * more often regardless of stage.
 */
export function nextDueAt(stage: Stage, answeredAt: number, difficult: boolean): number {
  const days = STAGE_INTERVAL_DAYS[stage] * (difficult ? 0.5 : 1);
  return answeredAt + days * DAY_MS;
}

export function isDue(progress: VocabWordProgress, now: number): boolean {
  return now >= progress.dueAt;
}

/**
 * Freshness ∈ [0.35, 1]: purely cosmetic brightness driven by time since a
 * word was last seen in ANY mode. Fades linearly to its floor over 30 days —
 * it signals "not reinforced lately", never "forgotten", so it deliberately
 * never reaches zero.
 */
export function freshness(lastReinforced: number, now: number): number {
  const days = Math.max(0, now - lastReinforced) / DAY_MS;
  return Math.max(0.35, 1 - (days / 30) * 0.65);
}
