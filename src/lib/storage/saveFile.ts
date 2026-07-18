/**
 * Building, validating and applying save files (SPEC §5). Validation is
 * deliberately specific: a corrupted file, a random JSON, and a
 * newer-version save each get their own explicit error — never a silent
 * misread or crash.
 */
import type { SessionState } from '../../types/progress';
import {
  SAVE_FILE_FORMAT,
  SAVE_FILE_VERSION,
  type ProfileInfo,
  type SaveFile,
  type SaveFileError,
} from '../../types/profile';

export function buildSaveFile(state: SessionState, now = Date.now()): SaveFile {
  if (!state.profile) throw new Error('Cannot build a save file without a profile');
  return {
    format: SAVE_FILE_FORMAT,
    schemaVersion: SAVE_FILE_VERSION,
    savedAt: new Date(now).toISOString(),
    profile: state.profile,
    grammar: state.grammar,
    vocabulary: state.vocabulary,
    testScores: state.testScores,
    streak: state.streak,
    notepad: state.notepad,
  };
}

export type ParseResult = { ok: true; file: SaveFile } | { ok: false; error: SaveFileError };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseSaveFile(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'unreadable' };
  }
  if (!isRecord(data) || data.format !== SAVE_FILE_FORMAT) return { ok: false, error: 'not-lalista' };
  if (typeof data.schemaVersion !== 'number') return { ok: false, error: 'corrupt' };
  if (data.schemaVersion > SAVE_FILE_VERSION) return { ok: false, error: 'version-newer' };
  // When SAVE_FILE_VERSION grows past 1, older versions get migrated here.

  const profile = data.profile;
  if (
    !isRecord(profile) ||
    typeof profile.name !== 'string' ||
    !profile.name.trim() ||
    !isRecord(profile.avatar) ||
    !['emoji', 'photo'].includes(profile.avatar.kind as string)
  ) {
    return { ok: false, error: 'corrupt' };
  }
  if (!isRecord(data.grammar) || !isRecord(data.vocabulary) || !isRecord(data.testScores) || !isRecord(data.streak)) {
    return { ok: false, error: 'corrupt' };
  }
  return { ok: true, file: data as unknown as SaveFile };
}

/** Session state populated from a loaded file (SPEC §5 step 2). */
export function sessionFromSaveFile(file: SaveFile): SessionState {
  return {
    schemaVersion: 1,
    profile: file.profile as ProfileInfo,
    grammar: file.grammar,
    vocabulary: file.vocabulary,
    testScores: file.testScores,
    streak: file.streak,
    notepad: typeof file.notepad === 'string' ? file.notepad : '',
  };
}

export const SAVE_ERROR_MESSAGES: Record<SaveFileError, string> = {
  unreadable: "That file isn't readable as JSON — it may be damaged, or it might not be a LaLista file at all.",
  'not-lalista': "That's a JSON file, but not a LaLista progress file. Look for a file named like lalista-progress-‹name›.json.",
  'version-newer':
    'This file was saved by a newer version of LaLista than this site is running. Refresh the page (or come back later) and try again — loading it here could lose data.',
  corrupt: 'That looks like a LaLista file, but its contents are damaged or incomplete. If you have a backup copy, try that one.',
};
