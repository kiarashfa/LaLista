/**
 * Nav save chip — the always-visible save action, icon-only.
 * Local file: a floppy; a coral dot marks unsaved changes.
 * Cloud-synced device: a cloud whose badge shows the sync state; tapping it
 * syncs now (renewing an expired sign-in if needed).
 * After an explicit save a brief ✓ (or ✕ on failure) appears. Hidden until a
 * profile exists. Also hosts background syncing + its toasts on every page.
 */
import { useEffect } from 'react';
import { startAutoSync, type SyncPhase } from '../../lib/cloud/sync';
import CloudToast from './CloudToast';
import { useSave } from './useSave';

const CLOUD_TITLE: Record<SyncPhase, string> = {
  off: '',
  synced: 'Synced',
  pending: 'Changes waiting to sync',
  syncing: 'Syncing…',
  'needs-auth': 'Sync paused — tap to reconnect',
  offline: "Offline — will sync when you're back online",
  error: "Couldn't sync — tap to retry",
};

export default function SaveButton({ autoRefreshes = false }: { autoRefreshes?: boolean }) {
  const { profile, dirty, status, cloud, save, overlay } = useSave();

  useEffect(() => startAutoSync(), []);

  if (!profile) return null;

  const failed = status?.startsWith("Couldn't") ?? false;
  const linked = cloud.link !== null;
  const label =
    status ??
    (linked
      ? `${cloud.providerLabel ?? 'Cloud'}: ${CLOUD_TITLE[cloud.phase]}`
      : dirty
        ? 'You have unsaved progress — save to your file'
        : 'Save progress to your file');

  let badge = null;
  if (status) {
    badge = (
      <span className={`absolute -top-1.5 -right-1 text-[0.72rem] font-bold ${failed ? 'text-error' : 'text-success'}`} aria-hidden="true">
        {failed ? '✕' : '✓'}
      </span>
    );
  } else if (linked) {
    if (cloud.phase === 'needs-auth' || cloud.phase === 'error') {
      badge = (
        <span className={`absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-pill text-[0.6rem] font-black text-white ${cloud.phase === 'error' ? 'bg-error' : 'bg-warning'}`} aria-hidden="true">
          !
        </span>
      );
    } else if (cloud.phase === 'syncing' || cloud.phase === 'pending') {
      badge = <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-pill bg-gold ${cloud.phase === 'syncing' ? 'animate-pulse' : ''}`} aria-hidden="true" />;
    } else if (cloud.phase === 'synced') {
      badge = <span className="absolute -top-1.5 -right-1 text-[0.72rem] font-bold text-success" aria-hidden="true">✓</span>;
    }
  } else if (dirty) {
    badge = <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-pill bg-vocab" aria-label="unsaved changes" />;
  }

  return (
    <span className="flex items-center">
      {overlay}
      {linked && <CloudToast status={cloud} onSync={() => void save()} autoRefreshes={autoRefreshes} />}
      <button
        type="button"
        onClick={() => void save()}
        title={label}
        aria-label={label}
        className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill border bg-surface-base hover:border-success hover:text-success sm:h-10 sm:w-10 ${
          linked && (cloud.phase === 'needs-auth' || cloud.phase === 'error') ? 'border-warning text-warning' : 'border-border text-ink-soft'
        }`}
      >
        {linked ? (
          <svg className={`h-5 w-5 ${cloud.phase === 'offline' ? 'opacity-50' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
          </svg>
        ) : (
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <path d="M17 21v-8H7v8M7 3v5h8"></path>
          </svg>
        )}
        {badge}
      </button>
    </span>
  );
}
