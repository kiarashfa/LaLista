/**
 * Fill-in-the-blank conjugation practice (distinct from the <BootTable>
 * teaching component). Same 2×3 pronoun layout language.
 * All blanks must be correct for the exercise to count.
 */
import { useState } from 'react';
import { gradeConjugationGrid, type GridResult } from '../../lib/grading/graders';
import { BOOT_PRONOUNS, type ConjugationGridExercise as Ex } from '../../types/exercises';
import { CharPalette, SubmitButton } from './ui';

/** Render order: left column singular, right column plural (matches BootTable). */
const GRID_ORDER = [BOOT_PRONOUNS[0], BOOT_PRONOUNS[3], BOOT_PRONOUNS[1], BOOT_PRONOUNS[4], BOOT_PRONOUNS[2], BOOT_PRONOUNS[5]];

export function ConjugationGrid({ exercise, onGraded }: { exercise: Ex; onGraded: (correct: boolean) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GridResult | null>(null);
  const answered = result !== null;
  const allFilled = exercise.blankForms.every((p) => (answers[p] ?? '').trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answered || !allFilled) return;
    const graded = gradeConjugationGrid(exercise, answers);
    setResult(graded);
    onGraded(graded.correct);
  };

  return (
    <form onSubmit={submit}>
      <p className="display-friendly mb-4 text-center text-2xl font-semibold text-ink italic">{exercise.verb}</p>
      <div className="overflow-hidden rounded-md border border-border bg-surface-raised shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {GRID_ORDER.map((pronoun, i) => {
            const given = exercise.givenForms[pronoun];
            const isBlank = exercise.blankForms.includes(pronoun);
            const cellOk = result?.cells[pronoun];
            return (
              <div
                key={pronoun}
                className={[
                  'flex items-center justify-between gap-3 px-4 py-2.5',
                  i < 4 && 'border-b border-border',
                  i % 2 === 0 && 'sm:border-r sm:border-border',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="shrink-0 text-sm font-medium text-ink-faint">{pronoun}</span>
                {isBlank ? (
                  <span className="flex min-w-0 flex-col items-end">
                    <input
                      value={answers[pronoun] ?? ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [pronoun]: e.target.value }))}
                      disabled={answered}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label={`${exercise.verb}, ${pronoun}`}
                      className={[
                        'w-32 rounded-sm border-2 px-2 py-1 text-right font-display text-[1.02rem] font-semibold outline-none',
                        cellOk === 'correct'
                          ? 'border-success bg-success-bg text-success'
                          : cellOk === 'accent'
                            ? 'border-warning bg-gold-bg text-warning'
                            : cellOk === 'wrong'
                              ? 'border-error bg-error-bg text-error'
                              : 'border-border bg-surface-base text-ink focus:border-grammar',
                      ].join(' ')}
                    />
                    {cellOk === 'wrong' && <span className="mt-0.5 text-xs font-semibold text-success">{exercise.correctAnswers[pronoun]}</span>}
                    {cellOk === 'accent' && <span className="mt-0.5 text-xs font-semibold text-warning">{exercise.correctAnswers[pronoun]}</span>}
                  </span>
                ) : (
                  <span className="font-display text-[1.02rem] font-semibold text-ink">{given}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {answered && result.accentMisses > 0 && (
        <p className="m-0 mt-3 rounded-md border border-warning bg-gold-bg px-3 py-2 text-sm text-ink-soft">
          <b className="text-warning">{result.accentMisses === 1 ? 'One form' : `${result.accentMisses} forms`}</b> had the
          right conjugation but a missing tilde — counted as correct, exact spelling shown in amber. Accents are part of
          the word.
        </p>
      )}
      <div className="mt-3 flex items-start justify-between gap-4">
        <CharPalette disabled={answered} />
        {!answered && <SubmitButton disabled={!allFilled} />}
      </div>
    </form>
  );
}
