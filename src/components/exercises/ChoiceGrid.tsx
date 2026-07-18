/**
 * Answer-choice grid shared by multiple-choice and gender-agreement (and the
 * pattern Round 4's trainer reuses). Implements SPEC §8's rules: number-key
 * selection with visible kbd badges; on a wrong pick, the mistake highlights
 * red *simultaneously* with the correct answer highlighting green.
 * Tactile bottom border strengthened per §7 punch list.
 */
import { useEffect, useState } from 'react';
import { KbdBadge } from './ui';

interface Props {
  options: string[];
  correct: string;
  onGraded: (correct: boolean, selected: string) => void;
  /** Grid columns on desktop; stacks on mobile regardless. */
  columns?: 1 | 2;
  /** Section accent for hover states — plum (grammar) or coral (vocabulary). */
  accent?: 'grammar' | 'vocab';
}

export function ChoiceGrid({ options, correct, onGraded, columns = 2, accent = 'grammar' }: Props) {
  const hoverClass = accent === 'vocab' ? 'hover:border-vocab hover:bg-vocab-soft' : 'hover:border-grammar hover:bg-grammar-soft';
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;

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
    <div className={`grid gap-3 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
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
              'flex cursor-pointer items-center gap-3 rounded-md border-2 border-b-4 px-4 py-3 text-left font-body text-[1.02rem] font-bold transition-all duration-100',
              isCorrect
                ? 'border-success bg-success-bg text-success'
                : isWrongPick
                  ? 'border-error bg-error-bg text-error'
                  : answered
                    ? 'border-border bg-surface-raised text-ink opacity-60'
                    : `border-border bg-surface-raised text-ink ${hoverClass} active:border-b-2 active:translate-y-[2px]`,
            ].join(' ')}
          >
            <KbdBadge>{i + 1}</KbdBadge>
            {option}
          </button>
        );
      })}
    </div>
  );
}
