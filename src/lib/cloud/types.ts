/**
 * A cloud provider stores save files (same JSON format as the local file)
 * in the user's own cloud storage, straight from the browser — LaLista has
 * no server in between. Each provider is a thin adapter; the sync engine
 * (sync.ts) owns all merge/conflict logic.
 */

export type ProviderId = 'gdrive' | 'mock';

/** A save file found in the user's cloud. */
export interface RemoteSave {
  id: string;
  profileName: string;
  /** ISO timestamp of the last write. */
  modifiedAt: string;
}

export interface CloudProvider {
  id: ProviderId;
  /** Human name, e.g. "Google Drive". */
  label: string;
  /** Short phrase for where files live, used in UI copy. */
  location: string;
  /** True while a usable access token is cached — no UI needed to call the API. */
  hasToken(): boolean;
  /** Warm up any sign-in script so connect() can open its popup inside the user's tap. */
  preload(): void;
  /**
   * Interactive sign-in / consent. MUST be called from a user gesture
   * (browsers block popups otherwise). Resolves with the account label
   * (e.g. an email) when known.
   */
  connect(accountHint?: string | null): Promise<string | null>;
  /** Drop the cached token on this device. */
  forget(): void;
  list(): Promise<RemoteSave[]>;
  /** Current version tag, or null when the file no longer exists. */
  stat(id: string): Promise<{ version: string } | null>;
  read(id: string): Promise<{ text: string; version: string }>;
  create(profileName: string, text: string): Promise<{ id: string; version: string }>;
  update(id: string, text: string): Promise<{ version: string }>;
}

/** The token expired or was revoked — the user must tap to reconnect. */
export class CloudAuthError extends Error {
  constructor(message = 'Sign-in expired') {
    super(message);
    this.name = 'CloudAuthError';
  }
}

/** The user closed the sign-in popup or declined. */
export class CloudCancelledError extends Error {
  constructor(message = 'Cancelled') {
    super(message);
    this.name = 'CloudCancelledError';
  }
}
