/**
 * A cloud provider stores save files (same JSON format as the local file)
 * in the user's own cloud storage, straight from the browser — LaLista has
 * no server in between. Each provider is a thin adapter; the sync engine
 * (sync.ts) owns all merge/conflict logic.
 */

export type ProviderId = 'gdrive' | 'dropbox' | 'mock';

/**
 * Why a sign-in was started. Redirect-style providers leave the page to sign
 * in, so the intent travels with them and is resumed when the user returns.
 */
export type ConnectIntent = 'start' | 'link' | 'reconnect';

/** A redirect sign-in that just completed on this page load. */
export interface RedirectResult {
  account: string | null;
  intent: ConnectIntent;
  /** Page to go back to after a reconnect (null = stay). */
  returnTo: string | null;
}

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
  /** True while the API can be called without any UI (a cached or silently renewable token). */
  hasToken(): boolean;
  /** Warm up any sign-in script so connect() can open its popup inside the user's tap. */
  preload(): void;
  /**
   * Interactive sign-in / consent. MUST be called from a user gesture
   * (browsers block popups otherwise). Resolves with the account label
   * (e.g. an email) when known. Redirect-style providers navigate away
   * instead and never resolve; see completeRedirect().
   */
  connect(accountHint?: string | null, intent?: ConnectIntent): Promise<string | null>;
  /** Redirect-style providers: finish a sign-in whose result is in this page's URL (null = none). */
  completeRedirect?(): Promise<RedirectResult | null>;
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
