/**
 * Three-way merge of two progress states that diverged from a common base
 * (the last version both sides agreed on). Used by cloud sync when the same
 * profile was studied on two devices between syncs.
 *
 * Rule of thumb: a slice changed on only one side takes that side's value;
 * a slice changed on BOTH sides is combined so that no study is lost:
 * - vocabulary word: the side that studied the word most recently wins
 *                    (a note or exclusion edited on the other side is kept)
 * - grammar lesson:  earliest read date, best score, attempts from both sides
 * - test scores:     best of both (these boards only ever go up)
 * - streak:          the side active most recently, longest of both
 * - notepads:        both texts kept, one after the other
 * - profile:         this device's version
 *
 * `base` is null when two copies meet for the first time (no common
 * history) — then every difference counts as changed on both sides.
 */
import type { GrammarLessonProgress, SessionState, TestScores, VocabWordProgress } from '../../types/progress';
import type { StreakState } from '../../types/profile';
import { isRichEmpty, toEditableHtml } from '../richtext';

type Json = unknown;

export function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bArr = b as Json[];
    return a.length === bArr.length && a.every((v, i) => deepEqual(v, bArr[i]));
  }
  const aRec = a as Record<string, Json>;
  const bRec = b as Record<string, Json>;
  // Keys holding `undefined` are absent once serialized — ignore them.
  const aKeys = Object.keys(aRec).filter((k) => aRec[k] !== undefined);
  const bKeys = Object.keys(bRec).filter((k) => bRec[k] !== undefined);
  return aKeys.length === bKeys.length && aKeys.every((k) => deepEqual(aRec[k], bRec[k]));
}

/** Generic three-way pick; `both` resolves a true conflict. */
function pick<T>(base: T | undefined, local: T, remote: T, both: (l: T, r: T, b: T | undefined) => T, hasBase: boolean): T {
  if (deepEqual(local, remote)) return local;
  if (hasBase && deepEqual(local, base)) return remote;
  if (hasBase && deepEqual(remote, base)) return local;
  return both(local, remote, base);
}

function mergeRecord<T>(
  base: Record<string, T> | undefined,
  local: Record<string, T>,
  remote: Record<string, T>,
  both: (l: T, r: T, b: T | undefined) => T,
  hasBase: boolean,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const l = local[key];
    const r = remote[key];
    const b = base?.[key];
    const merged = pick<T | undefined>(b, l, r, (lv, rv, bv) => (lv === undefined ? rv : rv === undefined ? lv : both(lv, rv, bv)), hasBase);
    if (merged !== undefined) out[key] = merged;
  }
  return out;
}

function mergeWord(l: VocabWordProgress, r: VocabWordProgress, b: VocabWordProgress | undefined): VocabWordProgress {
  const lWins = l.lastReinforced !== r.lastReinforced ? l.lastReinforced > r.lastReinforced : l.stage >= r.stage;
  const [winner, other] = lWins ? [l, r] : [r, l];
  if (!b) return winner;
  // Personal choices (note, exclusion) don't count as study, so keep an
  // edit made on the other side even though its study state lost.
  const out = { ...winner };
  if (deepEqual(winner.note, b.note) && !deepEqual(other.note, b.note)) {
    if (other.note === undefined) delete out.note;
    else out.note = other.note;
  }
  if (winner.excluded === b.excluded && other.excluded !== b.excluded) out.excluded = other.excluded;
  return out;
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function mergeLesson(l: GrammarLessonProgress, r: GrammarLessonProgress, b: GrammarLessonProgress | undefined): GrammarLessonProgress {
  let best = l.best ?? r.best;
  if (l.best && r.best) best = r.best.correct / r.best.total > l.best.correct / l.best.total ? r.best : l.best;
  // Attempts made on each side since the base add up; without a base the
  // overlap is unknown, so the larger count is the honest lower bound.
  const attempts = b ? Math.max(0, l.attempts + r.attempts - b.attempts) : Math.max(l.attempts, r.attempts);
  return { readAt: earliest(l.readAt, r.readAt), best, attempts };
}

function mergeTestScores(l: TestScores, r: TestScores): TestScores {
  const allTime = !l.allTime ? r.allTime : !r.allTime ? l.allTime : r.allTime.score > l.allTime.score ? r.allTime : l.allTime;
  let today = l.today ?? r.today;
  if (l.today && r.today) {
    if (l.today.date !== r.today.date) today = l.today.date > r.today.date ? l.today : r.today;
    else today = r.today.score > l.today.score ? r.today : l.today;
  }
  return { allTime, today };
}

function mergeStreak(l: StreakState, r: StreakState): StreakState {
  const la = l.lastActiveDate ?? '';
  const ra = r.lastActiveDate ?? '';
  const winner = la !== ra ? (la > ra ? l : r) : r.current > l.current ? r : l;
  return { ...winner, longest: Math.max(l.longest, r.longest, winner.current) };
}

/** Marks where the other device's notes begin when both edited the same notepad. */
export const NOTE_MERGE_DIVIDER = '<p><b>From your other device:</b></p>';

function mergeNotes(l: string, r: string): string {
  if (isRichEmpty(toEditableHtml(l))) return r;
  if (isRichEmpty(toEditableHtml(r))) return l;
  return `${toEditableHtml(l)}${NOTE_MERGE_DIVIDER}${toEditableHtml(r)}`;
}

export function mergeSessions(base: SessionState | null, local: SessionState, remote: SessionState): SessionState {
  const has = base !== null;
  return {
    schemaVersion: 1,
    profile: pick(base?.profile, local.profile, remote.profile, (l) => l, has),
    grammar: mergeRecord(base?.grammar, local.grammar, remote.grammar, mergeLesson, has),
    vocabulary: mergeRecord(base?.vocabulary, local.vocabulary, remote.vocabulary, mergeWord, has),
    testScores: mergeTestScores(local.testScores, remote.testScores),
    streak: pick(base?.streak, local.streak, remote.streak, mergeStreak, has),
    notepad: pick(base?.notepad, local.notepad, remote.notepad, mergeNotes, has),
    grammarNotepad: pick(base?.grammarNotepad, local.grammarNotepad, remote.grammarNotepad, mergeNotes, has),
  };
}
