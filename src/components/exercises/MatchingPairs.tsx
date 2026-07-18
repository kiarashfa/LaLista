/**
 * Match left↔right: select a left item, then a right item. Correct matches
 * lock in green; a wrong attempt flashes red and counts as a mistake.
 * The exercise scores correct only with zero mistakes.
 */
import { useMemo, useRef, useState } from 'react';
import { isMatchingPair } from '../../lib/grading/graders';
import { shuffle } from '../../lib/shuffle';
import type { MatchingPairsExercise as Ex } from '../../types/exercises';

export function MatchingPairs({ exercise, onGraded }: { exercise: Ex; onGraded: (correct: boolean) => void }) {
  const rights = useMemo(() => shuffle(exercise.pairs.map((p) => p.right)), [exercise]);
  const lefts = exercise.pairs.map((p) => p.left);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Map<string, string>>(new Map());
  const [flash, setFlash] = useState<{ left: string; right: string } | null>(null);
  const mistakes = useRef(0);
  const done = matched.size === exercise.pairs.length;

  const tryMatch = (right: string) => {
    if (!selectedLeft || done) return;
    if (isMatchingPair(exercise, selectedLeft, right)) {
      const next = new Map(matched);
      next.set(selectedLeft, right);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === exercise.pairs.length) onGraded(mistakes.current === 0);
    } else {
      mistakes.current += 1;
      setFlash({ left: selectedLeft, right });
      setTimeout(() => setFlash(null), 450);
    }
  };

  const cellBase = 'w-full cursor-pointer rounded-md border-2 px-3 py-2.5 text-left font-semibold transition-colors';

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <div className="flex flex-col gap-2">
        {lefts.map((left) => {
          const isMatched = matched.has(left);
          const isSelected = selectedLeft === left;
          const isFlash = flash?.left === left;
          return (
            <button
              key={left}
              type="button"
              disabled={isMatched || done}
              onClick={() => setSelectedLeft(isSelected ? null : left)}
              className={[
                cellBase,
                isMatched
                  ? 'cursor-default border-success bg-success-bg text-success opacity-70'
                  : isFlash
                    ? 'border-error bg-error-bg text-error'
                    : isSelected
                      ? 'border-grammar bg-grammar-soft text-grammar'
                      : 'border-border bg-surface-raised text-ink hover:border-grammar',
              ].join(' ')}
            >
              {left}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        {rights.map((right) => {
          const isMatched = [...matched.values()].includes(right);
          const isFlash = flash?.right === right;
          return (
            <button
              key={right}
              type="button"
              disabled={isMatched || done || !selectedLeft}
              onClick={() => tryMatch(right)}
              className={[
                cellBase,
                isMatched
                  ? 'cursor-default border-success bg-success-bg text-success opacity-70'
                  : isFlash
                    ? 'border-error bg-error-bg text-error'
                    : selectedLeft
                      ? 'border-border bg-surface-raised text-ink hover:border-grammar'
                      : 'border-border bg-surface-raised text-ink-faint',
              ].join(' ')}
            >
              {right}
            </button>
          );
        })}
      </div>
      {done && mistakes.current > 0 && (
        <p className="col-span-2 mt-1 text-sm text-ink-soft">
          All matched — with <b className="text-error">{mistakes.current}</b> {mistakes.current === 1 ? 'mismatch' : 'mismatches'} along the way.
        </p>
      )}
    </div>
  );
}
