import { describe, expect, it } from 'vitest';
import { deepEqual, mergeSessions, NOTE_MERGE_DIVIDER } from './merge';
import type { SessionState, VocabWordProgress } from '../../types/progress';

const T0 = new Date(2026, 8, 1, 12).getTime();

function word(over: Partial<VocabWordProgress> = {}): VocabWordProgress {
  return { stage: 1, lastReinforced: T0, dueAt: T0, misses: 0, difficult: false, excluded: false, ...over };
}

function state(over: Partial<SessionState> = {}): SessionState {
  return {
    schemaVersion: 1,
    profile: { name: 'Kia', avatar: { kind: 'emoji', value: '🦊' }, createdAt: '2026-07-18T10:00:00.000Z' },
    grammar: {},
    vocabulary: {},
    testScores: { allTime: null, today: null },
    streak: { current: 1, longest: 1, lastActiveDate: '2026-09-01' },
    notepad: '',
    grammarNotepad: '',
    ...over,
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('deepEqual', () => {
  it('ignores key order and undefined-valued keys', () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1, note: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});

describe('mergeSessions', () => {
  it('takes the only side that changed', () => {
    const base = state({ vocabulary: { w1: word() } });
    const local = clone(base);
    const remote = clone(base);
    remote.vocabulary.w1 = word({ stage: 3, lastReinforced: T0 + 5 });
    remote.vocabulary.w2 = word();
    const merged = mergeSessions(base, local, remote);
    expect(merged.vocabulary).toEqual(remote.vocabulary);
    expect(mergeSessions(base, remote, local).vocabulary).toEqual(remote.vocabulary);
  });

  it('combines words studied on different devices', () => {
    const base = state({ vocabulary: { a: word(), b: word() } });
    const local = clone(base);
    const remote = clone(base);
    local.vocabulary.a = word({ stage: 2, lastReinforced: T0 + 10 });
    remote.vocabulary.b = word({ stage: 4, lastReinforced: T0 + 20 });
    remote.vocabulary.c = word({ stage: 1, lastReinforced: T0 + 30 });
    const merged = mergeSessions(base, local, remote);
    expect(merged.vocabulary.a.stage).toBe(2);
    expect(merged.vocabulary.b.stage).toBe(4);
    expect(merged.vocabulary.c.stage).toBe(1);
  });

  it('a word studied on both devices keeps the most recent study', () => {
    const base = state({ vocabulary: { a: word() } });
    const local = clone(base);
    const remote = clone(base);
    local.vocabulary.a = word({ stage: 2, lastReinforced: T0 + 100 });
    remote.vocabulary.a = word({ stage: 5, lastReinforced: T0 + 50 });
    expect(mergeSessions(base, local, remote).vocabulary.a.stage).toBe(2);
    expect(mergeSessions(base, remote, local).vocabulary.a.stage).toBe(2);
  });

  it("keeps a note added on the device whose study state lost", () => {
    const base = state({ vocabulary: { a: word() } });
    const local = clone(base);
    const remote = clone(base);
    local.vocabulary.a = word({ note: 'rojo = red' }); // note only, no study
    remote.vocabulary.a = word({ stage: 3, lastReinforced: T0 + 60, excluded: true });
    expect(mergeSessions(base, local, remote).vocabulary.a).toEqual(word({ stage: 3, lastReinforced: T0 + 60, excluded: true, note: 'rojo = red' }));
  });

  it('grammar: earliest read, best score, attempts summed from both sides', () => {
    const lesson = { readAt: '2026-09-01T10:00:00Z', best: { correct: 5, total: 10, at: 'x' }, attempts: 2 };
    const base = state({ grammar: { 'lesson-01': lesson } });
    const local = clone(base);
    const remote = clone(base);
    local.grammar['lesson-01'] = { ...lesson, attempts: 3, best: { correct: 9, total: 10, at: 'l' } };
    remote.grammar['lesson-01'] = { ...lesson, readAt: '2026-08-30T10:00:00Z', attempts: 4, best: { correct: 7, total: 10, at: 'r' } };
    expect(mergeSessions(base, local, remote).grammar['lesson-01']).toEqual({
      readAt: '2026-08-30T10:00:00Z',
      best: { correct: 9, total: 10, at: 'l' },
      attempts: 5, // 2 base + 1 local + 2 remote
    });
  });

  it('test scores keep the best of both; a later day wins "today"', () => {
    const local = state({ testScores: { allTime: { score: 12, at: 'a' }, today: { score: 12, date: '2026-09-02' } } });
    const remote = state({ testScores: { allTime: { score: 15, at: 'b' }, today: { score: 3, date: '2026-09-03' } } });
    expect(mergeSessions(state(), local, remote).testScores).toEqual({
      allTime: { score: 15, at: 'b' },
      today: { score: 3, date: '2026-09-03' },
    });
  });

  it('streak follows the most recently active side and keeps the longest', () => {
    const base = state({ streak: { current: 4, longest: 9, lastActiveDate: '2026-09-01' } });
    const local = state({ streak: { current: 5, longest: 9, lastActiveDate: '2026-09-02' } });
    const remote = state({ streak: { current: 1, longest: 10, lastActiveDate: '2026-09-03' } });
    expect(mergeSessions(base, local, remote).streak).toEqual({ current: 1, longest: 10, lastActiveDate: '2026-09-03' });
  });

  it('keeps both notepads when both were edited', () => {
    const base = state({ notepad: 'hola' });
    const local = state({ notepad: 'hola <b>mundo</b>' });
    const remote = state({ notepad: 'adiós' });
    expect(mergeSessions(base, local, remote).notepad).toBe(`hola <b>mundo</b>${NOTE_MERGE_DIVIDER}adiós`);
    // An emptied side doesn't produce a divider.
    expect(mergeSessions(null, state({ notepad: '' }), remote).notepad).toBe('adiós');
  });

  it('without a base, differences combine instead of one side winning blindly', () => {
    const local = state({ vocabulary: { a: word({ stage: 2, lastReinforced: T0 + 9 }) }, notepad: 'x' });
    const remote = state({ vocabulary: { a: word({ stage: 6, lastReinforced: T0 + 1 }), b: word() }, notepad: 'x' });
    const merged = mergeSessions(null, local, remote);
    expect(merged.vocabulary.a.stage).toBe(2);
    expect(merged.vocabulary.b).toBeDefined();
    expect(merged.notepad).toBe('x');
  });

  it('is idempotent: merging a state with itself changes nothing', () => {
    const s = state({ vocabulary: { a: word() }, notepad: 'n', grammar: { g: { readAt: null, best: null, attempts: 1 } } });
    expect(mergeSessions(s, clone(s), clone(s))).toEqual(s);
    expect(mergeSessions(null, clone(s), clone(s))).toEqual(s);
  });
});
