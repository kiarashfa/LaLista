/**
 * Cloud pieces of the Progress page:
 * - CloudStart: "Continue with <cloud>" on the no-profile landing, plus the
 *   picker when that cloud holds several profiles;
 * - CloudStatusPanel: on the dashboard, either the live sync state or an
 *   invitation to start syncing this profile.
 * Both are presentational; ProgressApp drives the flows (which may resume
 * after a sign-in redirect), and src/lib/cloud/ does the syncing.
 */
import { useEffect, useState } from 'react';
import { availableProviders } from '../../lib/cloud/providers';
import type { SyncStatus } from '../../lib/cloud/sync';
import { CloudCancelledError, type CloudProvider, type ProviderId, type RemoteSave } from '../../lib/cloud/types';
import ProviderLogo from './ProviderLogo';

/** User-facing message for a failed cloud action; null for a plain cancel. */
export function cloudErrorMessage(e: unknown): string | null {
  if (e instanceof CloudCancelledError) return e.message === 'Cancelled' ? null : e.message;
  if (e instanceof TypeError) return "Couldn't reach the cloud. Check your connection and try again.";
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
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

/** A service's logo on a small white tile, legible in light and dark themes. */
function LogoTile({ id, size = 'lg' }: { id: ProviderId; size?: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const logo = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md border border-border bg-white text-ink-soft ${box}`}>
      <ProviderLogo id={id} className={logo} />
    </span>
  );
}

// ---------- Landing ----------

export interface CloudChoice {
  provider: CloudProvider;
  account: string | null;
  saves: RemoteSave[];
}

interface StartProps {
  providers: CloudProvider[];
  /** The provider currently signing in (its button shows progress). */
  busy: ProviderId | null;
  /** Several profiles found — show the picker instead of the buttons. */
  choice: CloudChoice | null;
  onStart: (provider: CloudProvider) => void;
  onPick: (save: RemoteSave) => void;
  onBack: () => void;
}

export function CloudStart({ providers, busy, choice, onStart, onPick, onBack }: StartProps) {
  if (choice) {
    return (
      <div className="mb-4 rounded-lg border-2 border-success bg-surface-raised p-5 shadow-md">
        <div className="flex items-center gap-3">
          <LogoTile id={choice.provider.id} size="sm" />
          <div className="min-w-0">
            <p className="m-0 font-bold text-ink">Which profile?</p>
            <p className="m-0 truncate text-sm text-ink-soft">
              {choice.provider.label}
              {choice.account ? ` (${choice.account})` : ''} holds several LaLista profiles.
            </p>
          </div>
        </div>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {choice.saves.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-md border border-border bg-surface-base px-4 py-3 text-left hover:border-success"
              >
                <span className="truncate font-semibold text-ink">{s.profileName}</span>
                <span className="shrink-0 text-xs text-ink-faint">saved {when(s.modifiedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onBack} className="mt-3 cursor-pointer text-sm font-semibold text-ink-soft underline">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className={`mb-4 grid gap-3 ${providers.length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={busy !== null}
          onClick={() => onStart(p)}
          className="flex cursor-pointer items-center gap-4 rounded-lg border-2 border-border bg-surface-raised p-5 text-left shadow-md hover:border-success disabled:cursor-wait disabled:opacity-70"
        >
          <LogoTile id={p.id} />
          <span className="min-w-0">
            <span className="block font-bold text-ink">{busy === p.id ? `Connecting to ${p.label}…` : `Continue with ${p.label}`}</span>
            <span className="mt-0.5 block text-sm text-ink-soft">Pick up on any device. Progress syncs by itself.</span>
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
  'needs-auth': 'Paused: tap Sync now to reconnect',
  offline: "Offline, will sync once you're back online",
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
        <LogoTile id={cloud.link.provider} size="sm" />
        <div className="min-w-[12rem] flex-1">
          <p className="m-0 text-sm font-bold text-ink">Syncing with {cloud.providerLabel}</p>
          {cloud.link.account && <p className="m-0 truncate text-xs text-ink-faint">{cloud.link.account}</p>}
          <p className={`m-0 text-xs ${attention ? 'font-semibold text-warning' : 'text-ink-soft'}`}>
            {PHASE_TEXT[cloud.phase]}
            {cloud.phase === 'error' && cloud.error ? `: ${cloud.error}` : ''}
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
      <div className="min-w-[12rem] flex-1">
        <p className="m-0 text-sm font-bold text-ink">Studying on more than one device?</p>
        <p className="m-0 text-xs text-ink-soft">Sync this profile through your own cloud and stop moving files around.</p>
      </div>
      <span className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={connecting !== null}
            onClick={() => onConnect(p)}
            className="flex cursor-pointer items-center gap-2 rounded-pill border-2 border-border bg-surface-base py-1.5 pr-4 pl-2 text-sm font-bold text-ink hover:border-success disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-white">
              <ProviderLogo id={p.id} className="h-4 w-4" />
            </span>
            {connecting === p.id ? 'Connecting…' : `Sync with ${p.label}`}
          </button>
        ))}
      </span>
    </section>
  );
}
