/**
 * Dropbox adapter. Save files live in the app's own folder (Apps › <app
 * name> in the user's Dropbox) — LaLista can't see anything outside it.
 *
 * Auth is the OAuth code flow with PKCE (no client secret) by full-page
 * redirect: sign-in leaves for dropbox.com and comes back to the Progress
 * page, which resumes whatever the user was doing. Dropbox issues a refresh
 * token, so later access tokens renew silently — no taps while studying.
 */
import { saveFileName } from '../../types/profile';
import { withBase } from '../paths';
import { CloudAuthError, CloudCancelledError, type CloudProvider, type ConnectIntent, type RedirectResult, type RemoteSave } from './types';

const APP_KEY: string | undefined = import.meta.env.PUBLIC_DROPBOX_APP_KEY || undefined;
const TOKEN_KEY = 'lalista:dropbox-token';
const PENDING_KEY = 'lalista:dropbox-pending';
const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const RPC = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';
const EXPIRY_MARGIN_MS = 60_000;
/** A sign-in round trip older than this is treated as abandoned. */
const PENDING_TTL_MS = 30 * 60_000;

/** Must match a Redirect URI registered in the Dropbox App Console exactly. */
const redirectUri = () => `${location.origin}${withBase('/progress/')}`;

// ---- Token storage ----

interface StoredToken {
  access: string;
  expiresAt: number;
  refresh: string;
  account: string | null;
}

interface PendingSignIn {
  verifier: string;
  state: string;
  intent: ConnectIntent;
  returnTo: string | null;
  createdAt: number;
}

function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

const readToken = () => readJson<StoredToken>(TOKEN_KEY);
const writeToken = (t: StoredToken) => localStorage.setItem(TOKEN_KEY, JSON.stringify(t));

// ---- PKCE ----

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const randomString = (byteCount: number) => base64url(crypto.getRandomValues(new Uint8Array(byteCount)));

async function codeChallenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
}

// ---- HTTP ----

class DropboxApiError extends Error {
  constructor(readonly summary: string) {
    super(`Dropbox error: ${summary}`);
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  error_description?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (res.ok && data.access_token) return data;
  if (params.grant_type === 'refresh_token' && res.status >= 400 && res.status < 500) throw new CloudAuthError(); // revoked
  throw new Error(`Dropbox sign-in failed${data.error_description ? `: ${data.error_description}` : ''}.`);
}

let refreshing: Promise<string> | null = null;

/** A valid access token, renewed silently from the refresh token when needed. */
async function accessToken(): Promise<string> {
  const stored = readToken();
  if (!stored) throw new CloudAuthError();
  if (stored.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return stored.access;
  refreshing ??= (async () => {
    try {
      const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: stored.refresh, client_id: APP_KEY! });
      writeToken({ ...stored, access: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 });
      return r.access_token;
    } catch (e) {
      if (e instanceof CloudAuthError) localStorage.removeItem(TOKEN_KEY);
      throw e;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function authed(url: string, init: RequestInit, retried = false): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await accessToken()}` } });
  if (res.status === 401) {
    const stored = readToken();
    if (!retried && stored) {
      writeToken({ ...stored, expiresAt: 0 }); // force a refresh, then try once more
      return authed(url, init, true);
    }
    localStorage.removeItem(TOKEN_KEY);
    throw new CloudAuthError();
  }
  if (res.status === 409) {
    const err = (await res.json().catch(() => ({}))) as { error_summary?: string };
    throw new DropboxApiError(err.error_summary ?? 'unknown');
  }
  if (!res.ok) throw new Error(`Dropbox error ${res.status}`);
  return res;
}

async function rpc<T>(endpoint: string, arg?: unknown): Promise<T> {
  const init: RequestInit =
    arg === undefined ? { method: 'POST' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(arg) };
  return (await (await authed(`${RPC}/${endpoint}`, init)).json()) as T;
}

/** Dropbox-API-Arg travels in an HTTP header, which must be ASCII. */
const headerJson = (arg: unknown) =>
  JSON.stringify(arg).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

interface FileMetadata {
  '.tag': 'file' | 'folder' | 'deleted';
  id: string;
  name: string;
  path_lower: string;
  server_modified: string;
  content_hash: string;
}

async function metadata(id: string): Promise<FileMetadata | null> {
  try {
    const meta = await rpc<FileMetadata>('files/get_metadata', { path: id });
    return meta['.tag'] === 'file' ? meta : null;
  } catch (e) {
    if (e instanceof DropboxApiError && e.summary.startsWith('path/not_found')) return null;
    throw e;
  }
}

async function upload(path: string, mode: 'add' | 'overwrite', text: string): Promise<FileMetadata> {
  const res = await authed(`${CONTENT}/files/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': headerJson({ path, mode, autorename: mode === 'add', mute: true }),
    },
    body: text,
  });
  return (await res.json()) as FileMetadata;
}

async function accountEmail(): Promise<string | null> {
  try {
    return (await rpc<{ email?: string }>('users/get_current_account')).email ?? null;
  } catch {
    return null; // cosmetic only
  }
}

const isSaveFile = (m: FileMetadata) => m['.tag'] === 'file' && /^lalista-progress-.*\.json$/.test(m.name);

export const dropbox: CloudProvider = {
  id: 'dropbox',
  label: 'Dropbox',
  location: 'the LaLista folder in your Dropbox (under Apps)',

  hasToken: () => readToken() !== null,

  preload() {},

  async connect(_accountHint, intent = 'start') {
    // Already signed in on this device — no need to leave the page.
    const stored = readToken();
    if (stored && intent !== 'reconnect') return stored.account;

    const verifier = randomString(48);
    const state = randomString(16);
    const pending: PendingSignIn = { verifier, state, intent, returnTo: intent === 'reconnect' ? location.href : null, createdAt: Date.now() };
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    const params = new URLSearchParams({
      client_id: APP_KEY!,
      response_type: 'code',
      code_challenge: await codeChallenge(verifier),
      code_challenge_method: 'S256',
      token_access_type: 'offline',
      redirect_uri: redirectUri(),
      state,
    });
    location.assign(`${AUTHORIZE_URL}?${params}`);
    return new Promise<never>(() => {}); // the page is navigating away
  },

  async completeRedirect(): Promise<RedirectResult | null> {
    const url = new URL(location.href);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (!state || (!code && !error)) return null;
    const pending = readJson<PendingSignIn>(PENDING_KEY);
    if (!pending || pending.state !== state) return null; // not our round trip

    localStorage.removeItem(PENDING_KEY);
    for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);

    if (error) throw new CloudCancelledError(error === 'access_denied' ? 'Cancelled' : `Dropbox sign-in failed (${error}).`);
    if (Date.now() - pending.createdAt > PENDING_TTL_MS) throw new Error('That Dropbox sign-in took too long. Please try again.');

    const r = await tokenRequest({
      code: code!,
      grant_type: 'authorization_code',
      code_verifier: pending.verifier,
      client_id: APP_KEY!,
      redirect_uri: redirectUri(),
    });
    if (!r.refresh_token) throw new Error('Dropbox did not grant lasting access. Please try again.');
    writeToken({ access: r.access_token, expiresAt: Date.now() + r.expires_in * 1000, refresh: r.refresh_token, account: null });
    const account = await accountEmail();
    const stored = readToken();
    if (stored) writeToken({ ...stored, account });
    return { account, intent: pending.intent, returnTo: pending.returnTo };
  },

  forget() {
    // Forget locally right away (callers may navigate next), then ask Dropbox
    // to revoke the access — which also disables its refresh token.
    const stored = readToken();
    localStorage.removeItem(TOKEN_KEY);
    if (stored && stored.expiresAt > Date.now()) {
      void fetch(`${RPC}/auth/token/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${stored.access}` }, keepalive: true }).catch(() => {});
    }
  },

  async list(): Promise<RemoteSave[]> {
    let page = await rpc<{ entries: FileMetadata[]; has_more: boolean; cursor: string }>('files/list_folder', { path: '' });
    const entries = [...page.entries];
    while (page.has_more) {
      page = await rpc('files/list_folder/continue', { cursor: page.cursor });
      entries.push(...page.entries);
    }
    return entries.filter(isSaveFile).map((m) => ({
      id: m.id,
      // Dropbox has no custom file properties; the file name carries the profile.
      profileName: m.name.replace(/^lalista-progress-|\.json$/g, ''),
      modifiedAt: m.server_modified,
    }));
  },

  async stat(id) {
    const meta = await metadata(id);
    return meta ? { version: meta.content_hash } : null;
  },

  async read(id) {
    const meta = await metadata(id);
    if (!meta) throw new Error('That save file is no longer in your Dropbox');
    const res = await authed(`${CONTENT}/files/download`, { method: 'POST', headers: { 'Dropbox-API-Arg': headerJson({ path: id }) } });
    return { text: await res.text(), version: meta.content_hash };
  },

  async create(profileName, text) {
    const meta = await upload(`/${saveFileName(profileName)}`, 'add', text);
    return { id: meta.id, version: meta.content_hash };
  },

  async update(id, text) {
    const meta = await metadata(id);
    if (!meta) throw new Error('That save file is no longer in your Dropbox');
    return { version: (await upload(meta.path_lower, 'overwrite', text)).content_hash };
  },
};

export const dropboxConfigured = Boolean(APP_KEY);
