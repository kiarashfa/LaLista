import { describe, expect, it } from 'vitest';
import { freshness, isDue, nextDueAt } from './scheduling';
import { dotsFor, stageAfterCorrect, stageAfterWrong, type Stage } from './stages';
import { SessionQueue } from './sessionQueue';

const DAY = 24 * 60 * 60 * 1000;

describe('stage transitions', () => {
  it('correct bumps one stage, capped at Mastered', () => {
    expect(stageAfterCorrect(0)).toBe(1);
    expect(stageAfterCorrect(5)).toBe(6);
    expect(stageAfterCorrect(6)).toBe(6);
  });
  it('wrong drops one stage but never back to New once started', () => {
    expect(stageAfterWrong(6)).toBe(5);
    expect(stageAfterWrong(2)).toBe(1);
    expect(stageAfterWrong(1)).toBe(1); // floor: Learning 1
    expect(stageAfterWrong(0)).toBe(0); // a never-learned word just stays New
  });
});

describe('scheduling (date gates)', () => {
  it('gates Familiar+ by coarse day intervals', () => {
    const t = 1_000_000;
    expect(nextDueAt(3, t, false)).toBe(t + 1 * DAY);
    expect(nextDueAt(4, t, false)).toBe(t + 3 * DAY);
    expect(nextDueAt(5, t, false)).toBe(t + 7 * DAY);
    expect(nextDueAt(6, t, false)).toBe(t + 21 * DAY);
    expect(nextDueAt(1, t, false)).toBe(t); // Learning: same-session
  });
  it('difficult words resurface at half interval', () => {
    expect(nextDueAt(6, 0, true)).toBe(10.5 * DAY);
  });
  it('isDue compares against dueAt', () => {
    const p = { stage: 3, lastReinforced: 0, dueAt: 100, misses: 0, difficult: false };
    expect(isDue(p, 99)).toBe(false);
    expect(isDue(p, 100)).toBe(true);
  });
});

describe('freshness (cosmetic axis)', () => {
  it('starts full and fades toward a floor, never zero', () => {
    expect(freshness(0, 0)).toBe(1);
    expect(freshness(0, 15 * DAY)).toBeCloseTo(1 - 0.325, 5);
    expect(freshness(0, 30 * DAY)).toBeCloseTo(0.35, 5);
    expect(freshness(0, 365 * DAY)).toBe(0.35);
  });
});

describe('stage dots', () => {
  it('unseen empty, Mastered full', () => {
    expect(dotsFor(0)).toBe(0);
    expect(dotsFor(3)).toBe(4);
    expect(dotsFor(6)).toBe(7);
  });
});

describe('SessionQueue', () => {
  const drain = (q: SessionQueue, onQuiz?: (id: string, n: number) => 'correct' | 'wrong' | 'skip') => {
    const seen: { wordId: string; kind: string }[] = [];
    let quizCount = 0;
    for (let i = 0; i < 500; i++) {
      const item = q.next();
      if (!item) break;
      seen.push(item);
      if (item.kind === 'quiz') {
        quizCount++;
        q.report(item.wordId, onQuiz?.(item.wordId, quizCount) ?? 'correct');
      }
    }
    return seen;
  };

  it('first batch: 3 study cards, then a strict subset quizzed (2 of 3)', () => {
    const q = new SessionQueue({ newWords: ['a', 'b', 'c'], dueWords: [], difficult: new Set() });
    const seen = drain(q);
    expect(seen.slice(0, 3).map((s) => s.kind)).toEqual(['study', 'study', 'study']);
    const quizzes = seen.filter((s) => s.kind === 'quiz');
    expect(quizzes.length).toBe(2); // subset, not all 3
  });

  it('later batches quiz everything and pull back earlier-session words', () => {
    const q = new SessionQueue({ newWords: ['a', 'b', 'c', 'd', 'e', 'f'], dueWords: [], difficult: new Set() });
    const seen = drain(q);
    const batch2Words = ['d', 'e', 'f'];
    const batch2Quizzes = seen.filter((s) => s.kind === 'quiz' && batch2Words.includes(s.wordId));
    expect(batch2Quizzes.length).toBe(3); // all of batch 2
    // At least one earlier-batch word re-quizzed after batch 2's studies begin
    const batch2Start = seen.findIndex((s) => s.kind === 'study' && batch2Words.includes(s.wordId));
    const pullbacks = seen.slice(batch2Start).filter((s) => s.kind === 'quiz' && ['a', 'b', 'c'].includes(s.wordId));
    expect(pullbacks.length).toBeGreaterThanOrEqual(1);
  });

  it('due words from previous sessions are quizzed before anything new', () => {
    const q = new SessionQueue({ newWords: ['n1'], dueWords: ['d1', 'd2'], difficult: new Set() });
    const first = q.next()!;
    expect(first.kind).toBe('quiz');
    expect(['d1', 'd2']).toContain(first.wordId);
  });

  it('wrong answers resurface a few cards later in the same session', () => {
    const q = new SessionQueue({ newWords: ['a', 'b', 'c', 'd', 'e', 'f'], dueWords: [], difficult: new Set() });
    let failedOnce = false;
    const seen = drain(q, (id) => {
      if (id === 'a' && !failedOnce) {
        failedOnce = true;
        return 'wrong';
      }
      return 'correct';
    });
    const aQuizzes = seen.filter((s) => s.kind === 'quiz' && s.wordId === 'a').length;
    if (failedOnce) expect(aQuizzes).toBeGreaterThanOrEqual(2);
  });

  it('every introduced word eventually gets quizzed at least once (no orphans except first-batch subset)', () => {
    const q = new SessionQueue({ newWords: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], dueWords: [], difficult: new Set() });
    const seen = drain(q);
    const studied = new Set(seen.filter((s) => s.kind === 'study').map((s) => s.wordId));
    expect(studied.size).toBe(7);
    const quizzed = new Set(seen.filter((s) => s.kind === 'quiz').map((s) => s.wordId));
    // All but at most one (the first-batch un-quizzed one) get quizzed
    expect(quizzed.size).toBeGreaterThanOrEqual(6);
  });

  it('retire removes a word from the whole session (mark-as-known)', () => {
    const q = new SessionQueue({ newWords: ['a', 'b', 'c', 'd', 'e', 'f'], dueWords: [], difficult: new Set() });
    q.retire('a');
    const seen = drain(q);
    expect(seen.some((s) => s.wordId === 'a')).toBe(false);
  });

  it('jumpTo puts a new word up next as study→quiz', () => {
    const q = new SessionQueue({ newWords: ['a', 'b', 'c', 'z'], dueWords: [], difficult: new Set() });
    q.jumpTo('z', true);
    expect(q.next()).toEqual({ wordId: 'z', kind: 'study' });
    expect(q.next()).toEqual({ wordId: 'z', kind: 'quiz' });
  });
});
