/**
 * Shared save action + dirty tracking for SaveButton / ProgressApp / SaveNudge.
 * When this device syncs with a cloud, "save" means "sync now" and "dirty"
 * means "not yet in the cloud"; otherwise both refer to the local file.
 * Explicit saves play the TransferOverlay animation — consumers must render
 * the returned `overlay` node.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSyncStatus, isCloudDirty, subscribeSync, syncNow, type SyncStatus } from '../../lib/cloud/sync';
import { saveProgressFile, supportsFileSystemAccess, type SaveOutcome } from '../../lib/storage/fileAccess';
import { buildSaveFile } from '../../lib/storage/saveFile';
import { hasUnsavedChanges, loadSession, markSavedNow } from '../../lib/storage/session';
import { saveFileName, type ProfileInfo } from '../../types/profile';
import TransferOverlay from './TransferOverlay';

export type SaveResult = SaveOutcome | 'synced';

/** A save result that actually put the user's progress somewhere safe. */
export const persisted = (o: SaveResult) => o === 'saved-in-place' || o === 'saved-as' || o === 'downloaded' || o === 'synced';

/** Live cloud sync status (re-renders on every change). */
export function useCloudStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  useEffect(() => {
    setStatus(getSyncStatus());
    return subscribeSync(setStatus);
  }, []);
  return status;
}

export interface SaveHook {
  profile: ProfileInfo | null;
  dirty: boolean;
  fsa: boolean;
  status: string | null;
  cloud: SyncStatus;
  /** Sync (cloud-linked) or save to the user's file; resolves with what actually happened. */
  save: () => Promise<SaveResult>;
  /** Always the local file, even when cloud-linked (a manual backup copy). */
  saveToFile: () => Promise<SaveResult>;
  refresh: () => void;
  /** Render this — it's the animated saving overlay (null when idle). */
  overlay: ReactNode;
}

export function useSave(): SaveHook {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [fileDirty, setFileDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fsa, setFsa] = useState(false);
  const [transfer, setTransfer] = useState<null | { mode: 'save' | 'sync'; done: boolean; message: string }>(null);
  const cloud = useCloudStatus();
  const linked = cloud.link !== null;

  const refresh = useCallback(() => {
    setProfile(loadSession().profile);
    setFileDirty(hasUnsavedChanges());
  }, []);

  useEffect(() => {
    refresh();
    setFsa(supportsFileSystemAccess());
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, [refresh]);

  const flash = useCallback((message: string, ms: number) => {
    setStatus(message);
    setTimeout(() => setStatus(null), ms);
  }, []);

  const busy = useRef(false);

  const saveToFile = useCallback(async (): Promise<SaveResult> => {
    if (busy.current) return 'cancelled'; // one save at a time — a picker may be open
    const state = loadSession();
    if (!state.profile) return 'cancelled';
    busy.current = true;
    setTransfer({ mode: 'save', done: false, message: '' });
    const outcome = await saveProgressFile(JSON.stringify(buildSaveFile(state), null, 2), saveFileName(state.profile.name));
    if (outcome === 'saved-in-place' || outcome === 'saved-as' || outcome === 'downloaded') {
      markSavedNow();
      setTransfer({ mode: 'save', done: true, message: outcome === 'downloaded' ? 'Downloaded a fresh copy ✓' : 'Saved to your file ✓' });
    } else {
      setTransfer(null);
      if (outcome === 'failed') flash("Couldn't save — try again?", 4000);
    }
    busy.current = false;
    refresh();
    return outcome;
  }, [refresh, flash]);

  const sync = useCallback(async (): Promise<SaveResult> => {
    if (busy.current) return 'cancelled';
    busy.current = true;
    setTransfer({ mode: 'sync', done: false, message: '' });
    const ok = await syncNow({ interactive: true });
    busy.current = false;
    if (ok) {
      setTransfer({ mode: 'sync', done: true, message: 'Synced ✓' });
      return 'synced';
    }
    setTransfer(null);
    const after = getSyncStatus();
    if (after.phase === 'error' || after.phase === 'offline') {
      flash(after.phase === 'offline' ? "Couldn't sync — you seem to be offline" : "Couldn't sync — try again?", 4000);
      return 'failed';
    }
    return 'cancelled';
  }, [flash]);

  const save = linked ? sync : saveToFile;

  const overlay = transfer ? (
    <TransferOverlay
      mode={transfer.mode}
      busyLabel={transfer.mode === 'sync' && cloud.providerLabel ? `Syncing with ${cloud.providerLabel}…` : undefined}
      done={transfer.done}
      onFinished={() => {
        const message = transfer.message;
        setTransfer(null);
        flash(message, 3500);
      }}
    />
  ) : null;

  // Cloud status drives re-renders, so isCloudDirty() is fresh here.
  const dirty = linked ? cloud.phase !== 'synced' && isCloudDirty() : fileDirty;

  return { profile, dirty, fsa, status, cloud, save, saveToFile, refresh, overlay };
}
