/**
 * Answer-choice list shared by every multiple-choice surface (grammar
 * workbook, Group Study, Review, Test). Owner-picked design (refinement #5,
 * proposal B): flat full-width rows on the sunken surface with a left accent
 * bar that slides in on hover; the keyboard number sits quietly at the right
 * edge. Keeps SPEC §8's rules: number-key selection, and on a wrong pick the
 * mistake highlights red *simultaneously* with the correct answer going green.
 */
import { useEffect, useState } from 'react';

interface Props {
  options: string[];
  correct: string;
  onGraded: (correct: boolean, selected: string) => void;
  /** Section accent for hover states — plum (grammar) or coral (vocabulary). */
  accent?: 'grammar' | 'vocab';
}

export function ChoiceGrid({ options, correct, onGraded, accent = 'grammar' }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const hoverClass =
    accent === 'vocab'
      ? 'hover:border-l-vocab hover:bg-vocab-soft hover:pl-6'
      : 'hover:border-l-grammar hover:bg-grammar-soft hover:pl-6';

  const pick = (option: string) => {
    if (answered) return;
    setSelected(option);
    onGraded(option === correct, option);
  };

  useEffect(() => {
    if (answered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const n = /^[1-9]$/.test(e.key) ? Number(e.key) : NaN;
      if (!Number.isNaN(n) && n <= options.length) {
        e.preventDefault();
        pick(options[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col gap-2">
      {options.map((option, i) => {
        const isCorrect = answered && option === correct;
        const isWrongPick = answered && selected === option && option !== correct;
        return (
          <button
            key={option}
            type="button"
            onClick={() => pick(option)}
            disabled={answered}
            className={[
              'flex items-center justify-between gap-3 rounded-sm border-l-[3px] px-4 py-3 text-left font-body text-[1.02rem] font-semibold transition-all duration-150',
              isCorrect
                ? 'border-l-success bg-success-bg text-success'
                : isWrongPick
                  ? 'border-l-error bg-error-bg text-error'
                  : answered
                    ? 'border-l-transparent bg-surface-sunken text-ink opacity-50'
                    : `cursor-pointer border-l-transparent bg-surface-sunken text-ink ${hoverClass}`,
            ].join(' ')}
          >
            <span className="min-w-0">{option}</span>
            <span
              className={[
                'shrink-0 text-[0.72rem] font-bold',
                isCorrect ? 'text-success' : isWrongPick ? 'text-error' : 'text-ink-faint',
              ].join(' ')}
              aria-hidden="true"
            >
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
