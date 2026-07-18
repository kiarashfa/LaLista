/**
 * Workbook runner island (client:only). One exercise at a time with immediate
 * feedback; freely retakeable; best-attempt-ever persisted (SPEC §6/§9).
 * Locked until the lesson is marked read — a one-time speed bump for
 * first-timers, zero friction for returning readers (SPEC §6).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLessonProgress, recordWorkbookAttempt } from '../../lib/storage/session';
import { BAND_LABEL, scoreBand, type ScoreBand } from '../../lib/grading/thresholds';
import type { Exercise } from '../../types/exercises';
import type { WorkbookBest } from '../../types/progress';
import { ChoiceGrid } from './ChoiceGrid';
import { ClozePassage } from './ClozePassage';
import { ConjugationGrid } from './ConjugationGridExercise';
import { MatchingPairs } from './MatchingPairs';
import { GenderAgreement, MultipleChoice } from './MultipleChoice';
import { SentenceReorder } from './SentenceReorder';
import { ErrorCorrection, FillBlank, SentenceTransformation } from './TextExercises';
import SaveNudge from '../profile/SaveNudge';

interface Props {
  lessonId: string;
  lessonNumber: number;
  exercises: Exercise[];
  lessonUrl: string;
  nextUrl: string | null;
  nextTitle: string | null;
}

type Phase = 'loading' | 'locked' | 'running' | 'done';

const BAND_COLOR: Record<ScoreBand, string> = {
  none: 'text-ink-faint',
  poor: 'text-error',
  fair: 'text-warning',
  good: 'text-success',
};

/** Correct-answer reveal for the types whose inputs don't already show it inline. */
function revealFor(ex: Exercise): string | null {
  switch (ex.type) {
    case 'fill-blank':
      return ex.correctAnswer;
    case 'error-correction':
      return ex.correctSentence;
    case 'sentence-transformation':
      return ex.correctAnswer;
    default:
      return null;
  }
}

function ExerciseBody({ exercise, onGraded }: { exercise: Exercise; onGraded: (c: boolean) => void }) {
  switch (exercise.type) {
    case 'multiple-choice':
      return <MultipleChoice exercise={exercise} onGraded={onGraded} />;
    case 'gender-agreement':
      return <GenderAgreement exercise={exercise} onGraded={onGraded} />;
    case 'fill-blank':
      return <FillBlank exercise={exercise} onGraded={onGraded} />;
    case 'error-correction':
      return <ErrorCorrection exercise={exercise} onGraded={onGraded} />;
    case 'sentence-transformation':
      return <SentenceTransformation exercise={exercise} onGraded={onGraded} />;
    case 'conjugation-grid':
      return <ConjugationGrid exercise={exercise} onGraded={onGraded} />;
    case 'sentence-reorder':
      return <SentenceReorder exercise={exercise} onGraded={onGraded} />;
    case 'matching-pairs':
      return <MatchingPairs exercise={exercise} onGraded={onGraded} />;
    case 'cloze-passage':
      return <ClozePassage exercise={exercise} onGraded={onGraded} />;
  }
}

export default function WorkbookApp({ lessonId, lessonNumber, exercises, lessonUrl, nextUrl, nextTitle }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [attempt, setAttempt] = useState(1);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [graded, setGraded] = useState<boolean | null>(null);
  const [outcome, setOutcome] = useState<{ best: WorkbookBest; improved: boolean } | null>(null);
  const gradedAt = useRef(0);

  useEffect(() => {
    setPhase(getLessonProgress(lessonId).readAt ? 'running' : 'locked');
  }, [lessonId]);

  const exercise = exercises[index];
  const total = exercises.length;

  const onGraded = useCallback((correct: boolean) => {
    gradedAt.current = Date.now();
    setGraded(correct);
    setResults((r) => [...r, correct]);
  }, []);

  const next = useCallback(() => {
    if (graded === null) return;
    setGraded(null);
    if (index + 1 < total) {
      setIndex(index + 1);
    } else {
      const correct = results.filter(Boolean).length;
      setOutcome(recordWorkbookAttempt(lessonId, correct, total));
      setPhase('done');
    }
  }, [graded, index, total, results, lessonId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || phase !== 'running' || graded === null) return;
      if (Date.now() - gradedAt.current < 350) return; // same keystroke that submitted
      e.preventDefault();
      next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, graded, next]);

  if (phase === 'loading') return null;

  if (phase === 'locked') {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-md">
        <p className="m-0 text-4xl" aria-hidden="true">🔒</p>
        <h2 className="mt-3 mb-2 text-xl font-bold text-ink">Read the chapter first</h2>
        <p className="mx-auto mb-6 max-w-[420px] text-sm leading-relaxed text-ink-soft">
          The workbook unlocks once you've marked Chapter {lessonNumber} as read — a one-time step, not a test. If you've
          already read it, just hit the button at the bottom of the chapter.
        </p>
        <a href={lessonUrl} className="rounded-pill bg-grammar px-6 py-3 text-sm font-bold text-white no-underline hover:bg-grammar-hover">
          Go to the chapter →
        </a>
      </div>
    );
  }

  if (phase === 'done' && outcome) {
    const correct = results.filter(Boolean).length;
    const band = scoreBand(correct, total);
    const pct = Math.round((correct / total) * 100);
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-md">
        <p className={`display-friendly m-0 text-6xl font-semibold ${BAND_COLOR[band]}`}>{pct}%</p>
        <p className={`mt-1 text-sm font-bold tracking-wide uppercase ${BAND_COLOR[band]}`}>{BAND_LABEL[band]}</p>
        <p className="mt-3 text-ink-soft">
          {correct} of {total} correct
          {outcome.improved ? (
            <span className="ml-2 rounded-pill bg-gold-bg px-2.5 py-0.5 text-xs font-bold text-gold">New best!</span>
          ) : (
            <span className="ml-2 text-sm text-ink-faint">
              (best: {outcome.best.correct}/{outcome.best.total})
            </span>
          )}
        </p>
        <p className="mt-1 text-xs text-ink-faint">Retake any time — only your best attempt counts.</p>
        <SaveNudge />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAttempt((a) => a + 1);
              setIndex(0);
              setResults([]);
              setGraded(null);
              setOutcome(null);
              setPhase('running');
            }}
            className="cursor-pointer rounded-pill border-2 border-border bg-surface-raised px-5 py-2.5 text-sm font-bold text-ink hover:border-grammar"
          >
            ↻ Retake
          </button>
          <a href={lessonUrl} className="rounded-pill border-2 border-border px-5 py-2.5 text-sm font-bold text-ink no-underline hover:border-grammar">
            Back to the chapter
          </a>
          {nextUrl && (
            <a href={nextUrl} className="rounded-pill bg-grammar px-5 py-2.5 text-sm font-bold text-white no-underline hover:bg-grammar-hover">
              Next: {nextTitle} →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-semibold text-ink-soft">
            Exercise {index + 1} of {total}
          </span>
          <span className="text-xs text-ink-faint">{results.filter(Boolean).length} correct so far</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
          <div
            className="h-full rounded-pill bg-gradient-to-r from-grammar to-gold transition-all duration-300"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-raised px-6 py-7 shadow-md sm:px-8">
        <p className="mt-0 mb-5 text-lg font-semibold text-ink">{exercise.prompt}</p>
        <ExerciseBody key={`${exercise.id}-${attempt}`} exercise={exercise} onGraded={onGraded} />

        {graded !== null && (
          <div
            className={`mt-6 rounded-md px-4 py-3 text-sm ${graded ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}
            role="status"
          >
            <p className="m-0 font-bold">{graded ? '¡Correcto!' : 'Not quite.'}</p>
            {!graded && revealFor(exercise) && (
              <p className="m-0 mt-1">
                Correct answer: <b>{revealFor(exercise)}</b>
              </p>
            )}
            {exercise.note && <p className="m-0 mt-2 border-t border-current/20 pt-2 text-ink-soft">{exercise.note}</p>}
          </div>
        )}

        {graded !== null && (
          <div className="mt-5 text-right">
            <button
              type="button"
              onClick={next}
              className="cursor-pointer rounded-pill bg-grammar px-6 py-2.5 text-sm font-bold text-white hover:bg-grammar-hover"
            >
              {index + 1 < total ? 'Next →' : 'Finish'}
              <span className="ml-2 rounded-[4px] bg-white/20 px-1.5 py-0.5 text-[0.68rem]">↵</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
