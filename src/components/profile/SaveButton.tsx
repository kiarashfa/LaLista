/**
 * Nav save chip + profile avatar, as one cluster.
 * Local file: a floppy. Cloud-synced device: a cloud; tapping it syncs now
 * (renewing an expired sign-in if needed).
 *
 * Status changes play a short "reveal": the save circle stretches to the
 * right and merges with the avatar into one capsule, a large mark
 * (✓ saved, ● unsaved, ! paused, ✕ failed) fades in between them, holds for
 * a moment, then fades out as the capsule splits back into two circles.
 * On phones there's no room to widen the nav, so the mark briefly takes the
 * save icon's place instead. Lasting states stay visible as a tint.
 * Also hosts background syncing + its toasts on every page.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { startAutoSync, type SyncPhase } from '../../lib/cloud/sync';
import CloudToast from './CloudToast';
import ProfileChip from './ProfileChip';
import { useSave } from './useSave';

const CLOUD_TITLE: Record<SyncPhase, string> = {
  off: '',
  synced: 'Synced',
  pending: 'Changes waiting to sync',
  syncing: 'Syncing…',
  'needs-auth': 'Sync paused. Tap to reconnect',
  offline: "Offline, will sync once you're back online",
  error: "Couldn't sync. Tap to retry",
};

type Tone = 'success' | 'warn' | 'error' | 'unsaved' | 'muted';
type MarkKind = 'check' | 'dot' | 'bang' | 'cross';

/** How long the mark stays fully visible. */
const HOLD_MS = 1100;
/** Background syncs confirm with a ✓ at most this often (explicit saves always do). */
const SYNC_CHECK_EVERY_MS = 45_000;

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warn: 'text-warning',
  error: 'text-error',
  unsaved: 'text-vocab',
  muted: 'text-ink-faint',
};

const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]';
/** Mark in: after the stretch has begun. Mark out: first, before the shrink. */
const markMotion = (open: boolean) =>
  open ? 'translate-x-0 scale-100 opacity-100 duration-[260ms] delay-[160ms]' : '-translate-x-1 scale-50 opacity-0 duration-[160ms] delay-0';

function Mark({ kind, tone }: { kind: MarkKind; tone: Tone }) {
  if (kind === 'dot') return <span className="block h-2.5 w-2.5 rounded-pill bg-vocab" />;
  if (kind === 'bang') return <span className={`text-lg leading-none font-black ${TONE_TEXT[tone]}`}>!</span>;
  const path = kind === 'check' ? 'M20 6 9 17l-5-5' : 'M18 6 6 18M6 6l12 12';
  return (
    <svg className={`h-4.5 w-4.5 ${TONE_TEXT[tone]}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

interface Props {
  autoRefreshes?: boolean;
  /** The Progress page is open (highlights the avatar). */
  profileActive?: boolean;
}

export default function SaveButton({ autoRefreshes = false, profileActive = false }: Props) {
  const { profile, dirty, status, cloud, save, overlay } = useSave();
  const linked = cloud.link !== null;

  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [mark, setMark] = useState<{ kind: MarkKind; tone: Tone }>({ kind: 'check', tone: 'success' });
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastCheckAt = useRef(0);

  const reveal = (kind: MarkKind, tone: Tone) => {
    if (kind === 'check') lastCheckAt.current = Date.now();
    setMark({ kind, tone });
    setOpen(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), HOLD_MS + 300);
  };

  useEffect(() => startAutoSync(), []);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Explicit save / sync results.
  useEffect(() => {
    if (!status) return;
    reveal(status.startsWith("Couldn't") ? 'cross' : 'check', status.startsWith("Couldn't") ? 'error' : 'success');
  }, [status]);

  // Cloud phase changes (background syncing).
  const prevPhase = useRef<SyncPhase>(cloud.phase);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = cloud.phase;
    if (!linked || prev === cloud.phase || status) return;
    if (cloud.phase === 'needs-auth') reveal('bang', 'warn');
    else if (cloud.phase === 'error') reveal('cross', 'error');
    else if (cloud.phase === 'offline') reveal('bang', 'muted');
    else if (cloud.phase === 'synced' && prev === 'syncing') {
      // Recovering from trouble, or first sync on this page, always confirms.
      if (Date.now() - lastCheckAt.current > SYNC_CHECK_EVERY_MS) reveal('check', 'success');
    }
  }, [cloud.phase, linked, status]);

  // Local file: the first change after a save.
  const prevDirty = useRef(dirty);
  useEffect(() => {
    const was = prevDirty.current;
    prevDirty.current = dirty;
    if (!linked && dirty && !was) reveal('dot', 'unsaved');
  }, [dirty, linked]);

  // No profile yet: nothing to save, just the (silhouette) avatar.
  if (!profile) return <ProfileChip active={profileActive} />;

  const label =
    status ??
    (linked
      ? `${cloud.providerLabel ?? 'Cloud'}: ${CLOUD_TITLE[cloud.phase]}`
      : dirty
        ? 'You have unsaved progress. Save it to your file'
        : 'Save progress to your file');

  // Lasting state, shown as a tint on the circle and icon.
  let tint = { border: 'border-border', text: 'text-ink-soft' };
  if (linked && cloud.phase === 'needs-auth') tint = { border: 'border-warning', text: 'text-warning' };
  else if (linked && cloud.phase === 'error') tint = { border: 'border-error', text: 'text-error' };
  else if (linked && cloud.phase === 'offline') tint = { border: 'border-border', text: 'text-ink-faint' };
  else if (!linked && dirty) tint = { border: 'border-vocab', text: 'text-vocab' };
  if (hover) tint = { border: 'border-success', text: 'text-success' };

  const icon: ReactNode = linked ? (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
    </svg>
  ) : (
    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <path d="M17 21v-8H7v8M7 3v5h8"></path>
    </svg>
  );

  return (
    <div className="relative flex items-center">
      {overlay}
      {linked && <CloudToast status={cloud} onSync={() => void save()} autoRefreshes={autoRefreshes} />}

      {/* The save circle's outline. At rest it sits exactly behind the save icon;
          while revealing it stretches right to wrap the avatar as well. */}
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-y-0 left-0 rounded-pill border bg-surface-base motion-reduce:transition-none',
          `transition-[width,box-shadow,border-color] duration-[380ms] ${EASE}`,
          open ? 'w-full shadow-md delay-0' : 'w-9 delay-[140ms] max-[374px]:w-8 sm:w-10',
          tint.border,
        ].join(' ')}
      />

      <button
        type="button"
        onClick={() => void save()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={label}
        aria-label={label}
        className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill transition-colors duration-300 max-[374px]:h-8 max-[374px]:w-8 sm:h-10 sm:w-10 ${tint.text}`}
      >
        <span className={`flex transition-[opacity,transform] duration-200 motion-reduce:transition-none ${open ? 'max-sm:scale-50 max-sm:opacity-0' : ''}`}>{icon}</span>
        {/* Phones: the mark takes the icon's place. */}
        <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center transition-[opacity,transform] motion-reduce:transition-none sm:hidden ${EASE} ${markMotion(open)}`}>
          <Mark kind={mark.kind} tone={mark.tone} />
        </span>
      </button>

      {/* Wider screens: the mark opens a slot between the save icon and the avatar. */}
      <span
        aria-hidden="true"
        className={[
          'relative hidden items-center justify-center overflow-hidden motion-reduce:transition-none sm:flex',
          `transition-[width] duration-[380ms] ${EASE}`,
          open ? 'w-7 delay-0' : 'w-0 delay-[140ms]',
        ].join(' ')}
      >
        <span className={`flex transition-[opacity,transform] motion-reduce:transition-none ${EASE} ${markMotion(open)}`}>
          <Mark kind={mark.kind} tone={mark.tone} />
        </span>
      </span>

      <span className="relative ml-0.5 sm:ml-2">
        <ProfileChip active={profileActive} bare={open} />
      </span>
    </div>
  );
}
