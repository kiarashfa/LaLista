import { describe, expect, it } from 'vitest';
import { buildSaveFile, parseSaveFile, sessionFromSaveFile } from './saveFile';
import { effectiveStreak, emptyStreak, localDateString, touchStreak } from './streak';
import { saveFileName } from '../../types/profile';
import type { SessionState } from '../../types/progress';

const DAY = 24 * 60 * 60 * 1000;
// Noon avoids any DST-edge weirdness in local-date math.
const NOON = new Date(2026, 6, 18, 12, 0, 0).getTime();

describe('streak (SPEC §9)', () => {
  it('first activity starts a 1-day streak', () => {
    const s = touchStreak(emptyStreak(), NOON);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
    expect(s.lastActiveDate).toBe(localDateString(NOON));
  });
  it('same-day activity is a no-op', () => {
    const s1 = touchStreak(emptyStreak(), NOON);
    const s2 = touchStreak(s1, NOON + 3600_000);
    expect(s2).toEqual(s1);
  });
  it('next-day activity extends; a gap resets to 1 but keeps longest', () => {
    let s = touchStreak(emptyStreak(), NOON);
    s = touchStreak(s, NOON + DAY);
    s = touchStreak(s, NOON + 2 * DAY);
    expect(s.current).toBe(3);
    s = touchStreak(s, NOON + 5 * DAY); // skipped two days
    expect(s.current).toBe(1);
    expect(s.longest).toBe(3);
  });
  it('effectiveStreak shows 0 once a day has been missed', () => {
    const s = touchStreak(emptyStreak(), NOON);
    expect(effectiveStreak(s, NOON + DAY)).toBe(1); // yesterday active — still alive
    expect(effectiveStreak(s, NOON + 2 * DAY)).toBe(0); // missed a day
  });
});

function demoState(): SessionState {
  return {
    schemaVersion: 1,
    profile: { name: 'Kia', avatar: { kind: 'emoji', value: '🦊' }, createdAt: new Date(NOON).toISOString() },
    grammar: { 'lesson-22': { readAt: 'x', best: { correct: 7, total: 9, at: 'y' }, attempts: 2 } },
    vocabulary: { colors_rojo: { stage: 6, lastReinforced: NOON, dueAt: NOON, misses: 0, difficult: false } },
    testScores: { allTime: { score: 5, at: 'z' }, today: null },
    streak: { current: 3, longest: 5, lastActiveDate: '2026-07-18' },
    notepad: 'hola',
  };
}

describe('save file (SPEC §5)', () => {
  it('build → serialize → parse → apply roundtrips losslessly', () => {
    const file = buildSaveFile(demoState(), NOON);
    const parsed = parseSaveFile(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const restored = sessionFromSaveFile(parsed.file);
    expect(restored).toEqual(demoState());
  });

  it('rejects non-JSON as unreadable', () => {
    expect(parseSaveFile('definitely not json')).toEqual({ ok: false, error: 'unreadable' });
  });

  it('rejects unrelated JSON as not-lalista', () => {
    expect(parseSaveFile('{"foo": 1}')).toEqual({ ok: false, error: 'not-lalista' });
    expect(parseSaveFile('[1,2,3]')).toEqual({ ok: false, error: 'not-lalista' });
  });

  it('detects a newer schema version explicitly (never silently misreads)', () => {
    const file = { ...buildSaveFile(demoState(), NOON), schemaVersion: 2 };
    expect(parseSaveFile(JSON.stringify(file))).toEqual({ ok: false, error: 'version-newer' });
  });

  it('flags right-format-but-broken contents as corrupt', () => {
    const broken = { format: 'lalista-progress', schemaVersion: 1, profile: { name: '' } };
    expect(parseSaveFile(JSON.stringify(broken))).toEqual({ ok: false, error: 'corrupt' });
  });

  it('refuses to build without a profile', () => {
    expect(() => buildSaveFile({ ...demoState(), profile: null }, NOON)).toThrow();
  });
});

describe('saveFileName', () => {
  it('slugs the profile name safely', () => {
    expect(saveFileName('Kia')).toBe('lalista-progress-Kia.json');
    expect(saveFileName('María José!')).toBe('lalista-progress-María-José.json');
    expect(saveFileName('  ')).toBe('lalista-progress-profile.json');
  });
});
