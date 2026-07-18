/**
 * localStorage working cache (SPEC §5): auto-saved continuously during study
 * for crash safety. The file-on-disk source of truth and its load/save UI
 * arrive in Round 5 and read/write through this same layer.
 */
import type { GrammarLessonProgress, SessionState } from '../../types/progress';
import { EMPTY_LESSON_PROGRESS } from '../../types/progress';

const KEY = 'lalista:session';

function emptySession(): SessionState {
  return { schemaVersion: 1, grammar: {} };
}

export function loadSession(): SessionState {
  if (typeof localStorage === 'undefined') return emptySession();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as SessionState;
    if (parsed?.schemaVersion !== 1 || typeof parsed.grammar !== 'object' || !parsed.grammar) {
      return emptySession();
    }
    return parsed;
  } catch {
    return emptySession();
  }
}

export function updateSession(mutate: (state: SessionState) => void): SessionState {
  const state = loadSession();
  mutate(state);
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function getLessonProgress(lessonId: string): GrammarLessonProgress {
  return loadSession().grammar[lessonId] ?? { ...EMPTY_LESSON_PROGRESS };
}

export function markLessonRead(lessonId: string): void {
  updateSession((state) => {
    const current = state.grammar[lessonId] ?? { ...EMPTY_LESSON_PROGRESS };
    if (!current.readAt) current.readAt = new Date().toISOString();
    state.grammar[lessonId] = current;
  });
}

/** Records an attempt; keeps the best score ever (by fraction correct). */
export function recordWorkbookAttempt(
  lessonId: string,
  correct: number,
  total: number,
): { best: NonNullable<GrammarLessonProgress['best']>; improved: boolean } {
  let improved = false;
  let best!: NonNullable<GrammarLessonProgress['best']>;
  updateSession((state) => {
    const current = state.grammar[lessonId] ?? { ...EMPTY_LESSON_PROGRESS };
    current.attempts += 1;
    const prev = current.best;
    if (!prev || correct / total > prev.correct / prev.total) {
      current.best = { correct, total, at: new Date().toISOString() };
      improved = true;
    }
    best = current.best!;
    state.grammar[lessonId] = current;
  });
  return { best, improved };
}
