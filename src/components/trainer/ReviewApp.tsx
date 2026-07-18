/**
 * Review island (SPEC §8): low-stakes reinforcement over MASTERED words only.
 * 6 choices, untimed, forgiving. Never touches stage — refreshes
 * lastReinforced (brightness) regardless of right/wrong.
 */
import { useEffect, useMemo, useState } from 'react';
import { shuffle } from '../../lib/shuffle';
import { getAllWordProgress, refreshReinforced } from '../../lib/storage/session';
import type { Word } from '../../types/word';
import words from '../../content/vocabulary/words.json';
import { QuizCard } from './QuizCard';
import SaveNudge from '../profile/SaveNudge';

const ALL_WORDS = words as unknown as Word[];

export default function ReviewApp({ vocabularyUrl }: { vocabularyUrl: string }) {
  const [pool, setPool] = useState<Word[] | null>(null);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    const progress = getAllWordProgress();
    const mastered = ALL_WORDS.filter((w) => progress[w.id]?.stage === 6);
    setPool(shuffle(mastered));
  }, []);

  const groupPools = useMemo(() => {
    const map = new Map<string, Word[]>();
    for (const w of ALL_WORDS) {
      if (!map.has(w.group)) map.set(w.group, []);
      map.get(w.group)!.push(w);
    }
    return map;
  }, []);

  if (!pool) return null;

  if (pool.length === 0) {
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

  if (index >= pool.length) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-md">
        <p className="m-0 text-4xl" aria-hidden="true">✨</p>
        <h2 className="mt-3 mb-1 text-xl font-bold text-ink">All bright again</h2>
        <p className="m-0 text-sm text-ink-soft">
          {correctCount} of {pool.length} correct — every Mastered word is refreshed. Stages untouched, as always.
        </p>
        <SaveNudge />
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setPool(shuffle(pool));
              setIndex(0);
              setCorrectCount(0);
            }}
            className="cursor-pointer rounded-pill border-2 border-border px-5 py-2.5 text-sm font-bold text-ink hover:border-vocab"
          >
            ↻ Once more
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
        {index + 1} of {pool.length}
      </p>
      <QuizCard
        key={word.id}
        word={word}
        pool={groupPools.get(word.group) ?? ALL_WORDS}
        choiceCount={6}
        showMarkActions={false}
        allowSkip
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
