/**
 * Quiz card for Group Study (4 choices, hints, action icons) and Review
 * (6 choices, hints, skip only). Implements SPEC §8's interaction spec:
 * number keys, Esc = skip, proactive disambiguation hint, simultaneous
 * red/green feedback, auto-advance ~2.5s on correct OR Enter immediately.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '../../types/word';
import { buildChoices, optionFieldFor, renderExample, type QuizMode } from './wordUtils';
import { WordAudioButtons } from './WordAudioButtons';
import { ChoiceGrid } from '../exercises/ChoiceGrid';
import { ConfirmDialog } from './ConfirmDialog';

export interface QuizOutcome {
  kind: 'correct' | 'wrong' | 'skip' | 'known';
}

interface Props {
  word: Word;
  /** Distractor pool (the topic group for Group Study; all words for Review). */
  pool: Word[];
  choiceCount: number;
  /** Group Study only: show mark-difficult / mark-known icons. */
  showMarkActions: boolean;
  allowSkip: boolean;
  /** Direction/listening mode (owner improvement #6). Group Study stays en-es. */
  mode?: QuizMode;
  /** Caption under the card, e.g. stage name. */
  caption?: string;
  onDone: (outcome: QuizOutcome) => void;
  onMarkDifficult?: () => void;
}

const AUTO_ADVANCE_MS = 2500;

const PROMPT_LABEL: Record<QuizMode, string> = {
  'en-es': 'Translate to Spanish',
  'es-en': 'Translate to English',
  'listen-es': 'What do you hear?',
  'listen-en': 'What does it mean?',
};

export function QuizCard({ word, pool, choiceCount, showMarkActions, allowSkip, mode = 'en-es', caption, onDone, onMarkDifficult }: Props) {
  const [answered, setAnswered] = useState<null | boolean>(null);
  const [confirmKnown, setConfirmKnown] = useState(false);
  const [flaggedNow, setFlaggedNow] = useState(false);
  const answeredAt = useRef(0);
  const field = optionFieldFor(mode);
  const listening = mode.startsWith('listen');
  const options = useMemo(() => buildChoices(word, pool, choiceCount, field), [word, pool, choiceCount, field]);

  const finish = (kind: QuizOutcome['kind']) => onDone({ kind });

  useEffect(() => {
    if (answered === null) return;
    if (answered) {
      const t = setTimeout(() => finish('correct'), AUTO_ADVANCE_MS);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allowSkip && answered === null && !confirmKnown) {
        e.preventDefault();
        finish('skip');
      }
      if (e.key === 'Enter' && answered !== null && Date.now() - answeredAt.current > 250) {
        e.preventDefault();
        finish(answered ? 'correct' : 'wrong');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, allowSkip, confirmKnown]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg bg-surface-raised px-6 py-8 shadow-lg sm:px-9">
        <span className="font-display pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 text-[15rem] leading-none font-light text-vocab opacity-5 select-none" aria-hidden="true">¿</span>

        <p className="relative m-0 mb-2 text-center text-xs font-bold tracking-widest text-ink-faint uppercase">{PROMPT_LABEL[mode]}</p>
        {mode === 'en-es' && <p className="display-friendly relative m-0 text-center text-3xl font-bold text-ink">{word.english}</p>}
        {mode === 'es-en' && (
          <div className="relative text-center">
            <p className="display-friendly m-0 text-3xl font-bold text-ink">{word.spanish}</p>
            {word.phonetics && <p className="m-0 mt-1 text-sm text-ink-faint">{word.phonetics}</p>}
            <div className="mt-2 flex justify-center">
              <WordAudioButtons word={word} />
            </div>
          </div>
        )}
        {listening && (
          <div className="relative mt-2 flex justify-center">
            {/* Auto-plays the default voice; the chips replay or switch voices. */}
            <WordAudioButtons word={word} autoPlayFirst />
          </div>
        )}

        {word.disambiguationNote && answered === null && mode === 'en-es' && (
          <div className="relative mx-auto mt-4 flex max-w-[440px] gap-2 rounded-md border border-gold bg-gold-bg px-4 py-3 text-left text-sm text-ink-soft">
            <span aria-hidden="true">💡</span>
            <span>
              <b className="text-gold">Heads up:</b> {word.disambiguationNote}
            </span>
          </div>
        )}

        <div className="relative mt-6">
          <ChoiceGrid
            options={options}
            correct={word[field]}
            accent="vocab"
            onGraded={(ok) => {
              answeredAt.current = Date.now();
              setAnswered(ok);
            }}
          />
        </div>

        {answered !== null && (
          <div className="relative mt-5 rounded-md bg-surface-sunken px-4 py-3 text-center">
            <p className="m-0 flex items-center justify-center gap-3 text-[0.95rem] font-semibold text-ink">
              {word.spanish}
              <span className="font-normal text-ink-faint">— {word.english}</span>
              {word.phonetics && <span className="font-normal text-ink-faint">{word.phonetics}</span>}
              {/* Auto-pronounce on a CORRECT answer (owner refinement #2); listening modes already played it. */}
              <WordAudioButtons word={word} autoPlayFirst={answered === true && !listening} />
            </p>
            {word.disambiguationNote && mode !== 'en-es' && (
              <p className="m-0 mt-2 text-xs text-ink-soft">💡 {word.disambiguationNote}</p>
            )}
            <p className="m-0 mt-2 text-sm text-ink-soft">{renderExample(word.example)}</p>
            {answered && <p className="m-0 mt-2 text-xs text-ink-faint">advancing… or press ↵</p>}
            {!answered && (
              <button
                type="button"
                onClick={() => finish('wrong')}
                className="mt-3 cursor-pointer rounded-pill bg-vocab px-6 py-2 text-sm font-bold text-white hover:bg-vocab-hover"
              >
                Continue <span className="ml-1 rounded-[4px] bg-white/20 px-1 py-0.5 text-[0.65rem]">↵</span>
              </button>
            )}
          </div>
        )}

        {answered === null && (allowSkip || showMarkActions) && (
          <div className="relative mt-5 flex justify-center gap-3">
            {allowSkip && (
              <button
                type="button"
                title="I don't know (Esc)"
                aria-label="Skip — I don't know"
                onClick={() => finish('skip')}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-[1.5px] border-border text-ink-faint hover:border-ink-faint hover:text-ink"
              >
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 4v16m14-16-9 8 9 8V4z" transform="scale(-1,1) translate(-24,0)"></path>
                </svg>
              </button>
            )}
            {showMarkActions && (
              <>
                <button
                  type="button"
                  title={flaggedNow ? 'Marked as difficult' : 'Mark as difficult'}
                  aria-label="Mark as difficult"
                  disabled={flaggedNow}
                  onClick={() => {
                    onMarkDifficult?.();
                    setFlaggedNow(true);
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-pill border-[1.5px] ${flaggedNow ? 'border-error text-error' : 'cursor-pointer border-border text-ink-faint hover:border-error hover:text-error'}`}
                >
                  <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill={flaggedNow ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 21V4m0 11h13l-2.5-4.5L17 6H4"></path>
                  </svg>
                </button>
                <button
                  type="button"
                  title="Mark as known"
                  aria-label="Mark as known — jump straight to Mastered"
                  onClick={() => setConfirmKnown(true)}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-[1.5px] border-border text-ink-faint hover:border-success hover:text-success"
                >
                  <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m2 13 4 4L14 9m4-2-8.5 8.5"></path>
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

        {confirmKnown && (
          <ConfirmDialog
            title={`Mark “${word.spanish}” as known?`}
            body="This jumps the word straight to Mastered — it will leave your study rotation here and appear in Review and Test instead. You can always demote it later by answering it wrong in Group Study."
            confirmLabel="Yes, I know it"
            onConfirm={() => finish('known')}
            onCancel={() => setConfirmKnown(false)}
          />
        )}
      </div>
      {caption && <p className="mt-4 text-center text-[0.8rem] text-ink-faint">{caption}</p>}
    </div>
  );
}
