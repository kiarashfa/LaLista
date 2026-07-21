/**
 * The Progress page island — the load/save surface plus the two
 * surfaces (Dashboard + Profile), honestly framed: files, never accounts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { withBase } from '../../lib/paths';
import { forgetHandle, openWithPicker, readInputFile, supportsFileSystemAccess, type SaveOutcome } from '../../lib/storage/fileAccess';
import { parseSaveFile, SAVE_ERROR_MESSAGES } from '../../lib/storage/saveFile';
import { applyLoadedSaveFile, closeSession, createProfile, loadSession, setNotepad } from '../../lib/storage/session';
import { effectiveStreak, localDateString } from '../../lib/storage/streak';
import { scoreBand, type ScoreBand } from '../../lib/grading/thresholds';
import { STAGE_NAMES } from '../../lib/srs/stages';
import type { SessionState } from '../../types/progress';
import { AvatarPicker, AvatarView } from './AvatarPicker';
import TransferOverlay from './TransferOverlay';
import { useSave } from './useSave';
import type { Avatar } from '../../types/profile';

interface GroupCard {
  slug: string;
  title: string;
  count: number;
  url: string;
  /** The group's word ids — server-provided so rollups never guess. */
  wordIds: string[];
}
interface LessonChip {
  id: string;
  number: number;
  title: string;
  url: string;
}
interface PartSection {
  numeral: string;
  title: string;
  lessons: LessonChip[];
}
interface Props {
  groups: GroupCard[];
  parts: PartSection[];
}

/** A save outcome that actually wrote the user's progress to a file. */
const persisted = (o: SaveOutcome) => o === 'saved-in-place' || o === 'saved-as' || o === 'downloaded';

const BAND_CHIP: Record<ScoreBand, string> = {
  none: 'border-border bg-surface-sunken text-ink-faint',
  poor: 'border-error bg-error-bg text-error',
  fair: 'border-warning bg-gold-bg text-warning',
  good: 'border-success bg-success-bg text-success',
};

export default function ProgressApp({ groups, parts }: Props) {
  const [state, setState] = useState<SessionState | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<Avatar>({ kind: 'emoji', value: '🦊' });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const notepadTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [loadTransfer, setLoadTransfer] = useState<null | { done: boolean; name: string }>(null);
  const { dirty, fsa, status, save, refresh, overlay: saveOverlay } = useSave();

  const reload = () => setState(loadSession());
  useEffect(reload, []);

  const now = Date.now();

  const applyText = (text: string, fileName: string) => {
    const parsed = parseSaveFile(text);
    if (!parsed.ok) {
      setLoadError(`${fileName}: ${SAVE_ERROR_MESSAGES[parsed.error]}`);
      return;
    }
    setLoadError(null);
    // Loading theater: apply immediately, reveal after.
    setLoadTransfer({ done: false, name: parsed.file.profile.name });
    applyLoadedSaveFile(parsed.file);
    setTimeout(() => setLoadTransfer((t) => (t ? { ...t, done: true } : t)), 350);
  };

  const loadOverlay = loadTransfer ? (
    <TransferOverlay
      mode="load"
      done={loadTransfer.done}
      onFinished={() => {
        setNotice(`Welcome back, ${loadTransfer.name} — progress loaded.`);
        setLoadTransfer(null);
        refresh();
        reload();
      }}
    />
  ) : null;

  const startLoad = async () => {
    setLoadError(null);
    if (supportsFileSystemAccess()) {
      const loaded = await openWithPicker();
      if (loaded) applyText(loaded.text, loaded.fileName);
    } else {
      fileInput.current?.click();
    }
  };

  // "Done for now" — save first when there's unsaved progress (save before
  // closing rather than dropping the work), then close. If the
  // save is cancelled/fails, stay put so nothing is lost. Closing also forgets
  // the file handle, so the NEXT profile isn't written onto this profile's file
  // — the stale-handle bug that saved a freshly-created user under the previous
  // user's filename.
  const doneForNow = async () => {
    if (dirty && !persisted(await save())) return;
    await forgetHandle();
    closeSession();
    window.location.assign(withBase('/'));
  };

  // "Load a different file" — same save-first safety, then open the picker
  // (which binds a fresh handle to the newly chosen file).
  const loadDifferent = async () => {
    if (dirty && !persisted(await save())) return;
    void startLoad();
  };

  if (!state) return null;

  const anonymousProgress =
    !state.profile && (Object.keys(state.vocabulary).length > 0 || Object.keys(state.grammar).length > 0);

  // ---------- No profile: the landing flow ----------
  if (!state.profile) {
    return (
      <div className="mx-auto max-w-[560px]">
        {loadOverlay}
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) applyText((await readInputFile(f)).text, f.name);
          e.target.value = '';
        }} />
        <h1 className="display-editorial m-0 text-center text-4xl font-medium text-ink">Your progress, your file</h1>
        <p className="mx-auto mt-3 mb-8 max-w-[440px] text-center leading-relaxed text-ink-soft">
          LaLista has no accounts. Your progress lives in a small file <em>you</em> keep — load it when you arrive, save
          it when you're done.
        </p>

        {loadError && <p className="mb-4 rounded-md border border-error bg-error-bg px-4 py-3 text-sm text-error">{loadError}</p>}
        {anonymousProgress && (
          <p className="mb-4 rounded-md border border-gold bg-gold-bg px-4 py-3 text-sm text-ink-soft">
            You've been studying without a profile — creating one now will keep that progress.
          </p>
        )}

        {!creating ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => void startLoad()} className="cursor-pointer rounded-lg border-2 border-border bg-surface-raised p-6 text-left shadow-md hover:border-success">
              <p className="m-0 text-2xl" aria-hidden="true">📂</p>
              <p className="m-0 mt-2 font-bold text-ink">Load your file</p>
              <p className="m-0 mt-1 text-sm text-ink-soft">Pick your lalista-progress-….json from wherever you keep it.</p>
            </button>
            <button type="button" onClick={() => setCreating(true)} className="cursor-pointer rounded-lg border-2 border-border bg-surface-raised p-6 text-left shadow-md hover:border-vocab">
              <p className="m-0 text-2xl" aria-hidden="true">✨</p>
              <p className="m-0 mt-2 font-bold text-ink">Start fresh</p>
              <p className="m-0 mt-1 text-sm text-ink-soft">New profile: pick a name and a face, start learning.</p>
            </button>
          </div>
        ) : (
          <form
            className="rounded-lg border border-border bg-surface-raised p-6 shadow-md"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              // A brand-new profile isn't bound to any file yet — drop any handle
              // left over from a previous profile so its first save prompts for a
              // fresh location (fixes saving a new user under an old user's file).
              await forgetHandle();
              createProfile({ name: name.trim(), avatar, createdAt: new Date().toISOString() });
              reload();
              refresh();
            }}
          >
            <label className="mb-1 block text-sm font-bold text-ink" htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
              placeholder="How should we call you?"
              className="w-full rounded-md border-2 border-border bg-surface-base px-4 py-2.5 text-ink outline-none focus:border-vocab"
            />
            <p className="mt-4 mb-1 text-sm font-bold text-ink">Avatar</p>
            <AvatarPicker value={avatar} onChange={setAvatar} />
            <div className="mt-5 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setCreating(false)} className="cursor-pointer rounded-pill border-2 border-border px-4 py-2 text-sm font-bold text-ink">
                Back
              </button>
              <button type="submit" disabled={!name.trim()} className="cursor-pointer rounded-pill bg-vocab px-6 py-2.5 text-sm font-bold text-white hover:bg-vocab-hover disabled:opacity-40">
                Create profile
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // ---------- Profile + dashboard ----------
  const { profile, vocabulary, grammar, testScores, streak, notepad } = state;
  const stageCounts = Array.from({ length: 7 }, (_, s) => Object.values(vocabulary).filter((p) => p.stage === s).length);
  const started = Object.values(vocabulary).length;
  const masteredCount = stageCounts[6];
  const difficultCount = Object.values(vocabulary).filter((p) => p.difficult).length;
  const readCount = Object.values(grammar).filter((g) => g.readAt).length;
  const attempted = Object.values(grammar).filter((g) => g.best);
  const bandCount = (band: ScoreBand) => attempted.filter((g) => scoreBand(g.best!.correct, g.best!.total) === band).length;
  const liveStreak = effectiveStreak(streak, now);
  const today = localDateString(now);
  const totalWords = groups.reduce((n, g) => n + g.count, 0);

  return (
    <div className="mx-auto max-w-[900px]">
      {loadOverlay}
      {saveOverlay}
      {notice && <p className="mb-6 rounded-md border border-success bg-success-bg px-4 py-3 text-sm font-semibold text-success">{notice}</p>}

      <header className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-raised p-6 shadow-md">
        <AvatarView avatar={profile.avatar} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="display-friendly m-0 truncate text-3xl font-semibold text-ink">{profile.name}</h1>
          <p className="m-0 mt-0.5 flex flex-wrap gap-x-2 text-sm text-ink-faint">
            <span className="whitespace-nowrap">since {new Date(profile.createdAt).toLocaleDateString()}</span>
            {liveStreak > 0 ? (
              <span className="font-bold whitespace-nowrap text-vocab">🔥 {liveStreak}-day streak</span>
            ) : (
              <span className="whitespace-nowrap">no active streak</span>
            )}
            {streak.longest > 1 && <span className="whitespace-nowrap">longest {streak.longest}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void save()} className="cursor-pointer rounded-pill bg-success px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
            {status ?? (dirty ? 'Save changes' : 'Save')}
          </button>
          <button type="button" onClick={() => void loadDifferent()} className="cursor-pointer rounded-pill border-2 border-border px-4 py-2 text-sm font-bold text-ink hover:border-ink-faint">
            Load a different file
          </button>
          <button
            type="button"
            onClick={() => void doneForNow()}
            className="cursor-pointer rounded-pill border-2 border-border px-4 py-2 text-sm font-bold text-ink hover:border-ink-faint"
          >
            Done for now
          </button>
        </div>
        {!fsa && (
          <p className="m-0 w-full rounded-md bg-surface-sunken px-4 py-2.5 text-xs leading-relaxed text-ink-soft">
            This browser can't save in place, so each save downloads a fresh copy of your file — keep the newest one.
            (Chrome and Edge can save directly to the same file.)
          </p>
        )}
      </header>

      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        if (f) applyText((await readInputFile(f)).text, f.name);
        e.target.value = '';
      }} />
      {loadError && <p className="mt-4 rounded-md border border-error bg-error-bg px-4 py-3 text-sm text-error">{loadError}</p>}

      {/* ---- Stats ---- */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface-raised p-5 shadow-sm">
          <p className="m-0 text-xs font-bold tracking-widest text-vocab uppercase">Vocabulary</p>
          <p className="m-0 mt-2 text-3xl font-bold text-ink">
            {masteredCount}
            <span className="text-base font-semibold text-ink-faint"> / {totalWords} mastered</span>
          </p>
          <p className="m-0 mt-1 text-sm text-ink-soft">{started} started · {difficultCount} marked difficult</p>
          <div className="mt-3 flex flex-col gap-1">
            {STAGE_NAMES.map((label, s) =>
              stageCounts[s] > 0 ? (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-ink-faint">{label}</span>
                  <span className="h-2 rounded-pill bg-vocab" style={{ width: `${Math.max(4, (stageCounts[s] / started) * 100)}%`, opacity: 0.35 + (s / 6) * 0.65 }} />
                  <span className="font-semibold text-ink-soft">{stageCounts[s]}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-5 shadow-sm">
          <p className="m-0 text-xs font-bold tracking-widest text-grammar uppercase">Grammar</p>
          <p className="m-0 mt-2 text-3xl font-bold text-ink">
            {readCount}
            <span className="text-base font-semibold text-ink-faint"> / {parts.reduce((n, p) => n + p.lessons.length, 0)} read</span>
          </p>
          <p className="m-0 mt-1 text-sm text-ink-soft">{attempted.length} workbooks attempted</p>
          <p className="m-0 mt-3 flex gap-3 text-sm font-semibold">
            <span className="text-success">{bandCount('good')} solid</span>
            <span className="text-warning">{bandCount('fair')} getting there</span>
            <span className="text-error">{bandCount('poor')} needs re-read</span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-5 shadow-sm">
          <p className="m-0 text-xs font-bold tracking-widest text-gold uppercase">Test bests</p>
          <p className="m-0 mt-2 text-3xl font-bold text-ink">
            {testScores.allTime?.score ?? '—'}
            <span className="text-base font-semibold text-ink-faint"> all-time</span>
          </p>
          <p className="m-0 mt-1 text-sm text-ink-soft">
            today: <b>{testScores.today?.date === today ? testScores.today.score : '—'}</b>
          </p>
        </div>
      </section>

      {/* ---- Notepad ---- */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold tracking-wide text-ink-soft uppercase">Notepad</h2>
        <textarea
          defaultValue={notepad}
          rows={4}
          placeholder="Jot anything — mnemonic tricks, words to ask about, favorite sentences. Lives in your save file."
          className="w-full rounded-md border-2 border-border bg-surface-raised px-4 py-3 text-[0.95rem] text-ink outline-none focus:border-gold"
          onChange={(e) => {
            if (notepadTimer.current) clearTimeout(notepadTimer.current);
            const text = e.target.value;
            notepadTimer.current = setTimeout(() => setNotepad(text), 500);
          }}
        />
      </section>

      {/* ---- Dashboard: vocabulary groups ---- */}
      <section className="mt-8">
        <h2 className="mb-3 border-b border-border pb-2 text-sm font-bold tracking-wide text-ink-soft uppercase">All vocabulary groups</h2>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const gMastered = g.wordIds.filter((id) => vocabulary[id]?.stage === 6).length;
            return (
              <li key={g.slug}>
                <a href={g.url} className="block rounded-md border border-border bg-surface-raised px-4 py-3 no-underline shadow-sm hover:border-vocab">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{g.title}</span>
                    <span className="shrink-0 text-xs font-semibold text-ink-faint">{gMastered}/{g.count}</span>
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
                    <span className="block h-full rounded-pill bg-gradient-to-r from-vocab to-gold" style={{ width: `${(gMastered / g.count) * 100}%` }} />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- Dashboard: all 57 grammar chapters as Part cards, two signals each ---- */}
      <section className="mt-8">
        <h2 className="mb-3 border-b border-border pb-2 text-sm font-bold tracking-wide text-ink-soft uppercase">All grammar chapters</h2>
        <p className="m-0 mb-3 text-xs text-ink-faint">
          Bar = chapters read · square color = best workbook score (gray not attempted, red &lt;50%, yellow 50–79%, green ≥80%) · dot = read
        </p>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {parts.map((part) => {
            const readInPart = part.lessons.filter((l) => grammar[l.id]?.readAt).length;
            return (
              <li key={part.numeral}>
                <div className="flex h-full flex-col rounded-md border border-border bg-surface-raised px-4 py-3 shadow-sm">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      <span className="font-display mr-1 text-grammar italic">{part.numeral}</span>
                      {part.title}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-ink-faint">
                      {readInPart}/{part.lessons.length}
                    </span>
                  </span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
                    <span
                      className="block h-full rounded-pill bg-gradient-to-r from-grammar to-gold"
                      style={{ width: `${(readInPart / part.lessons.length) * 100}%` }}
                    />
                  </span>
                  <span className="mt-2.5 flex flex-wrap gap-1">
                    {part.lessons.map((l) => {
                      const p = grammar[l.id];
                      const band: ScoreBand = p?.best ? scoreBand(p.best.correct, p.best.total) : 'none';
                      return (
                        <a
                          key={l.id}
                          href={l.url}
                          title={`${l.number} · ${l.title}${p?.best ? ` — best ${p.best.correct}/${p.best.total}` : ''}${p?.readAt ? ' · read' : ''}`}
                          className={`relative flex h-6 w-7 items-center justify-center rounded-[5px] border text-[0.68rem] font-bold no-underline ${BAND_CHIP[band]}`}
                        >
                          {l.number}
                          {p?.readAt && <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-pill bg-success" aria-label="read" />}
                        </a>
                      );
                    })}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
