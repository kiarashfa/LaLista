/**
 * Group Study island (SPEC §8) — the only mode that changes SRS stage.
 * Sidebar = full jumpable word list with 7-dot stage indicators; main stage
 * runs the §10 batching/interleaving session queue.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { freshness } from '../../lib/srs/scheduling';
import { SessionQueue, type QueueItem } from '../../lib/srs/sessionQueue';
import { STAGE_NAMES, type Stage } from '../../lib/srs/stages';
import {
  applyGroupStudyAnswer,
  applySkip,
  getAllWordProgress,
  markDifficult,
  markKnown,
} from '../../lib/storage/session';
import { newWordProgress, type VocabWordProgress } from '../../types/progress';
import type { Word } from '../../types/word';
import { QuizCard, type QuizOutcome } from './QuizCard';
import { StageDots } from './StageDots';
import { StudyCard } from './StudyCard';
import SaveNudge from '../profile/SaveNudge';

interface Props {
  groupTitle: string;
  words: Word[];
  vocabularyUrl: string;
}

interface SessionStats {
  studied: number;
  quizzed: number;
  correct: number;
}

export default function GroupStudyApp({ groupTitle, words, vocabularyUrl }: Props) {
  const now = Date.now();
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const [progress, setProgress] = useState<Record<string, VocabWordProgress> | null>(null);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [ended, setEnded] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ studied: 0, quizzed: 0, correct: 0 });
  const queueRef = useRef<SessionQueue | null>(null);

  useEffect(() => {
    const all = getAllWordProgress();
    const map: Record<string, VocabWordProgress> = {};
    for (const w of words) map[w.id] = all[w.id] ?? newWordProgress(now);
    const queue = new SessionQueue({
      newWords: words.filter((w) => map[w.id].stage === 0).map((w) => w.id),
      dueWords: words.filter((w) => map[w.id].stage > 0 && now >= map[w.id].dueAt).map((w) => w.id),
      difficult: new Set(words.filter((w) => map[w.id].difficult).map((w) => w.id)),
    });
    queueRef.current = queue;
    setProgress(map);
    const first = queue.next();
    setCurrent(first);
    setEnded(first === null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshWord = (id: string, p: VocabWordProgress) => setProgress((cur) => ({ ...cur!, [id]: p }));

  const advance = () => {
    const next = queueRef.current!.next();
    setCurrent(next);
    if (next === null) setEnded(true);
  };

  const handleStudyNext = (wordId: string) => {
    setStats((s) => ({ ...s, studied: s.studied + 1 }));
    advance();
  };

  const handleQuizDone = (wordId: string, outcome: QuizOutcome) => {
    if (outcome.kind === 'known') {
      refreshWord(wordId, markKnown(wordId));
      queueRef.current!.retire(wordId);
    } else if (outcome.kind === 'skip') {
      refreshWord(wordId, applySkip(wordId));
      queueRef.current!.report(wordId, 'skip');
    } else {
      const correct = outcome.kind === 'correct';
      refreshWord(wordId, applyGroupStudyAnswer(wordId, correct));
      queueRef.current!.report(wordId, correct ? 'correct' : 'wrong');
      setStats((s) => ({ ...s, quizzed: s.quizzed + 1, correct: s.correct + (correct ? 1 : 0) }));
    }
    advance();
  };

  if (!progress) return null;

  const currentWord = current ? byId.get(current.wordId) : undefined;
  const mastered = words.filter((w) => progress[w.id].stage === 6).length;
  const started = words.filter((w) => progress[w.id].stage > 0).length;

  const wordList = words.map((w) => {
    const p = progress[w.id];
    const isCurrent = current?.wordId === w.id;
    return (
      <button
        key={w.id}
        type="button"
        onClick={() => {
          queueRef.current!.jumpTo(w.id, p.stage === 0);
          setEnded(false);
          setCurrent(queueRef.current!.next());
        }}
        className={[
          'mb-[2px] flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-2 text-left',
          isCurrent ? 'bg-vocab-soft' : 'hover:bg-surface-sunken',
        ].join(' ')}
      >
        <span className={['truncate text-[0.88rem] font-medium', isCurrent ? 'font-bold text-vocab' : 'text-ink-faint'].join(' ')}>
          {w.spanish}
        </span>
        <StageDots stage={p.stage as Stage} freshness={freshness(p.lastReinforced, now)} difficult={p.difficult} accent={isCurrent} />
      </button>
    );
  });

  return (
    <div className="mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border px-5 py-6 lg:block">
        <div className="mb-4">
          <p className="m-0 mb-2 text-xs font-bold tracking-widest text-vocab uppercase">{groupTitle}</p>
          <div className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
            <div className="h-full bg-gradient-to-r from-vocab to-gold" style={{ width: `${(started / words.length) * 100}%` }} />
          </div>
          <p className="m-0 mt-1 text-xs font-semibold text-ink-faint">
            {started} / {words.length} started · {mastered} mastered
          </p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-1">{wordList}</div>
      </aside>

      <main className="flex flex-col items-center px-4 py-8 sm:px-6 sm:py-10">
        {/* Mobile: same word list, collapsible above the stage (SPEC §7 — same component, responsive layout) */}
        <details className="mb-4 w-full max-w-[600px] rounded-md border border-border bg-surface-raised lg:hidden">
          <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-vocab select-none">
            {groupTitle} · {started}/{words.length} started
          </summary>
          <div className="max-h-[45vh] overflow-y-auto border-t border-border px-2 py-2">{wordList}</div>
        </details>
        <div className="w-full max-w-[600px]">
          {ended || !current || !currentWord ? (
            <div className="rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-md">
              <p className="m-0 text-4xl" aria-hidden="true">🎉</p>
              <h2 className="mt-3 mb-1 text-xl font-bold text-ink">
                {stats.quizzed + stats.studied > 0 ? 'Session complete' : 'All caught up'}
              </h2>
              {stats.quizzed + stats.studied > 0 ? (
                <p className="m-0 text-sm text-ink-soft">
                  {stats.studied} new {stats.studied === 1 ? 'word' : 'words'} studied · {stats.correct}/{stats.quizzed} quiz answers correct
                </p>
              ) : (
                <p className="mx-auto m-0 max-w-[400px] text-sm leading-relaxed text-ink-soft">
                  Nothing in this group is due right now — the date gates are doing their job. Come back tomorrow, or
                  keep Mastered words bright in Review.
                </p>
              )}
              <SaveNudge />
              <a href={vocabularyUrl} className="mt-5 inline-block rounded-pill bg-vocab px-6 py-3 text-sm font-bold text-white no-underline hover:bg-vocab-hover">
                Back to all groups
              </a>
            </div>
          ) : current.kind === 'study' ? (
            <StudyCard key={`${current.wordId}-s`} word={currentWord} onNext={() => handleStudyNext(current.wordId)} />
          ) : (
            <QuizCard
              key={`${current.wordId}-q-${stats.quizzed}`}
              word={currentWord}
              pool={words}
              choiceCount={4}
              showMarkActions
              allowSkip
              caption={`${STAGE_NAMES[progress[current.wordId].stage as Stage]} · press Enter ↵ to continue after answering`}
              onDone={(outcome) => handleQuizDone(current.wordId, outcome)}
              onMarkDifficult={() => refreshWord(current.wordId, markDifficult(current.wordId))}
            />
          )}
        </div>
      </main>
    </div>
  );
}
