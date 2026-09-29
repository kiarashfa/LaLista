/**
 * Small bottom toasts for cloud sync, shown on every page:
 * - sign-in expired → one-tap "Sync now" (browsers only allow renewing it
 *   from a tap), dismissible for the rest of this visit;
 * - progress arrived from another device → a heads-up, with a refresh
 *   offer on pages that don't update themselves;
 * - a sync error → its message and a retry.
 */
import { useEffect, useState } from 'react';
import { acknowledgeBroughtIn, type SyncStatus } from '../../lib/cloud/sync';

const DISMISS_KEY = 'lalista:syncPromptDismissed';

interface Props {
  status: SyncStatus;
  onSync: () => void;
  /** The current page re-renders itself when progress arrives (no refresh offer). */
  autoRefreshes: boolean;
}

function Toast({ children, tone }: { children: React.ReactNode; tone: 'info' | 'warn' | 'error' }) {
  const border = tone === 'error' ? 'border-error' : tone === 'warn' ? 'border-warning' : 'border-success';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="status" aria-live="polite">
      <div className={`pointer-events-auto flex w-full max-w-[460px] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 bg-surface-raised px-4 py-3 text-sm shadow-lg ${border}`}>
        {children}
      </div>
    </div>
  );
}

const btn = 'cursor-pointer rounded-pill px-3.5 py-1.5 text-xs font-bold';

export default function CloudToast({ status, onSync, autoRefreshes }: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [errorShown, setErrorShown] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  // "Brought in" is a one-shot heads-up; fade it after a while on self-updating pages.
  useEffect(() => {
    if (!status.broughtIn || !autoRefreshes) return;
    const t = setTimeout(acknowledgeBroughtIn, 6000);
    return () => clearTimeout(t);
  }, [status.broughtIn, autoRefreshes]);

  const where = status.providerLabel ?? 'the cloud';

  if (status.broughtIn) {
    return (
      <Toast tone="info">
        <span className="flex-1 text-ink-soft">
          ☁ {status.broughtIn === 'merged' ? 'Merged in progress from your other device.' : 'Brought in your latest progress from ' + where + '.'}
        </span>
        {!autoRefreshes && (
          <button type="button" className={`${btn} bg-success text-white`} onClick={() => window.location.reload()}>
            Refresh page
          </button>
        )}
        <button type="button" className={`${btn} text-ink-faint hover:text-ink`} onClick={acknowledgeBroughtIn} aria-label="Dismiss">
          ✕
        </button>
      </Toast>
    );
  }

  if (status.phase === 'needs-auth' && !dismissed) {
    const later = () => {
      setDismissed(true);
      try {
        sessionStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* per-visit convenience only */
      }
    };
    return (
      <Toast tone="warn">
        <span className="min-w-0 flex-1 text-ink-soft">
          <b className="text-ink">☁ Sync paused.</b> {where} needs a quick tap now and then to keep your devices in step.
        </span>
        <button type="button" className={`${btn} bg-success text-white hover:opacity-90`} onClick={onSync}>
          Sync now
        </button>
        <button type="button" className={`${btn} text-ink-soft hover:text-ink`} onClick={later}>
          Later
        </button>
      </Toast>
    );
  }

  if (status.phase === 'error' && status.error && errorShown !== status.error) {
    return (
      <Toast tone="error">
        <span className="min-w-0 flex-1 text-ink-soft">
          <b className="text-error">Couldn't sync with {where}.</b> {status.error}
        </span>
        <button type="button" className={`${btn} bg-success text-white hover:opacity-90`} onClick={onSync}>
          Retry
        </button>
        <button type="button" className={`${btn} text-ink-faint hover:text-ink`} onClick={() => setErrorShown(status.error)} aria-label="Dismiss">
          ✕
        </button>
      </Toast>
    );
  }

  return null;
}
