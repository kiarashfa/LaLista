/**
 * Review island (SPEC §8): low-stakes reinforcement over MASTERED words only.
 * 6 choices, untimed, forgiving. Never touches stage — refreshes
 * lastReinforced (brightness) regardless of right/wrong.
 * Owner improvement #6: the user picks a direction first — EN→ES, ES→EN, or
 * one of the two listening modes.
 */
import { useEffect, useMemo, useState } from 'react';
import { shuffle } from '../../lib/shuffle';
import { getAllWordProgress, getProfile, refreshReinforced } from '../../lib/storage/session';
import type { Word } from '../../types/word';
import words from '../../content/vocabulary/words.json';
import { MODE_INFO, type QuizMode } from './wordUtils';
import { QuizCard } from './QuizCard';
import SaveNudge from '../profile/SaveNudge';

const ALL_WORDS = words as unknown as Word[];
const MODE_KEY = 'lalista:reviewMode';
const MODES: QuizMode[] = ['en-es', 'es-en', 'listen-es', 'listen-en'];

type Phase = 'loading' | 'empty' | 'setup' | 'running' | 'done';

export default function ReviewApp({ vocabularyUrl }: { vocabularyUrl: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [pool, setPool] = useState<Word[]>([]);
  const [mode, setMode] = useState<QuizMode>('en-es');
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    if (!getProfile()) return; // ProfileGate overlay is up
    const progress = getAllWordProgress();
    const mastered = ALL_WORDS.filter((w) => progress[w.id]?.stage === 6);
    setPool(shuffle(mastered));
    const stored = localStorage.getItem(MODE_KEY) as QuizMode | null;
    if (stored && MODES.includes(stored)) setMode(stored);
    setPhase(mastered.length === 0 ? 'empty' : 'setup');
  }, []);

  const groupPools = useMemo(() => {
    const map = new Map<string, Word[]>();
    for (const w of ALL_WORDS) {
      if (!map.has(w.group)) map.set(w.group, []);
      map.get(w.group)!.push(w);
    }
    return map;
  }, []);

  const start = (chosen: QuizMode) => {
    setMode(chosen);
    localStorage.setItem(MODE_KEY, chosen);
    setPool((p) => shuffle(p));
    setIndex(0);
    setCorrectCount(0);
    setPhase('running');
  };

  if (phase === 'loading') return null;

  if (phase === 'empty') {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-md">
        <p className="m-0 text-4xl" aria-hidden="true">🌱</p>
        <h2 className="mt-3 mb-2 text-xl font-bold text-ink">Nothing to review yet</h2>
        <p className="mx-auto mb-6 max-w-[420px] text-sm leading-relaxed text-ink-soft">
          Review keeps <b>Mastered</b> words bright — and you don't have any yet. Master some words in Group Study
          first; they'll show up here.
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
        <h2 className="m-0 text-center text-xl font-bold text-ink">Which direction today?</h2>
        <p className="m-0 mt-1 text-center text-sm text-ink-soft">{pool.length} Mastered words · stages never change here</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => start(m)}
              className={`cursor-pointer rounded-md border-2 p-4 text-left hover:border-vocab hover:bg-vocab-soft ${m === mode ? 'border-vocab' : 'border-border'}`}
            >
              <p className="m-0 font-bold text-ink">{MODE_INFO[m].title}</p>
              <p className="m-0 mt-1 text-sm text-ink-soft">{MODE_INFO[m].desc}</p>
            </button>
          ))}
        </div>
        <p className="m-0 mt-4 text-center text-xs text-ink-faint">Your last choice is outlined — click any card to start.</p>
      </div>
    );
  }

  if (phase === 'done' || index >= pool.length) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-md">
        <p className="m-0 text-4xl" aria-hidden="true">✨</p>
        <h2 className="mt-3 mb-1 text-xl font-bold text-ink">All bright again</h2>
        <p className="m-0 text-sm text-ink-soft">
          {correctCount} of {pool.length} correct in {MODE_INFO[mode].title} — every Mastered word is refreshed. Stages
          untouched, as always.
        </p>
        <SaveNudge />
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => start(mode)}
            className="cursor-pointer rounded-pill border-2 border-border px-5 py-2.5 text-sm font-bold text-ink hover:border-vocab"
          >
            ↻ Once more
          </button>
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="cursor-pointer rounded-pill border-2 border-border px-5 py-2.5 text-sm font-bold text-ink hover:border-vocab"
          >
            Change direction
          </button>
          <a href={vocabularyUrl} className="rounded-pill bg-vocab px-5 py-2.5 text-sm font-bold text-white no-underline hover:bg-vocab-hover">
            Done
          </a>
        </div>
      </div>
    );
  }

  const word = pool[index];
  return (
    <div>
      <p className="mb-4 text-center text-sm font-semibold text-ink-soft">
        {index + 1} of {pool.length} · {MODE_INFO[mode].title}
      </p>
      <QuizCard
        key={`${word.id}-${mode}`}
        word={word}
        pool={groupPools.get(word.group) ?? ALL_WORDS}
        choiceCount={6}
        showMarkActions={false}
        allowSkip
        mode={mode}
        caption="Review never changes a word's stage — it just keeps it bright."
        onDone={(outcome) => {
          refreshReinforced(word.id);
          if (outcome.kind === 'correct') setCorrectCount((c) => c + 1);
          setIndex((i) => i + 1);
        }}
      />
    </div>
  );
}
