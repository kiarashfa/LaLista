/**
 * Development-only stand-in cloud, backed by localStorage, for exercising
 * the sync engine and UI without real credentials. Enable in `astro dev`
 * with localStorage['lalista-dev:mock-cloud'] = '1'. Never bundled in
 * production builds (see providers.ts).
 *
 * Simulate "another device" by editing a file under lalista-dev:mock-files
 * (bump its version); simulate token expiry with
 * localStorage['lalista-dev:mock-token'] = '0'. Set
 * localStorage['lalista-dev:mock-redirect'] = '1' to sign in by page
 * redirect (like Dropbox) instead of in place (like Google).
 */
import { withBase } from '../paths';
import { CloudAuthError, type CloudProvider, type ConnectIntent, type RedirectResult } from './types';

const FILES_KEY = 'lalista-dev:mock-files';
const PENDING_KEY = 'lalista-dev:mock-pending';
const TOKEN_KEY = 'lalista-dev:mock-token';
const LATENCY_MS = 400;

interface MockFile {
  profileName: string;
  text: string;
  version: number;
  modifiedAt: string;
}

const files = (): Record<string, MockFile> => JSON.parse(localStorage.getItem(FILES_KEY) ?? '{}');
const writeFiles = (f: Record<string, MockFile>) => localStorage.setItem(FILES_KEY, JSON.stringify(f));
const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

async function authed(): Promise<void> {
  await delay();
  if (Number(localStorage.getItem(TOKEN_KEY) ?? 0) < Date.now()) throw new CloudAuthError();
}

export const mockEnabled = () => localStorage.getItem('lalista-dev:mock-cloud') === '1';

export const mockProvider: CloudProvider = {
  id: 'mock',
  label: 'Mock Cloud',
  location: 'the development mock cloud',
  hasToken: () => Number(localStorage.getItem(TOKEN_KEY) ?? 0) > Date.now(),
  preload() {},
  async connect(_hint, intent: ConnectIntent = 'start') {
    if (localStorage.getItem('lalista-dev:mock-redirect') === '1') {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ intent, returnTo: intent === 'reconnect' ? location.href : null }));
      location.assign(`${withBase('/progress/')}?code=mock&state=mock`);
      return new Promise<never>(() => {});
    }
    await delay();
    localStorage.setItem(TOKEN_KEY, String(Date.now() + 3600_000));
    return 'dev@example.com';
  },
  async completeRedirect(): Promise<RedirectResult | null> {
    const url = new URL(location.href);
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as { intent: ConnectIntent; returnTo: string | null } | null;
    if (url.searchParams.get('state') !== 'mock' || !pending) return null;
    localStorage.removeItem(PENDING_KEY);
    history.replaceState(history.state, '', url.pathname);
    await delay();
    localStorage.setItem(TOKEN_KEY, String(Date.now() + 3600_000));
    return { account: 'dev@example.com', intent: pending.intent, returnTo: pending.returnTo };
  },
  forget: () => localStorage.removeItem(TOKEN_KEY),
  async list() {
    await authed();
    return Object.entries(files()).map(([id, f]) => ({ id, profileName: f.profileName, modifiedAt: f.modifiedAt }));
  },
  async stat(id) {
    await authed();
    const f = files()[id];
    return f ? { version: String(f.version) } : null;
  },
  async read(id) {
    await authed();
    const f = files()[id];
    if (!f) throw new Error('missing');
    return { text: f.text, version: String(f.version) };
  },
  async create(profileName, text) {
    await authed();
    const all = files();
    const id = `mock-${Date.now()}`;
    all[id] = { profileName, text, version: 1, modifiedAt: new Date().toISOString() };
    writeFiles(all);
    return { id, version: '1' };
  },
  async update(id, text) {
    await authed();
    const all = files();
    const f = all[id];
    if (!f) throw new Error('missing');
    all[id] = { ...f, text, version: f.version + 1, modifiedAt: new Date().toISOString() };
    writeFiles(all);
    return { version: String(f.version + 1) };
  },
};
