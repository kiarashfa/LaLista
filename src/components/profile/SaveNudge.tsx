/**
 * Post-session save reminder (a deliberate exception to the
 * don't-nag philosophy — unsaved progress loss is the one high-cost
 * failure mode worth a nudge). Dropped into session-complete screens.
 * Cloud-synced devices sync on their own, so the nudge only appears there
 * when the sync is paused and needs a tap.
 */
import { withBase } from '../../lib/paths';
import { useSave } from './useSave';

export default function SaveNudge() {
  const { profile, dirty, status, cloud, save, overlay } = useSave();

  if (!profile) {
    return (
      <p className="m-0 mt-3 text-xs text-ink-faint">
        Progress is auto-saved in this browser only.{' '}
        <a href={withBase('/progress/')} className="font-semibold text-ink-soft underline">
          Create a profile
        </a>{' '}
        to keep it in a file you own.
      </p>
    );
  }

  if (cloud.link) {
    if (status) {
      return (
        <p className="m-0 mt-3 text-sm">
          {overlay}
          <span className="font-semibold text-success">{status}</span>
        </p>
      );
    }
    if (cloud.phase !== 'needs-auth' && cloud.phase !== 'error') {
      return (
        <p className="m-0 mt-3 text-xs text-ink-faint">
          ☁ {cloud.phase === 'synced' ? `Synced with ${cloud.providerLabel}` : cloud.phase === 'offline' ? "Offline, progress will sync once you're back online" : `Syncing with ${cloud.providerLabel}…`}
        </p>
      );
    }
    return (
      <p className="m-0 mt-3 text-sm">
        {overlay}
        <span className="text-ink-soft">☁ Nice session! Sync it to {cloud.providerLabel}:</span>{' '}
        <button type="button" onClick={() => void save()} className="cursor-pointer font-bold text-success underline">
          Sync now
        </button>
      </p>
    );
  }

  if (!dirty && !status) return null;

  return (
    <p className="m-0 mt-3 text-sm">
      {overlay}
      {status ? (
        <span className="font-semibold text-success">{status}</span>
      ) : (
        <>
          <span className="text-ink-soft">💾 Nice session! Remember your file:</span>{' '}
          <button type="button" onClick={() => void save()} className="cursor-pointer font-bold text-success underline">
            Save now
          </button>
        </>
      )}
    </p>
  );
}
