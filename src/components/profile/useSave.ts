/** Shared save action + dirty tracking for SaveButton / ProgressApp / SaveNudge. */
import { useCallback, useEffect, useState } from 'react';
import { saveProgressFile, supportsFileSystemAccess } from '../../lib/storage/fileAccess';
import { buildSaveFile } from '../../lib/storage/saveFile';
import { hasUnsavedChanges, loadSession, markSavedNow } from '../../lib/storage/session';
import { saveFileName, type ProfileInfo } from '../../types/profile';

export interface SaveHook {
  profile: ProfileInfo | null;
  dirty: boolean;
  fsa: boolean;
  status: string | null;
  save: () => Promise<void>;
  refresh: () => void;
}

export function useSave(): SaveHook {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [fsa, setFsa] = useState(false);

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

  const save = useCallback(async () => {
    const state = loadSession();
    if (!state.profile) return;
    setStatus('Saving…');
    const outcome = await saveProgressFile(
      JSON.stringify(buildSaveFile(state), null, 2),
      saveFileName(state.profile.name),
    );
    if (outcome === 'saved-in-place' || outcome === 'saved-as') {
      markSavedNow();
      setStatus('Saved to your file ✓');
    } else if (outcome === 'downloaded') {
      markSavedNow();
      setStatus('Downloaded a fresh copy ✓');
    } else if (outcome === 'cancelled') {
      setStatus(null);
    } else {
      setStatus("Couldn't save — try again?");
    }
    refresh();
    setTimeout(() => setStatus(null), 4000);
  }, [refresh]);

  return { profile, dirty, fsa, status, save, refresh };
}
