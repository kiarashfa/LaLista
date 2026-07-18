/**
 * Test island (SPEC §8): high-pressure recall over MASTERED words only.
 * 3 choices, hints OFF, no skip/mark controls. Two user-selectable timer
 * styles (7 s/question or 90 s total pool — owner-confirmed values), both
 * with immediate cutoff. 5 lives; 5 correct in a row restores one (cap 5).
 * Never touches stage; refreshes lastReinforced. Scored independently as a
 * motivational layer (all-time + today's best, SPEC §9).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shuffle } from '../../lib/shuffle';
import { getAllWordProgress, loadSession, recordTestScore, refreshReinforced } from '../../lib/storage/session';
import type { TestScores } from '../../types/progress';
import type { Word } from '../../types/word';
import words from '../../content/vocabulary/words.json';
import { buildChoices } from './wordUtils';
import { ChoiceGrid } from '../exercises/ChoiceGrid';
import SaveNudge from '../profile/SaveNudge';

const ALL_WORDS = words as unknown as Word[];

const PER_QUESTION_MS = 7_000;
const TOTAL_POOL_MS = 90_000;
const MAX_LIVES = 5;
const REDEMPTION_STREAK = 5;
const FLASH_MS = 350;
const TICK_MS = 100;

type TimerStyle = 'perQuestion' | 'totalPool';
type Phase = 'loading' | 'empty' | 'setup' | 'running' | 'done';

interface EndState {
  score: number;
  reason: 'time' | 'lives';
  newAllTime: boolean;
  newToday: boolean;
}

export default function TestApp({ vocabularyUrl }: { vocabularyUrl: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [style, setStyle] = useState<TimerStyle>('perQuestion');
  const [pool, setPool] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [flash, setFlash] = useState(false);
  const [end, setEnd] = useState<EndState | null>(null);
  const [bests, setBests] = useState<TestScores>({ allTime: null, today: null });

  const scoreRef = useRef(0);
  const answeredRef = useRef(false);
  const endedRef = useRef(false);

  const groupPools = useMemo(() => {
    const map = new Map<string, Word[]>();
    for (const w of ALL_WORDS) {
      if (!map.has(w.group)) map.set(w.group, []);
      map.get(w.group)!.push(w);
    }
    return map;
  }, []);

  useEffect(() => {
    const progress = getAllWordProgress();
    const mastered = ALL_WORDS.filter((w) => progress[w.id]?.stage === 6);
    setPool(mastered);
    setBests(loadSession().testScores);
    setPhase(mastered.length < 3 ? 'empty' : 'setup');
  }, []);

  const finish = useCallback((reason: 'time' | 'lives') => {
    if (endedRef.current) return;
    endedRef.current = true;
    const s = scoreRef.current;
    const { newAllTime, newToday } = recordTestScore(s);
    setBests(loadSession().testScores);
    setEnd({ score: s, reason, newAllTime, newToday });
    setPhase('done');
  }, []);

  const start = (chosen: TimerStyle) => {
    setStyle(chosen);
    setPool((p) => shuffle(p));
    setIndex(0);
    setScore(0);
    scoreRef.current = 0;
    setLives(MAX_LIVES);
    setStreak(0);
    setFlash(false);
    setEnd(null);
    answeredRef.current = false;
    endedRef.current = false;
    setTimeLeft(chosen === 'perQuestion' ? PER_QUESTION_MS : TOTAL_POOL_MS);
    setPhase('running');
  };

  const advance = useCallback(() => {
    answeredRef.current = false;
    setFlash(false);
    setIndex((i) => i + 1);
    if (style === 'perQuestion') setTimeLeft(PER_QUESTION_MS);
  }, [style]);

  /** A question resolved as wrong (bad pick or per-question timeout). */
  const loseLife = useCallback(() => {
    setStreak(0);
    setLives((l) => {
      if (l - 1 <= 0) {
        finish('lives');
        return 0;
      }
      return l - 1;
    });
  }, [finish]);

  // The clock. Immediate cutoff, no grace period (SPEC §8).
  useEffect(() => {
    if (phase !== 'running') return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - TICK_MS;
        if (next > 0) return next;
        if (style === 'totalPool') {
          finish('time'); // mid-answer or not — session over
          return 0;
        }
        // Per-question: the QUESTION ends instantly; timeout = wrong.
        if (!answeredRef.current) {
          answeredRef.current = true;
          const word = pool[index % pool.length];
          if (word) refreshReinforced(word.id);
          loseLife();
          if (!endedRef.current) setTimeout(advance, 0);
        }
        return PER_QUESTION_MS;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [phase, style, index, pool, finish, loseLife, advance]);

  if (phase === 'loading') return null;

  if (phase === 'empty') {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-md">
        <p className="m-0 text-4xl" aria-hidden="true">⏱️</p>
        <h2 className="mt-3 mb-2 text-xl font-bold text-ink">Test needs Mastered words</h2>
        <p className="mx-auto mb-6 max-w-[420px] text-sm leading-relaxed text-ink-soft">
          Test mode draws only from words you've <b>Mastered</b> (at least 3). Master some words in Group Study first —
          then come race the clock.
        </p>
        <a href={vocabularyUrl} className="rounded-pill bg-vocab px-6 py-3 text-sm font-bold text-white no-underline hover:bg-vocab-hover">
          Go to Group Study →
        </a>
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-8 py-8 shadow-md">
        <h2 className="m-0 text-center text-xl font-bold text-ink">Choose your clock</h2>
        <p className="m-0 mt-1 text-center text-sm text-ink-soft">
          {pool.length} Mastered words in the pool · 5 lives · 5 in a row wins one back
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => start('perQuestion')}
            className="cursor-pointer rounded-md border-2 border-border bg-surface-raised p-5 text-left hover:border-vocab hover:bg-vocab-soft"
          >
            <p className="m-0 font-bold text-ink">Per-question</p>
            <p className="m-0 mt-1 text-sm text-ink-soft">7 seconds per word, fresh every question. Slow answers cost a life.</p>
          </button>
          <button
            type="button"
            onClick={() => start('totalPool')}
            className="cursor-pointer rounded-md border-2 border-border bg-surface-raised p-5 text-left hover:border-vocab hover:bg-vocab-soft"
          >
            <p className="m-0 font-bold text-ink">Total pool</p>
            <p className="m-0 mt-1 text-sm text-ink-soft">90 seconds for the whole run. Fast answers bank time for harder ones.</p>
          </button>
        </div>
        <p className="m-0 mt-5 text-center text-xs text-ink-faint">
          Wrong answers can't demote a word here — Test never touches your learning progress.
        </p>
        {(bests.allTime || bests.today) && (
          <p className="m-0 mt-2 text-center text-sm font-semibold text-ink-soft">
            {bests.allTime && (
              <span>
                All-time best: <b className="text-gold">{bests.allTime.score}</b>
              </span>
            )}
            {bests.today && bests.today.date === new Date().toISOString().slice(0, 10) && (
              <span className="ml-3">
                Today: <b className="text-vocab">{bests.today.score}</b>
              </span>
            )}
          </p>
        )}
      </div>
    );
  }

  if (phase === 'done' && end) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-md">
        <p className="display-friendly m-0 text-6xl font-semibold text-vocab">{end.score}</p>
        <p className="mt-1 text-sm font-bold tracking-wide text-ink-soft uppercase">
          {end.reason === 'time' ? "Time's up" : 'Out of lives'}
        </p>
        <p className="m-0 mt-2 text-sm text-ink-soft">
          {end.newAllTime ? (
            <span className="rounded-pill bg-gold-bg px-3 py-1 text-xs font-bold text-gold">★ New all-time best!</span>
          ) : end.newToday ? (
            <span className="rounded-pill bg-vocab-soft px-3 py-1 text-xs font-bold text-vocab">Best today!</span>
          ) : (
            bests.allTime && <span className="text-ink-faint">All-time best: {bests.allTime.score}</span>
          )}
        </p>
        <SaveNudge />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => start(style)}
            className="cursor-pointer rounded-pill bg-vocab px-6 py-2.5 text-sm font-bold text-white hover:bg-vocab-hover"
          >
            ↻ Run it again
          </button>
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="cursor-pointer rounded-pill border-2 border-border px-5 py-2.5 text-sm font-bold text-ink hover:border-vocab"
          >
            Change clock
          </button>
          <a href={vocabularyUrl} className="rounded-pill border-2 border-border px-5 py-2.5 text-sm font-bold text-ink no-underline hover:border-vocab">
            Done
          </a>
        </div>
      </div>
    );
  }

  // --- running ---
  const word = pool[index % pool.length];
  const totalMs = style === 'perQuestion' ? PER_QUESTION_MS : TOTAL_POOL_MS;
  const timerPct = Math.max(0, (timeLeft / totalMs) * 100);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="m-0 text-lg font-bold text-ink tabular-nums">{score}</p>
        <div className="flex gap-1" aria-label={`${lives} lives`}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <svg key={i} className={`h-5 w-5 ${i < lives ? 'text-error' : 'text-border'}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21C5 14.5 2 11 2 7.7 2 5 4.2 3 6.8 3c1.9 0 3.7 1 4.6 2.6L12 6.3l.6-.7C13.5 4 15.3 3 17.2 3 19.8 3 22 5 22 7.7c0 3.3-3 6.8-10 13.3z"></path>
            </svg>
          ))}
        </div>
        <div className="flex gap-1" aria-label={`streak ${streak} of ${REDEMPTION_STREAK}`} title="5 in a row restores a life">
          {Array.from({ length: REDEMPTION_STREAK }, (_, i) => (
            <span key={i} className={`h-2 w-2 rounded-pill ${i < streak ? 'bg-success' : 'bg-border'}`} />
          ))}
        </div>
      </div>

      <div className={`mb-5 h-2 overflow-hidden rounded-pill bg-surface-sunken ${style === 'perQuestion' ? '' : ''}`}>
        <div
          className={`h-full rounded-pill ${timerPct < 25 ? 'bg-error' : 'bg-vocab'}`}
          style={{ width: `${timerPct}%`, transition: `width ${TICK_MS}ms linear` }}
        />
      </div>

      <div className="rounded-lg bg-surface-raised px-6 py-7 shadow-lg sm:px-9">
        <p className="m-0 mb-2 text-center text-xs font-bold tracking-widest text-ink-faint uppercase">Translate to Spanish</p>
        <p className="display-friendly m-0 mb-6 text-center text-3xl font-bold text-ink">{word.english}</p>
        <ChoiceGrid
          key={`${word.id}-${index}`}
          options={buildChoices(word, groupPools.get(word.group) ?? ALL_WORDS, 3)}
          correct={word.spanish}
          accent="vocab"
          columns={1}
          onGraded={(ok) => {
            if (answeredRef.current || endedRef.current) return;
            answeredRef.current = true;
            setFlash(true);
            refreshReinforced(word.id);
            if (ok) {
              scoreRef.current += 1;
              setScore(scoreRef.current);
              setStreak((s) => {
                if (s + 1 >= REDEMPTION_STREAK) {
                  setLives((l) => Math.min(l + 1, MAX_LIVES));
                  return 0;
                }
                return s + 1;
              });
            } else {
              loseLife();
            }
            setTimeout(() => {
              if (!endedRef.current) advance();
            }, FLASH_MS);
          }}
        />
      </div>
      <p className="mt-3 text-center text-xs text-ink-faint">No hints, no skips — pure recall. Stages are never touched.</p>
    </div>
  );
}
