/**
 * Shared save action + dirty tracking for SaveButton / ProgressApp / SaveNudge.
 * Successful saves play the TransferOverlay animation —
 * consumers must render the returned `overlay` node.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { saveProgressFile, supportsFileSystemAccess, type SaveOutcome } from '../../lib/storage/fileAccess';
import { buildSaveFile } from '../../lib/storage/saveFile';
import { hasUnsavedChanges, loadSession, markSavedNow } from '../../lib/storage/session';
import { saveFileName, type ProfileInfo } from '../../types/profile';
import TransferOverlay from './TransferOverlay';

export interface SaveHook {
  profile: ProfileInfo | null;
  dirty: boolean;
  fsa: boolean;
  status: string | null;
  /** Persist to the user's file; resolves with what actually happened. */
  save: () => Promise<SaveOutcome>;
  refresh: () => void;
  /** Render this — it's the animated saving overlay (null when idle). */
  overlay: ReactNode;
}

export function useSave(): SaveHook {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fsa, setFsa] = useState(false);
  const [transfer, setTransfer] = useState<null | { done: boolean; message: string }>(null);

  const refresh = useCallback(() => {
    setProfile(loadSession().profile);
    setDirty(hasUnsavedChanges());
  }, []);

  useEffect(() => {
    refresh();
    setFsa(supportsFileSystemAccess());
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, [refresh]);

  const saving = useRef(false);
  const save = useCallback(async (): Promise<SaveOutcome> => {
    if (saving.current) return 'cancelled'; // one save at a time — a picker may be open
    const state = loadSession();
    if (!state.profile) return 'cancelled';
    saving.current = true;
    setTransfer({ done: false, message: '' });
    const outcome = await saveProgressFile(
      JSON.stringify(buildSaveFile(state), null, 2),
      saveFileName(state.profile.name),
    );
    if (outcome === 'saved-in-place' || outcome === 'saved-as' || outcome === 'downloaded') {
      markSavedNow();
      setTransfer({
        done: true,
        message: outcome === 'downloaded' ? 'Downloaded a fresh copy ✓' : 'Saved to your file ✓',
      });
    } else {
      setTransfer(null);
      if (outcome === 'failed') {
        setStatus("Couldn't save — try again?");
        setTimeout(() => setStatus(null), 4000);
      }
    }
    saving.current = false;
    refresh();
    return outcome;
  }, [refresh]);

  const overlay = transfer ? (
    <TransferOverlay
      mode="save"
      done={transfer.done}
      onFinished={() => {
        const message = transfer.message;
        setTransfer(null);
        setStatus(message);
        setTimeout(() => setStatus(null), 3500);
      }}
    />
  ) : null;

  return { profile, dirty, fsa, status, save, refresh, overlay };
}
