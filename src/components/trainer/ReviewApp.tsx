/**
 * Review island: low-stakes reinforcement. 6 choices, untimed, forgiving.
 * Never touches stage — refreshes lastReinforced (brightness) only.
 * Setup lets the user mix any of the four directions in one run, and scope
 * the pool: all Mastered words (default), or a single topic group — there
 * with a mastered-only / every-word choice. Words without a progress entry
 * (an every-word run) never gain one here: streak credit only.
 */
import { useEffect, useMemo, useState } from 'react';
import { shuffle } from '../../lib/shuffle';
import { getAllWordProgress, getProfile, refreshReinforced, touchPracticeActivity } from '../../lib/storage/session';
import type { VocabWordProgress } from '../../types/progress';
import type { Word } from '../../types/word';
import words from '../../content/vocabulary/words.json';
import groups from '../../content/vocabulary/groups.json';
import { assignModes, loadStoredModes, modesSummary, storeModes, type QuizMode } from './wordUtils';
import { buildPool, groupOptionsFor, masteredCount, ModePicker, ScopePicker, type PoolKind, type Scope } from './setupControls';
import { QuizCard } from './QuizCard';
import SaveNudge from '../profile/SaveNudge';

const ALL_WORDS = words as unknown as Word[];
const MODES_KEY = 'lalista:reviewModes';
const LEGACY_MODE_KEY = 'lalista:reviewMode';

type Phase = 'loading' | 'setup' | 'running' | 'done';

export default function ReviewApp({ vocabularyUrl }: { vocabularyUrl: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState<Record<string, VocabWordProgress>>({});
  const [modes, setModes] = useState<QuizMode[]>(['en-es']);
  const [scope, setScope] = useState<Scope>('all');
  const [poolKind, setPoolKind] = useState<PoolKind>('mastered');
  const [pool, setPool] = useState<Word[]>([]);
  const [qModes, setQModes] = useState<QuizMode[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    if (!getProfile()) return; // ProfileGate overlay is up
    setProgress(getAllWordProgress());
    setModes(loadStoredModes(MODES_KEY, LEGACY_MODE_KEY));
    // Deep link from a group page: /vocabulary/review/?group=<slug>
    const wanted = new URLSearchParams(window.location.search).get('group');
    if (wanted && groups.some((g) => g.slug === wanted)) setScope(wanted);
    setPhase('setup');
  }, []);

  const groupPools = useMemo(() => {
    const map = new Map<string, Word[]>();
    for (const w of ALL_WORDS) {
      if (!map.has(w.group)) map.set(w.group, []);
      map.get(w.group)!.push(w);
    }
    return map;
  }, []);

  const groupOptions = useMemo(() => groupOptionsFor(ALL_WORDS, groups, progress), [progress]);
  const masteredTotal = useMemo(() => masteredCount(ALL_WORDS, progress), [progress]);
  const poolCount = useMemo(() => buildPool(ALL_WORDS, progress, scope, poolKind).length, [progress, scope, poolKind]);

  const scopeLabel =
    scope === 'all'
      ? 'all Mastered words'
      : `${groupOptions.find((g) => g.slug === scope)?.title ?? scope} · ${poolKind === 'all' ? 'every word' : 'mastered only'}`;

  const pickModes = (next: QuizMode[]) => {
    setModes(next);
    if (next.length > 0) storeModes(MODES_KEY, next);
  };

  const start = () => {
    const chosen = shuffle(buildPool(ALL_WORDS, progress, scope, poolKind));
    if (chosen.length === 0 || modes.length === 0) return;
    setPool(chosen);
    setQModes(assignModes(chosen.length, modes));
    setIndex(0);
    setCorrectCount(0);
    setPhase('running');
  };

  if (phase === 'loading') return null;

  if (phase === 'setup') {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-6 py-8 shadow-md sm:px-8">
        <h2 className="m-0 text-center text-xl font-bold text-ink">Set up your review</h2>
        <p className="m-0 mt-1 text-center text-sm text-ink-soft">Stages never change here — this only keeps words bright.</p>

        {masteredTotal === 0 && (
          <p className="mt-4 mb-0 rounded-md border border-gold bg-gold-bg px-4 py-3 text-sm leading-relaxed text-ink-soft">
            🌱 You haven't Mastered any words yet, so the usual pool is empty. Pick a topic group below and choose{' '}
            <b>Every word</b> to practice it anyway — or{' '}
            <a href={vocabularyUrl} className="font-semibold text-ink underline">
              master some in Group Study
            </a>{' '}
            first.
          </p>
        )}

        <p className="mt-5 mb-2 text-xs font-bold tracking-widest text-ink-faint uppercase">Which words</p>
        <ScopePicker
          groups={groupOptions}
          masteredTotal={masteredTotal}
          scope={scope}
          poolKind={poolKind}
          onScope={setScope}
          onPoolKind={setPoolKind}
        />

        <p className="mt-5 mb-2 text-xs font-bold tracking-widest text-ink-faint uppercase">Directions — mix any</p>
        <ModePicker modes={modes} onChange={pickModes} />

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={start}
            disabled={poolCount === 0 || modes.length === 0}
            className="cursor-pointer rounded-pill bg-vocab px-8 py-3 text-sm font-bold text-white hover:bg-vocab-hover disabled:cursor-default disabled:opacity-40"
          >
            Start review →
          </button>
          <p className="m-0 mt-2 text-xs text-ink-faint">
            {modes.length === 0
              ? 'Pick at least one direction.'
              : poolCount === 0
                ? 'No words in this selection yet.'
                : `${poolCount} ${poolCount === 1 ? 'word' : 'words'} · ${modesSummary(modes)}`}
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'done' || index >= pool.length) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-8 py-10 text-center shadow-md">
        <p className="m-0 text-4xl" aria-hidden="true">✨</p>
        <h2 className="mt-3 mb-1 text-xl font-bold text-ink">All bright again</h2>
        <p className="m-0 text-sm text-ink-soft">
          {correctCount} of {pool.length} correct · {modesSummary(modes)} · {scopeLabel}. Stages untouched, as always.
        </p>
        <SaveNudge />
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={start}
            className="cursor-pointer rounded-pill border-2 border-border px-5 py-2.5 text-sm font-bold text-ink hover:border-vocab"
          >
            ↻ Once more
          </button>
          <button
            type="button"
            onClick={() => setPhase('setup')}
            className="cursor-pointer rounded-pill border-2 border-border px-5 py-2.5 text-sm font-bold text-ink hover:border-vocab"
          >
            Change setup
          </button>
          <a href={vocabularyUrl} className="rounded-pill bg-vocab px-5 py-2.5 text-sm font-bold text-white no-underline hover:bg-vocab-hover">
            Done
          </a>
        </div>
      </div>
    );
  }

  const word = pool[index];
  const mode = qModes[index] ?? modes[0] ?? 'en-es';
  return (
    <div>
      <p className="mb-4 text-center text-sm font-semibold text-ink-soft">
        {index + 1} of {pool.length} · {modesSummary(modes)}
      </p>
      <QuizCard
        key={`${word.id}-${mode}`}
        word={word}
        pool={groupPools.get(word.group) ?? ALL_WORDS}
        choiceCount={6}
        showMarkActions={false}
        allowSkip
        mode={mode}
        caption="Review never changes a word's stage — it just keeps it bright."
        onDone={(outcome) => {
          // Brightness refresh only for words that HAVE an entry; an
          // every-word run must not create stage-0 entries as a side effect.
          if (progress[word.id]) refreshReinforced(word.id);
          else touchPracticeActivity();
          if (outcome.kind === 'correct') setCorrectCount((c) => c + 1);
          setIndex((i) => i + 1);
        }}
      />
    </div>
  );
}
