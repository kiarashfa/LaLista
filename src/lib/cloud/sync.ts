/**
 * Cloud sync engine: keeps this device's working cache and ONE save file
 * in the user's cloud in step, without any server of our own.
 *
 * Each sync:  stat remote → (remote moved on? read + three-way merge) →
 * write the result locally and remotely → remember it as the new "base".
 * The base (last version both sides agreed on) is what makes merging safe:
 * studying on a device that hasn't synced for a while never overwrites
 * progress made elsewhere.
 *
 * Automatic: a sync runs on arrival, a few seconds after changes, when the
 * tab is hidden and when it becomes visible again. When the provider's
 * token has expired the engine can't renew it without a tap, so status
 * flips to 'needs-auth' and the UI offers a one-tap reconnect — local
 * progress keeps accumulating safely meanwhile.
 */
import type { SessionState } from '../../types/progress';
import { buildSaveFile, parseSaveFile, SAVE_ERROR_MESSAGES, sessionFromSaveFile } from '../storage/saveFile';
import { applyLoadedSaveFile, getModifiedAt, loadSession, replaceSession, SESSION_CHANGED_EVENT } from '../storage/session';
import { deepEqual, mergeSessions } from './merge';
import { getProvider } from './providers';
import { CloudAuthError, CloudCancelledError, type CloudProvider, type ProviderId, type RemoteSave } from './types';

const LINK_KEY = 'lalista:cloud';
const BASE_KEY = 'lalista:cloudBase';
const DEBOUNCE_MS = 8_000;
const MAX_WAIT_MS = 45_000;
/** Returning to the tab re-checks the cloud at most this often. */
const RECHECK_MS = 30_000;

export interface CloudLink {
  provider: ProviderId;
  fileId: string;
  /** Account label (e.g. email), for display and to skip the account chooser. */
  account: string | null;
  /** Remote version this device last synced with. */
  version: string;
  /** Working-cache modified-at stamp that the last sync covered. */
  syncedAt: number;
  /** Wall-clock time of the last successful sync. */
  lastSyncAt: number;
}

export type SyncPhase = 'off' | 'synced' | 'pending' | 'syncing' | 'needs-auth' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  link: CloudLink | null;
  providerLabel: string | null;
  error: string | null;
  /** Set when the latest sync brought progress in from another device. */
  broughtIn: 'pulled' | 'merged' | null;
}

// ---------- Link + base persistence ----------

export function getLink(): CloudLink | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(LINK_KEY) ?? 'null') as CloudLink | null;
  } catch {
    return null;
  }
}

function writeLink(link: CloudLink): void {
  localStorage.setItem(LINK_KEY, JSON.stringify(link));
}

function getBase(): SessionState | null {
  try {
    return JSON.parse(localStorage.getItem(BASE_KEY) ?? 'null') as SessionState | null;
  } catch {
    return null;
  }
}

function setBase(state: SessionState): void {
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify(state));
  } catch {
    // Storage full: without a base, the next merge treats differences as
    // changed on both sides — still lossless, just less precise.
    localStorage.removeItem(BASE_KEY);
  }
}

/** True when this device has progress the cloud hasn't received yet. */
export function isCloudDirty(): boolean {
  const link = getLink();
  return !!link && getModifiedAt() > link.syncedAt;
}

const serialize = (state: SessionState) => JSON.stringify(buildSaveFile(state));

function parseRemote(text: string): SessionState {
  const parsed = parseSaveFile(text);
  if (!parsed.ok) throw new Error(SAVE_ERROR_MESSAGES[parsed.error]);
  return sessionFromSaveFile(parsed.file);
}

function mustGetProvider(id: ProviderId): CloudProvider {
  const provider = getProvider(id);
  if (!provider) throw new Error("That cloud option isn't available on this version of the site.");
  return provider;
}

// ---------- Status store ----------

let status: SyncStatus = { phase: 'off', link: null, providerLabel: null, error: null, broughtIn: null };
const listeners = new Set<(s: SyncStatus) => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSync(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(patch: Partial<SyncStatus>): void {
  const link = getLink();
  status = {
    ...status,
    ...patch,
    link,
    providerLabel: link ? (getProvider(link.provider)?.label ?? null) : null,
  };
  if (!link) status = { ...status, phase: 'off', error: null, broughtIn: null };
  listeners.forEach((fn) => fn(status));
}

/** Recompute the resting phase (keeps attention states like needs-auth). */
export function refreshSyncStatus(): void {
  const link = getLink();
  if (!link) return setStatus({ phase: 'off' });
  if (status.phase === 'syncing' || status.phase === 'needs-auth' || status.phase === 'error' || status.phase === 'offline') {
    return setStatus({});
  }
  setStatus({ phase: isCloudDirty() ? 'pending' : 'synced' });
}

/** Clear the one-shot "brought in progress" flag once the UI has shown it. */
export function acknowledgeBroughtIn(): void {
  setStatus({ broughtIn: null });
}

// ---------- The sync cycle ----------

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  // Serializes syncs across tabs of this browser (all share one cache).
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  return locks ? locks.request('lalista-cloud-sync', fn) : fn();
}

async function syncOnce(provider: CloudProvider): Promise<SyncStatus['broughtIn']> {
  const link = getLink();
  if (!link) return null;
  const snapshotAt = getModifiedAt();
  const local = loadSession();
  if (!local.profile) return null;
  const localDirty = snapshotAt > link.syncedAt;

  let fileId = link.fileId;
  let version: string;
  let result = local;
  let broughtIn: SyncStatus['broughtIn'] = null;

  const meta = await provider.stat(fileId);
  if (!meta) {
    // Removed from the cloud — recreate it from this device.
    const created = await provider.create(local.profile.name, serialize(local));
    fileId = created.id;
    version = created.version;
  } else if (meta.version === link.version) {
    version = localDirty ? (await provider.update(fileId, serialize(local))).version : meta.version;
  } else {
    const remoteFile = await provider.read(fileId);
    const remote = parseRemote(remoteFile.text);
    result = localDirty ? mergeSessions(getBase(), local, remote) : remote;
    broughtIn = localDirty ? 'merged' : 'pulled';
    version = deepEqual(result, remote) ? remoteFile.version : (await provider.update(fileId, serialize(result))).version;
  }

  let coveredAt = snapshotAt;
  if (deepEqual(result, local)) {
    broughtIn = null; // nothing new arrived
  } else {
    // Keep anything studied on this device while we were talking to the cloud.
    const concurrent = getModifiedAt() !== snapshotAt;
    const stamp = replaceSession(concurrent ? mergeSessions(local, loadSession(), result) : result);
    if (!concurrent) coveredAt = stamp;
  }
  setBase(result);
  writeLink({ ...link, fileId, version, syncedAt: coveredAt, lastSyncAt: Date.now() });
  return broughtIn;
}

let inFlight: Promise<boolean> | null = null;
let again = false;
let lastAttemptAt = 0;

function describeError(e: unknown): Partial<SyncStatus> {
  if (e instanceof CloudAuthError) return { phase: 'needs-auth', error: null };
  if (e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)) return { phase: 'offline', error: null };
  return { phase: 'error', error: e instanceof Error ? e.message : 'Sync failed' };
}

function runSync(provider: CloudProvider): Promise<boolean> {
  if (inFlight) {
    again = true;
    return inFlight;
  }
  inFlight = (async () => {
    let ok = true;
    do {
      again = false;
      lastAttemptAt = Date.now();
      setStatus({ phase: 'syncing', error: null });
      try {
        const broughtIn = await withLock(() => syncOnce(provider));
        setStatus({ phase: isCloudDirty() ? 'pending' : 'synced', ...(broughtIn ? { broughtIn } : {}) });
        ok = true;
      } catch (e) {
        setStatus(describeError(e));
        ok = false;
      }
    } while (again && ok);
    if (ok && isCloudDirty()) schedule(); // edits landed mid-sync
    return ok;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Sync now. With `interactive` (call ONLY from a tap), an expired sign-in is
 * renewed first — that's the one step browsers won't allow in the background.
 * Resolves true when this device and the cloud are in step.
 */
export async function syncNow({ interactive = false } = {}): Promise<boolean> {
  const link = getLink();
  if (!link) return false;
  const provider = getProvider(link.provider);
  if (!provider) {
    setStatus({ phase: 'error', error: "This cloud option isn't available on this version of the site." });
    return false;
  }
  if (!provider.hasToken()) {
    if (!interactive) {
      setStatus({ phase: 'needs-auth' });
      return false;
    }
    try {
      const account = await provider.connect(link.account);
      if (link.account && account && account.toLowerCase() !== link.account.toLowerCase()) {
        // Syncing with a different account would silently start a second copy there.
        provider.forget();
        setStatus({ phase: 'error', error: `This profile syncs with ${link.account} — sign in with that account.` });
        return false;
      }
      const current = getLink();
      if (current && account && !current.account) writeLink({ ...current, account });
    } catch (e) {
      setStatus(e instanceof CloudCancelledError ? { phase: 'needs-auth' } : describeError(e));
      return false;
    }
  }
  return runSync(provider);
}

// ---------- Automatic syncing ----------

let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let firstPendingAt = 0;

function flush(): void {
  clearTimeout(timer);
  firstPendingAt = 0;
  void syncNow();
}

function schedule(): void {
  const now = Date.now();
  if (!firstPendingAt) firstPendingAt = now;
  clearTimeout(timer);
  // Debounced, but never delayed past MAX_WAIT_MS during a long session.
  timer = setTimeout(flush, Math.max(0, Math.min(DEBOUNCE_MS, firstPendingAt + MAX_WAIT_MS - now)));
}

/** Wire up background syncing for this page. Safe to call more than once. */
export function startAutoSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener(SESSION_CHANGED_EVENT, () => {
    if (!getLink()) return;
    refreshSyncStatus();
    schedule();
  });
  document.addEventListener('visibilitychange', () => {
    if (!getLink()) return;
    if (document.visibilityState === 'hidden') {
      if (isCloudDirty()) flush();
    } else if (Date.now() - lastAttemptAt > RECHECK_MS) {
      void syncNow();
    }
  });
  window.addEventListener('online', () => {
    if (getLink()) void syncNow();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === LINK_KEY) refreshSyncStatus();
  });

  const link = getLink();
  if (link) {
    getProvider(link.provider)?.preload();
    refreshSyncStatus();
    void syncNow(); // arrival: bring in progress from elsewhere, push leftovers
  }
}

// ---------- Linking (all called from taps on the Progress page) ----------

/** Sign in and list the LaLista saves found in that cloud. */
export async function connectAndList(providerId: ProviderId): Promise<{ account: string | null; saves: RemoteSave[] }> {
  const provider = mustGetProvider(providerId);
  const account = await provider.connect();
  return { account, saves: await provider.list() };
}

/** Load a cloud save onto this device and keep it in sync from now on. Returns the profile name. */
export async function loadFromCloud(providerId: ProviderId, save: RemoteSave, account: string | null): Promise<string> {
  const provider = mustGetProvider(providerId);
  const remote = await provider.read(save.id);
  const parsed = parseSaveFile(remote.text);
  if (!parsed.ok) throw new Error(SAVE_ERROR_MESSAGES[parsed.error]);
  applyLoadedSaveFile(parsed.file);
  setBase(loadSession());
  writeLink({ provider: providerId, fileId: save.id, account, version: remote.version, syncedAt: getModifiedAt(), lastSyncAt: Date.now() });
  refreshSyncStatus();
  return parsed.file.profile.name;
}

/**
 * Start syncing the current profile. If the cloud already holds a save
 * with the same profile name, the two are merged; otherwise a new save is
 * created there.
 */
export async function linkCurrentProfile(
  providerId: ProviderId,
  account: string | null,
  saves: RemoteSave[],
): Promise<'created' | 'merged'> {
  const provider = mustGetProvider(providerId);
  const local = loadSession();
  if (!local.profile) throw new Error('Create or load a profile first.');
  const name = local.profile.name.trim().toLowerCase();
  const existing = saves.find((s) => s.profileName.trim().toLowerCase() === name);

  if (!existing) {
    const snapshotAt = getModifiedAt();
    const created = await provider.create(local.profile.name, serialize(local));
    setBase(local);
    writeLink({ provider: providerId, fileId: created.id, account, version: created.version, syncedAt: snapshotAt, lastSyncAt: Date.now() });
    refreshSyncStatus();
    return 'created';
  }

  const remoteFile = await provider.read(existing.id);
  const remote = parseRemote(remoteFile.text);
  // No shared history yet — merge without a base so nothing is dropped.
  const merged = mergeSessions(null, local, remote);
  const version = deepEqual(merged, remote) ? remoteFile.version : (await provider.update(existing.id, serialize(merged))).version;
  const stamp = deepEqual(merged, local) ? getModifiedAt() : replaceSession(merged);
  setBase(merged);
  writeLink({ provider: providerId, fileId: existing.id, account, version, syncedAt: stamp, lastSyncAt: Date.now() });
  refreshSyncStatus();
  return 'merged';
}

/** Stop syncing on this device. The cloud copy stays where it is. */
export function unlink({ forgetSignIn = true } = {}): void {
  const link = getLink();
  if (link && forgetSignIn) getProvider(link.provider)?.forget();
  localStorage.removeItem(LINK_KEY);
  localStorage.removeItem(BASE_KEY);
  refreshSyncStatus();
}
