/**
 * Cloud pieces of the Progress page:
 * - CloudStart: "Continue with <cloud>" on the no-profile landing, plus the
 *   picker when that cloud holds several profiles;
 * - CloudStatusPanel: on the dashboard, either the live sync state or an
 *   invitation to start syncing this profile.
 * The heavy lifting (sign-in, merge, sync) lives in src/lib/cloud/sync.ts.
 */
import { useEffect, useState } from 'react';
import { availableProviders } from '../../lib/cloud/providers';
import { connectAndList, type SyncStatus } from '../../lib/cloud/sync';
import { CloudCancelledError, type CloudProvider, type ProviderId, type RemoteSave } from '../../lib/cloud/types';

/** User-facing message for a failed cloud action; null for a plain cancel. */
export function cloudErrorMessage(e: unknown): string | null {
  if (e instanceof CloudCancelledError) return e.message === 'Cancelled' ? null : e.message;
  if (e instanceof TypeError) return "Couldn't reach the cloud — check your connection and try again.";
  return e instanceof Error ? e.message : 'Something went wrong — try again.';
}

export function useCloudProviders(): CloudProvider[] {
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  useEffect(() => {
    const list = availableProviders();
    list.forEach((p) => p.preload());
    setProviders(list);
  }, []);
  return providers;
}

function when(iso: string | number): string {
  const ms = typeof iso === 'number' ? iso : Date.parse(iso);
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Date(ms).toLocaleDateString();
}

const CloudIcon = ({ className = 'h-6 w-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
  </svg>
);

// ---------- Landing ----------

interface StartProps {
  providers: CloudProvider[];
  onPick: (providerId: ProviderId, save: RemoteSave, account: string | null) => void;
  /** Signed in, but that cloud holds no LaLista progress yet. */
  onEmpty: (providerId: ProviderId, account: string | null, label: string) => void;
  onError: (message: string) => void;
}

export function CloudStart({ providers, onPick, onEmpty, onError }: StartProps) {
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [choice, setChoice] = useState<null | { provider: CloudProvider; account: string | null; saves: RemoteSave[] }>(null);

  const start = async (provider: CloudProvider) => {
    setBusy(provider.id);
    try {
      const { account, saves } = await connectAndList(provider.id);
      if (saves.length === 0) onEmpty(provider.id, account, provider.label);
      else if (saves.length === 1) onPick(provider.id, saves[0], account);
      else setChoice({ provider, account, saves });
    } catch (e) {
      const message = cloudErrorMessage(e);
      if (message) onError(message);
    } finally {
      setBusy(null);
    }
  };

  if (choice) {
    return (
      <div className="mb-4 rounded-lg border-2 border-success bg-surface-raised p-5 shadow-md">
        <p className="m-0 font-bold text-ink">Which profile?</p>
        <p className="m-0 mt-1 text-sm text-ink-soft">
          {choice.provider.label}
          {choice.account ? ` (${choice.account})` : ''} holds several LaLista profiles.
        </p>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {choice.saves.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(choice.provider.id, s, choice.account)}
                className="flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-md border border-border bg-surface-base px-4 py-3 text-left hover:border-success"
              >
                <span className="truncate font-semibold text-ink">{s.profileName}</span>
                <span className="shrink-0 text-xs text-ink-faint">saved {when(s.modifiedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setChoice(null)} className="mt-3 cursor-pointer text-sm font-semibold text-ink-soft underline">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={busy !== null}
          onClick={() => void start(p)}
          className="flex cursor-pointer items-center gap-4 rounded-lg border-2 border-border bg-surface-raised p-5 text-left shadow-md hover:border-success disabled:cursor-wait disabled:opacity-70"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-success-bg text-success">
            <CloudIcon />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-ink">{busy === p.id ? `Connecting to ${p.label}…` : `Continue with ${p.label}`}</span>
            <span className="mt-0.5 block text-sm text-ink-soft">Pick up on any device — your progress syncs by itself as you study.</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------- Dashboard ----------

const PHASE_TEXT: Record<SyncStatus['phase'], string> = {
  off: '',
  synced: 'Up to date',
  pending: 'Changes waiting to sync',
  syncing: 'Syncing…',
  'needs-auth': 'Paused — tap Sync now to reconnect',
  offline: "Offline — will sync when you're back online",
  error: "Couldn't sync",
};

interface PanelProps {
  providers: CloudProvider[];
  cloud: SyncStatus;
  /** Start syncing this profile with the given cloud (called from a tap). */
  onConnect: (provider: CloudProvider) => void;
  connecting: ProviderId | null;
  onStop: () => void;
  onSaveCopy: () => void;
}

export function CloudStatusPanel({ providers, cloud, onConnect, connecting, onStop, onSaveCopy }: PanelProps) {
  const [confirmStop, setConfirmStop] = useState(false);

  if (cloud.link) {
    const attention = cloud.phase === 'needs-auth' || cloud.phase === 'error';
    return (
      <section className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-surface-raised px-5 py-4 shadow-sm ${attention ? 'border-warning' : 'border-border'}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill ${attention ? 'bg-gold-bg text-warning' : 'bg-success-bg text-success'}`}>
          <CloudIcon className="h-5 w-5" />
        </span>
        <div className="min-w-[12rem] flex-1">
          <p className="m-0 text-sm font-bold text-ink">Syncing with {cloud.providerLabel}</p>
          {cloud.link.account && <p className="m-0 truncate text-xs text-ink-faint">{cloud.link.account}</p>}
          <p className={`m-0 text-xs ${attention ? 'font-semibold text-warning' : 'text-ink-soft'}`}>
            {PHASE_TEXT[cloud.phase]}
            {cloud.phase === 'error' && cloud.error ? ` — ${cloud.error}` : ''}
            {cloud.link.lastSyncAt ? ` · last synced ${when(cloud.link.lastSyncAt)}` : ''}
          </p>
        </div>
        {confirmStop ? (
          <span className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-soft">Stop syncing on this device? Your copy in {cloud.providerLabel} stays.</span>
            <button type="button" onClick={onStop} className="cursor-pointer rounded-pill border-2 border-error px-3 py-1 font-bold text-error">
              Stop syncing
            </button>
            <button type="button" onClick={() => setConfirmStop(false)} className="cursor-pointer font-semibold text-ink-soft underline">
              Keep
            </button>
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <button type="button" onClick={onSaveCopy} className="cursor-pointer text-ink-soft underline hover:text-ink">
              Save a copy to a file
            </button>
            <button type="button" onClick={() => setConfirmStop(true)} className="cursor-pointer text-ink-soft underline hover:text-ink">
              Stop syncing here
            </button>
          </span>
        )}
      </section>
    );
  }

  if (providers.length === 0) return null;

  return (
    <section className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-dashed border-border bg-surface-raised px-5 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface-sunken text-ink-soft">
        <CloudIcon className="h-5 w-5" />
      </span>
      <div className="min-w-[12rem] flex-1">
        <p className="m-0 text-sm font-bold text-ink">Studying on more than one device?</p>
        <p className="m-0 text-xs text-ink-soft">Sync this profile through your own cloud — no more moving files around.</p>
      </div>
      <span className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={connecting !== null}
            onClick={() => onConnect(p)}
            className="cursor-pointer rounded-pill border-2 border-success px-4 py-2 text-sm font-bold text-success hover:bg-success-bg disabled:cursor-wait disabled:opacity-60"
          >
            {connecting === p.id ? 'Connecting…' : `Sync with ${p.label}`}
          </button>
        ))}
      </span>
    </section>
  );
}
