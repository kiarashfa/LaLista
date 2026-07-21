/**
 * The on-disk save file — the SOURCE OF TRUTH for progress.
 * localStorage is only the working cache; this file is what the user keeps.
 * One profile = one file (`lalista-progress-<name>.json`).
 *
 * schemaVersion is versioned from day one so future format changes can be
 * detected explicitly (never silently misread) and migrated.
 */
import type { GrammarLessonProgress, TestScores, VocabWordProgress } from './progress';

export type Avatar = { kind: 'emoji'; value: string } | { kind: 'photo'; dataUrl: string };

export interface ProfileInfo {
  name: string;
  avatar: Avatar;
  /** ISO timestamp of profile creation. */
  createdAt: string;
}

export interface StreakState {
  current: number;
  longest: number;
  /** Local calendar date (YYYY-MM-DD) of the last qualifying activity. */
  lastActiveDate: string | null;
}

export const SAVE_FILE_FORMAT = 'lalista-progress';
export const SAVE_FILE_VERSION = 1;

export interface SaveFile {
  format: typeof SAVE_FILE_FORMAT;
  schemaVersion: number;
  savedAt: string;
  profile: ProfileInfo;
  grammar: Record<string, GrammarLessonProgress>;
  vocabulary: Record<string, VocabWordProgress>;
  testScores: TestScores;
  streak: StreakState;
  notepad: string;
}

export type SaveFileError =
  | 'unreadable' // not valid JSON at all
  | 'not-lalista' // JSON, but not one of our save files
  | 'version-newer' // written by a newer LaLista than this one
  | 'corrupt'; // right format marker but broken contents

export function saveFileName(profileName: string): string {
  const slug = profileName.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'profile';
  return `lalista-progress-${slug}.json`;
}
