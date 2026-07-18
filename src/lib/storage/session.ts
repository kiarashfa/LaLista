/**
 * localStorage working cache (SPEC §5): auto-saved continuously during study
 * for crash safety. The file-on-disk source of truth and its load/save UI
 * arrive in Round 5 and read/write through this same layer.
 */
import type { GrammarLessonProgress, SessionState, VocabWordProgress } from '../../types/progress';
import { EMPTY_LESSON_PROGRESS, newWordProgress } from '../../types/progress';
import type { ProfileInfo, SaveFile } from '../../types/profile';
import { nextDueAt, freshness } from '../srs/scheduling';
import { DIFFICULT_MISS_THRESHOLD, MASTERED, stageAfterCorrect, stageAfterWrong, type Stage } from '../srs/stages';
import { sessionFromSaveFile } from './saveFile';
import { emptyStreak, touchStreak } from './streak';

const KEY = 'lalista:session';
const MODIFIED_KEY = 'lalista:modifiedAt';
const SAVED_KEY = 'lalista:savedAt';

function emptySession(): SessionState {
  return {
    schemaVersion: 1,
    profile: null,
    grammar: {},
    vocabulary: {},
    testScores: { allTime: null, today: null },
    streak: emptyStreak(),
    notepad: '',
  };
}

export function loadSession(): SessionState {
  if (typeof localStorage === 'undefined') return emptySession();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    if (parsed?.schemaVersion !== 1 || typeof parsed.grammar !== 'object' || !parsed.grammar) {
      return emptySession();
    }
    // Fill slices added to v1 during pre-launch development.
    return { ...emptySession(), ...parsed } as SessionState;
  } catch {
    return emptySession();
  }
}

export function updateSession(mutate: (state: SessionState) => void): SessionState {
  const state = loadSession();
  mutate(state);
  localStorage.setItem(KEY, JSON.stringify(state));
  localStorage.setItem(MODIFIED_KEY, String(Date.now()));
  return state;
}

// ---------- Profile & save-file lifecycle (SPEC §5) ----------

export function getProfile(): ProfileInfo | null {
  return loadSession().profile;
}

/** "Start fresh" — creates the profile; any anonymous progress made before is adopted. */
export function createProfile(profile: ProfileInfo): void {
  updateSession((state) => {
    state.profile = profile;
  });
}

/** Populate the working cache from a loaded save file (SPEC §5 step 2). */
export function applyLoadedSaveFile(file: SaveFile): void {
  localStorage.setItem(KEY, JSON.stringify(sessionFromSaveFile(file)));
  const now = String(Date.now());
  localStorage.setItem(MODIFIED_KEY, now);
  localStorage.setItem(SAVED_KEY, now); // freshly loaded = in sync with disk
}

/** "Switch profile / Done for now" — closes the session (never framed as logout). */
export function closeSession(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(MODIFIED_KEY);
  localStorage.removeItem(SAVED_KEY);
}

export function markSavedNow(): void {
  localStorage.setItem(SAVED_KEY, String(Date.now()));
}

/** True when the cache has changes the user hasn't written to their file. */
export function hasUnsavedChanges(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const modified = Number(localStorage.getItem(MODIFIED_KEY) ?? 0);
  if (!modified) return false;
  return modified > Number(localStorage.getItem(SAVED_KEY) ?? 0);
}

export function setNotepad(text: string): void {
  updateSession((state) => {
    state.notepad = text;
  });
}

/** Any qualifying study activity marks today for the streak (SPEC §9). */
function touchActivity(state: SessionState, now: number): void {
  state.streak = touchStreak(state.streak, now);
}

export function getLessonProgress(lessonId: string): GrammarLessonProgress {
  return loadSession().grammar[lessonId] ?? { ...EMPTY_LESSON_PROGRESS };
}

export function markLessonRead(lessonId: string): void {
  updateSession((state) => {
    touchActivity(state, Date.now());
    const current = state.grammar[lessonId] ?? { ...EMPTY_LESSON_PROGRESS };
    if (!current.readAt) current.readAt = new Date().toISOString();
    state.grammar[lessonId] = current;
  });
}

// ---------- Vocabulary (SPEC §3/§8) ----------

export function getWordProgress(wordId: string, now = Date.now()): VocabWordProgress {
  return loadSession().vocabulary[wordId] ?? newWordProgress(now);
}

export function getAllWordProgress(): Record<string, VocabWordProgress> {
  return loadSession().vocabulary;
}

function withWord(
  wordId: string,
  now: number,
  fn: (p: VocabWordProgress) => void,
  opts: { activity?: boolean } = {},
): VocabWordProgress {
  let result!: VocabWordProgress;
  updateSession((state) => {
    if (opts.activity) touchActivity(state, now);
    const p = state.vocabulary[wordId] ?? newWordProgress(now);
    fn(p);
    state.vocabulary[wordId] = p;
    result = p;
  });
  return result;
}

/** GROUP STUDY answer — the only path that changes stage. */
export function applyGroupStudyAnswer(wordId: string, correct: boolean, now = Date.now()): VocabWordProgress {
  return withWord(wordId, now, (p) => {
    const stage = p.stage as Stage;
    p.stage = correct ? stageAfterCorrect(stage) : stageAfterWrong(stage);
    if (!correct) {
      p.misses += 1;
      if (p.misses >= DIFFICULT_MISS_THRESHOLD) p.difficult = true;
    }
    p.lastReinforced = now;
    p.dueAt = nextDueAt(p.stage as Stage, now, p.difficult);
  }, { activity: true });
}

/** Skip: resurfaces like a miss but NO difficult-bucket strike (SPEC §8). */
export function applySkip(wordId: string, now = Date.now()): VocabWordProgress {
  return withWord(wordId, now, (p) => {
    p.lastReinforced = now;
    p.dueAt = now; // immediately re-eligible — the session queue re-inserts it
  });
}

export function markDifficult(wordId: string, now = Date.now()): VocabWordProgress {
  return withWord(wordId, now, (p) => {
    p.difficult = true;
    p.dueAt = Math.min(p.dueAt, nextDueAt(p.stage as Stage, now, true));
  });
}

/** User-asserted override → straight to Mastered (confirm first — SPEC §8). */
export function markKnown(wordId: string, now = Date.now()): VocabWordProgress {
  return withWord(wordId, now, (p) => {
    p.stage = MASTERED;
    p.difficult = false;
    p.lastReinforced = now;
    p.dueAt = nextDueAt(MASTERED, now, false);
  });
}

/** Review/Test exposure — refreshes brightness only, never touches stage. */
export function refreshReinforced(wordId: string, now = Date.now()): VocabWordProgress {
  return withWord(wordId, now, (p) => {
    p.lastReinforced = now;
  }, { activity: true });
}

export function wordFreshness(wordId: string, now = Date.now()): number {
  return freshness(getWordProgress(wordId, now).lastReinforced, now);
}

/** Records a Test score; returns which boards it beat (SPEC §9: all-time + today). */
export function recordTestScore(score: number, now = Date.now()): { newAllTime: boolean; newToday: boolean } {
  const date = new Date(now).toISOString().slice(0, 10);
  let newAllTime = false;
  let newToday = false;
  updateSession((state) => {
    touchActivity(state, now);
    const t = state.testScores;
    if (!t.allTime || score > t.allTime.score) {
      t.allTime = { score, at: new Date(now).toISOString() };
      newAllTime = true;
    }
    if (!t.today || t.today.date !== date || score > t.today.score) {
      t.today = { score, date };
      newToday = true;
    }
  });
  return { newAllTime, newToday };
}

// ---------- Grammar workbook ----------

/** Records an attempt; keeps the best score ever (by fraction correct). */
export function recordWorkbookAttempt(
  lessonId: string,
  correct: number,
  total: number,
): { best: NonNullable<GrammarLessonProgress['best']>; improved: boolean } {
  let improved = false;
  let best!: NonNullable<GrammarLessonProgress['best']>;
  updateSession((state) => {
    touchActivity(state, Date.now());
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
