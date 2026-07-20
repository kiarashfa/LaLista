/** Paragraph with inline {0}…{n} blanks; all must be correct to count. */
import { useMemo, useState } from 'react';
import { gradeClozePassage, type ClozeResult } from '../../lib/grading/graders';
import type { ClozePassageExercise as Ex } from '../../types/exercises';
import { CharPalette, SubmitButton } from './ui';

export function ClozePassage({ exercise, onGraded }: { exercise: Ex; onGraded: (correct: boolean) => void }) {
  const [answers, setAnswers] = useState<string[]>(() => exercise.blanks.map(() => ''));
  const [result, setResult] = useState<ClozeResult | null>(null);
  const answered = result !== null;
  const allFilled = answers.every((a) => a.trim());

  /** Split passage into text segments and blank slots. */
  const segments = useMemo(() => exercise.passage.split(/\{(\d+)\}/g), [exercise]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answered || !allFilled) return;
    const graded = gradeClozePassage(exercise, answers);
    setResult(graded);
    onGraded(graded.correct);
  };

  return (
    <form onSubmit={submit}>
      <p className="rounded-md bg-surface-sunken px-5 py-4 text-[1.05rem] leading-[2.4] text-ink">
        {segments.map((seg, i) => {
          if (i % 2 === 0) return <span key={i}>{seg}</span>;
          const idx = Number(seg);
          const ok = result?.blanks[idx];
          return (
            <span key={i} className="inline-flex flex-col items-center align-middle">
              <input
                value={answers[idx] ?? ''}
                onChange={(e) => setAnswers((a) => a.map((v, j) => (j === idx ? e.target.value : v)))}
                disabled={answered}
                size={Math.max(6, exercise.blanks[idx].length + 2)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`Blank ${idx + 1}`}
                className={[
                  'mx-1 rounded-sm border-b-2 bg-surface-raised px-2 py-0.5 text-center font-semibold outline-none',
                  ok === 'correct'
                    ? 'border-success bg-success-bg text-success'
                    : ok === 'accent'
                      ? 'border-warning bg-gold-bg text-warning'
                      : ok === 'wrong'
                        ? 'border-error bg-error-bg text-error'
                        : 'border-border text-ink focus:border-grammar',
                ].join(' ')}
              />
              {ok === 'wrong' && <span className="text-xs font-semibold text-success">{exercise.blanks[idx]}</span>}
              {ok === 'accent' && <span className="text-xs font-semibold text-warning">{exercise.blanks[idx]}</span>}
            </span>
          );
        })}
      </p>
      {answered && result.accentMisses > 0 && (
        <p className="m-0 mt-3 rounded-md border border-warning bg-gold-bg px-3 py-2 text-sm text-ink-soft">
          <b className="text-warning">{result.accentMisses === 1 ? 'One blank' : `${result.accentMisses} blanks`}</b> had
          the right word but a missing tilde — counted as correct, exact spelling shown in amber.
        </p>
      )}
      <div className="mt-3 flex items-start justify-between gap-4">
        <CharPalette disabled={answered} />
        {!answered && <SubmitButton disabled={!allFilled} />}
      </div>
    </form>
  );
}
