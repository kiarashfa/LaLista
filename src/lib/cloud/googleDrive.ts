/**
 * Google Drive adapter. Save files live in the Drive "app data" folder — a
 * hidden, per-app space: LaLista can only see its own files there, never the
 * rest of the user's Drive, and the user can remove it from Drive settings →
 * Manage apps.
 *
 * Auth uses Google Identity Services' token model (browser-only, no client
 * secret). Tokens last about an hour and can only be renewed from a user
 * gesture, so the sync engine asks for a tap when one expires.
 */
import { saveFileName } from '../../types/profile';
import { CloudAuthError, CloudCancelledError, type CloudProvider, type RemoteSave } from './types';

const CLIENT_ID: string | undefined = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID || undefined;
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const TOKEN_KEY = 'lalista:gdrive-token';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
/** Treat a token as expired a little early so a request never races its expiry. */
const EXPIRY_MARGIN_MS = 60_000;
/**
 * The version tag is the content checksum: Drive's own `version` counter
 * keeps climbing for a moment after each upload, which would make every
 * push look like a change from another device.
 */
const VERSION_FIELDS = 'md5Checksum,headRevisionId';
interface VersionMeta {
  md5Checksum?: string;
  headRevisionId?: string;
}
const versionOf = (meta: VersionMeta) => meta.md5Checksum ?? meta.headRevisionId ?? '';

// ---- Minimal Google Identity Services typings ----

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}
interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

// ---- Script loading ----

let gisLoading: Promise<GoogleOAuth2> | null = null;

function loadGis(): Promise<GoogleOAuth2> {
  const ready = window.google?.accounts?.oauth2;
  if (ready) return Promise.resolve(ready);
  gisLoading ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error('Google sign-in failed to initialise'));
    };
    script.onerror = () => {
      gisLoading = null;
      reject(new Error("Couldn't reach Google sign-in — check your connection"));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

// ---- Token ----

interface StoredToken {
  token: string;
  expiresAt: number;
}

function readToken(): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as StoredToken | null;
    if (stored && stored.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return stored.token;
  } catch {
    /* fall through */
  }
  return null;
}

function forgetToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

let tokenClient: TokenClient | null = null;
let pending: { resolve: () => void; reject: (e: Error) => void } | null = null;

function getTokenClient(oauth2: GoogleOAuth2): TokenClient {
  tokenClient ??= oauth2.initTokenClient({
    client_id: CLIENT_ID!,
    scope: SCOPE,
    callback: (response) => {
      const settle = pending;
      pending = null;
      if (!settle) return;
      if (response.error || !response.access_token) {
        settle.reject(response.error === 'access_denied' ? new CloudCancelledError() : new Error(response.error_description ?? 'Google sign-in failed'));
        return;
      }
      if (!oauth2.hasGrantedAllScopes(response, SCOPE)) {
        settle.reject(new CloudCancelledError('LaLista needs permission to keep its save file in your Drive — please tick that box.'));
        return;
      }
      const stored: StoredToken = { token: response.access_token, expiresAt: Date.now() + Number(response.expires_in ?? 3600) * 1000 };
      localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
      settle.resolve();
    },
    error_callback: (error) => {
      const settle = pending;
      pending = null;
      if (!settle) return;
      if (error.type === 'popup_failed_to_open') settle.reject(new Error('Your browser blocked the Google sign-in window — allow pop-ups for this site and try again.'));
      else settle.reject(new CloudCancelledError());
    },
  });
  return tokenClient;
}

// ---- REST ----

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  const token = readToken();
  if (!token) throw new CloudAuthError();
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    forgetToken();
    throw new CloudAuthError();
  }
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`);
  return res;
}

async function accountEmail(): Promise<string | null> {
  try {
    const res = await api(`${API}/about?fields=user(emailAddress)`);
    const data = (await res.json()) as { user?: { emailAddress?: string } };
    return data.user?.emailAddress ?? null;
  } catch {
    return null; // cosmetic only
  }
}

function multipart(metadata: object, text: string): { body: string; contentType: string } {
  const boundary = `lalista-${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

export const googleDrive: CloudProvider = {
  id: 'gdrive',
  label: 'Google Drive',
  location: 'a private LaLista folder in your Google Drive',

  hasToken: () => readToken() !== null,

  preload() {
    void loadGis().catch(() => {
      /* surfaced on connect */
    });
  },

  async connect(accountHint) {
    const oauth2 = await loadGis();
    await new Promise<void>((resolve, reject) => {
      pending?.reject(new CloudCancelledError());
      pending = { resolve, reject };
      getTokenClient(oauth2).requestAccessToken({ prompt: '', ...(accountHint ? { login_hint: accountHint } : {}) });
    });
    return accountEmail();
  },

  forget: forgetToken,

  async list(): Promise<RemoteSave[]> {
    const q = encodeURIComponent("name contains 'lalista-progress' and trashed = false");
    const res = await api(`${API}/files?spaces=appDataFolder&pageSize=100&q=${q}&fields=files(id,name,modifiedTime,appProperties)`);
    const data = (await res.json()) as { files?: { id: string; name: string; modifiedTime: string; appProperties?: { profile?: string } }[] };
    return (data.files ?? []).map((f) => ({
      id: f.id,
      profileName: f.appProperties?.profile ?? f.name.replace(/^lalista-progress-|\.json$/g, ''),
      modifiedAt: f.modifiedTime,
    }));
  },

  async stat(id) {
    try {
      const res = await api(`${API}/files/${encodeURIComponent(id)}?fields=${VERSION_FIELDS},trashed`);
      const data = (await res.json()) as VersionMeta & { trashed?: boolean };
      return data.trashed ? null : { version: versionOf(data) };
    } catch (e) {
      if (e instanceof Error && e.message.endsWith(' 404')) return null;
      throw e;
    }
  },

  async read(id) {
    const meta = await googleDrive.stat(id);
    if (!meta) throw new Error('That save file is no longer in your Drive');
    const res = await api(`${API}/files/${encodeURIComponent(id)}?alt=media`);
    return { text: await res.text(), version: meta.version };
  },

  async create(profileName, text) {
    const { body, contentType } = multipart(
      { name: saveFileName(profileName), parents: ['appDataFolder'], mimeType: 'application/json', appProperties: { profile: profileName } },
      text,
    );
    const res = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,${VERSION_FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });
    const data = (await res.json()) as VersionMeta & { id: string };
    return { id: data.id, version: versionOf(data) };
  },

  async update(id, text) {
    const res = await api(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&fields=${VERSION_FIELDS}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: text,
    });
    return { version: versionOf((await res.json()) as VersionMeta) };
  },
};

export const googleDriveConfigured = Boolean(CLIENT_ID);
