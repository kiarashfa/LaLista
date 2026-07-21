/**
 * Daily streak: consecutive days with any study activity.
 * Qualifying activity (the spec's "reasonable default", revisit after use):
 * a Group Study answer, a Review/Test answer, a finished workbook attempt,
 * or marking a lesson read — the storage layer calls touch() on each.
 */
import type { StreakState } from '../../types/profile';

export function localDateString(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function previousDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateString(new Date(y, m - 1, d - 1).getTime());
}

export function emptyStreak(): StreakState {
  return { current: 0, longest: 0, lastActiveDate: null };
}

/** Returns the streak after a qualifying activity at `now` (pure). */
export function touchStreak(streak: StreakState, now: number): StreakState {
  const today = localDateString(now);
  if (streak.lastActiveDate === today) return streak;
  const current = streak.lastActiveDate === previousDate(today) ? streak.current + 1 : 1;
  return { current, longest: Math.max(current, streak.longest), lastActiveDate: today };
}

/** What the streak is worth right now for display (a missed day shows 0). */
export function effectiveStreak(streak: StreakState, now: number): number {
  const today = localDateString(now);
  if (streak.lastActiveDate === today || streak.lastActiveDate === previousDate(today)) return streak.current;
  return 0;
}
