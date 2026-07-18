/** Build-the-sentence: tap words from the bank into the answer line, tap to remove. */
import { useMemo, useState } from 'react';
import { gradeSentenceReorder } from '../../lib/grading/graders';
import { shuffleAvoiding } from '../../lib/shuffle';
import type { SentenceReorderExercise as Ex } from '../../types/exercises';
import { SubmitButton } from './ui';

interface Placed {
  word: string;
  /** Index into the bank — words can repeat, so identity is positional. */
  bankIndex: number;
}

export function SentenceReorder({ exercise, onGraded }: { exercise: Ex; onGraded: (correct: boolean) => void }) {
  const bank = useMemo(() => shuffleAvoiding(exercise.words, exercise.correctOrder), [exercise]);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const answered = result !== null;
  const usedBankIndices = new Set(placed.map((p) => p.bankIndex));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answered || placed.length !== bank.length) return;
    const correct = gradeSentenceReorder(exercise, placed.map((p) => p.word));
    setResult(correct);
    onGraded(correct);
  };

  return (
    <form onSubmit={submit}>
      <div
        className={[
          'mb-4 flex min-h-14 flex-wrap items-center gap-2 rounded-md border-2 border-dashed px-3 py-2.5',
          result === true ? 'border-success bg-success-bg' : result === false ? 'border-error bg-error-bg' : 'border-border bg-surface-sunken',
        ].join(' ')}
        aria-label="Your sentence"
      >
        {placed.length === 0 && <span className="text-sm text-ink-faint">Tap the words below in order…</span>}
        {placed.map((p, i) => (
          <button
            key={`${p.bankIndex}-${i}`}
            type="button"
            disabled={answered}
            onClick={() => setPlaced((cur) => cur.filter((_, j) => j !== i))}
            className={[
              'cursor-pointer rounded-sm border px-3 py-1.5 font-semibold',
              result === true ? 'border-success text-success' : result === false ? 'border-error text-error' : 'border-border bg-surface-raised text-ink hover:border-error',
            ].join(' ')}
          >
            {p.word}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Word bank">
        {bank.map((word, bankIndex) => {
          const used = usedBankIndices.has(bankIndex);
          return (
            <button
              key={bankIndex}
              type="button"
              disabled={answered || used}
              onClick={() => setPlaced((cur) => [...cur, { word, bankIndex }])}
              className={[
                'rounded-sm border-2 border-b-4 px-3 py-1.5 font-semibold transition-all',
                used
                  ? 'cursor-default border-transparent bg-surface-sunken text-transparent select-none'
                  : 'cursor-pointer border-border bg-surface-raised text-ink hover:border-grammar hover:bg-grammar-soft active:translate-y-[2px] active:border-b-2',
              ].join(' ')}
            >
              {word}
            </button>
          );
        })}
      </div>

      {result === false && (
        <p className="mt-3 text-sm text-ink-soft">
          Correct order: <b className="text-success">{exercise.correctOrder.join(' ')}</b>
        </p>
      )}
      {!answered && (
        <div className="mt-4 text-right">
          <SubmitButton disabled={placed.length !== bank.length} />
        </div>
      )}
    </form>
  );
}
