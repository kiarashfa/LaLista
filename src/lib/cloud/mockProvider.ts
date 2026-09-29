/**
 * Development-only stand-in cloud, backed by localStorage, for exercising
 * the sync engine and UI without real credentials. Enable in `astro dev`
 * with localStorage['lalista-dev:mock-cloud'] = '1'. Never bundled in
 * production builds (see providers.ts).
 *
 * Simulate "another device" by editing a file under lalista-dev:mock-files
 * (bump its version); simulate token expiry with
 * localStorage['lalista-dev:mock-token'] = '0'.
 */
import { CloudAuthError, type CloudProvider } from './types';

const FILES_KEY = 'lalista-dev:mock-files';
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
  async connect() {
    await delay();
    localStorage.setItem(TOKEN_KEY, String(Date.now() + 3600_000));
    return 'dev@example.com';
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
