/**
 * Group Study island — the only mode that changes SRS stage.
 * Sidebar = full jumpable word list with 7-dot stage indicators; main stage
 * runs the batching/interleaving session queue.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { freshness } from '../../lib/srs/scheduling';
import { SessionQueue, type QueueItem } from '../../lib/srs/sessionQueue';
import { STAGE_NAMES, type Stage } from '../../lib/srs/stages';
import {
  applyGroupStudyAnswer,
  applySkip,
  getAllWordProgress,
  getProfile,
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
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof localStorage === 'undefined' || localStorage.getItem('lalista:vocabSidebar') !== 'closed',
  );
  const queueRef = useRef<SessionQueue | null>(null);
  const studiedIds = useRef(new Set<string>());

  const toggleSidebar = (open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem('lalista:vocabSidebar', open ? 'open' : 'closed');
  };

  useEffect(() => {
    if (!getProfile()) return; // ProfileGate overlay is up — don't start a session
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
    // Only first exposures count toward the session stat (skip-revisits don't).
    if (!studiedIds.current.has(wordId)) {
      studiedIds.current.add(wordId);
      setStats((s) => ({ ...s, studied: s.studied + 1 }));
    }
    advance();
  };

  const handleQuizDone = (wordId: string, outcome: QuizOutcome) => {
    if (outcome.kind === 'known') {
      refreshWord(wordId, markKnown(wordId));
      queueRef.current!.retire(wordId);
    } else if (outcome.kind === 'skip') {
      refreshWord(wordId, applySkip(wordId));
      queueRef.current!.report(wordId, 'skip');
      // "I don't know" returns to the word's learning card right away;
      // the queue re-quizzes it a few cards later.
      setCurrent({ wordId, kind: 'study' });
      return;
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
    // Only highlight the current word on its STUDY card — never during its
    // quiz, where a sidebar highlight would reveal which word is being asked
    // (the highlight was spoiling the multiple-choice answer).
    const isCurrent = current?.wordId === w.id && current.kind === 'study';
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
    <div
      className={`collapsible-grid relative mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] ${sidebarOpen ? '' : 'closed'}`}
    >
      <aside className="collapsible-aside hidden border-r border-border px-5 py-6 lg:block">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="m-0 truncate text-xs font-bold tracking-widest text-vocab uppercase">{groupTitle}</p>
            <button
              type="button"
              aria-label="Hide word list"
              title="Hide word list"
              onClick={() => toggleSidebar(false)}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-faint hover:bg-surface-sunken hover:text-ink"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 6-6 6 6 6"></path>
              </svg>
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
            <div className="h-full bg-gradient-to-r from-vocab to-gold" style={{ width: `${(started / words.length) * 100}%` }} />
          </div>
          <p className="m-0 mt-1 text-xs font-semibold text-ink-faint">
            {started} / {words.length} started · {mastered} mastered
          </p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-1">{wordList}</div>
      </aside>

      {!sidebarOpen && (
        <button
          type="button"
          aria-label="Show word list"
          title="Show word list"
          onClick={() => toggleSidebar(true)}
          className="absolute top-16 left-0 z-10 hidden h-14 w-6 cursor-pointer items-center justify-center rounded-r-md border border-l-0 border-border bg-surface-raised text-ink-faint shadow-sm hover:text-vocab lg:flex"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6"></path>
          </svg>
        </button>
      )}

      <main className="flex flex-col items-center px-4 py-8 sm:px-6 sm:py-10">
        {/* Mobile: same word list, collapsible above the stage (same component, responsive layout) */}
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
            <StudyCard
              key={`${current.wordId}-s`}
              word={currentWord}
              eyebrow={progress[current.wordId].stage === 0 ? 'New word' : 'Review'}
              difficult={progress[current.wordId].difficult}
              onNext={() => handleStudyNext(current.wordId)}
              onMarkDifficult={() => refreshWord(current.wordId, markDifficult(current.wordId))}
              onMarkKnown={() => {
                // Same as marking known from a quiz: straight to Mastered,
                // out of this session, on to the next card.
                refreshWord(current.wordId, markKnown(current.wordId));
                queueRef.current!.retire(current.wordId);
                studiedIds.current.add(current.wordId);
                advance();
              }}
            />
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
