/**
 * File System Access API with classic-download fallback.
 * Where FSA is supported, the file handle is kept in IndexedDB so "Save"
 * writes in place from any page — no Downloads-folder clutter. Elsewhere,
 * saving downloads a fresh copy (explained in UI copy).
 */

const DB_NAME = 'lalista-fs';
const STORE = 'handles';
const HANDLE_KEY = 'progress-file';

// Minimal typings — TS lib support for FSA varies.
type FileHandle = FileSystemFileHandle & {
  queryPermission?: (opts: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: string }) => Promise<PermissionState>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
};

declare global {
  interface Window {
    showOpenFilePicker?: (opts?: unknown) => Promise<FileHandle[]>;
    showSaveFilePicker?: (opts?: unknown) => Promise<FileHandle>;
  }
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

// ---- IndexedDB handle persistence ----

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function storedHandle(): Promise<FileHandle | null> {
  try {
    return (await idb<FileHandle | undefined>('readonly', (s) => s.get(HANDLE_KEY))) ?? null;
  } catch {
    return null;
  }
}

async function storeHandle(handle: FileHandle | null): Promise<void> {
  try {
    await idb('readwrite', (s) => (handle ? s.put(handle, HANDLE_KEY) : s.delete(HANDLE_KEY)));
  } catch {
    /* non-fatal — saving still works via picker */
  }
}

export async function forgetHandle(): Promise<void> {
  await storeHandle(null);
}

async function ensurePermission(handle: FileHandle): Promise<boolean> {
  const query = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
  if (query === 'granted') return true;
  return (await handle.requestPermission?.({ mode: 'readwrite' })) === 'granted';
}

// ---- Load ----

export interface LoadedFile {
  text: string;
  fileName: string;
  /** Present only on the FSA path — enables save-in-place. */
  handle: FileHandle | null;
}

/** FSA open picker. Returns null if the user cancelled. */
export async function openWithPicker(): Promise<LoadedFile | null> {
  try {
    const [handle] = await window.showOpenFilePicker!({
      types: [{ description: 'LaLista progress', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    const file = await handle.getFile();
    await storeHandle(handle);
    return { text: await file.text(), fileName: file.name, handle };
  } catch {
    return null; // cancelled or blocked
  }
}

/** Fallback: read a File object from an <input type=file>. */
export async function readInputFile(file: File): Promise<LoadedFile> {
  return { text: await file.text(), fileName: file.name, handle: null };
}

// ---- Save ----

export type SaveOutcome = 'saved-in-place' | 'saved-as' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Save via the stored handle when possible; otherwise ask for a location
 * (FSA) or fall back to a classic download.
 */
export async function saveProgressFile(contents: string, suggestedName: string): Promise<SaveOutcome> {
  if (supportsFileSystemAccess()) {
    const existing = await storedHandle();
    if (existing && (await ensurePermission(existing))) {
      try {
        const w = await existing.createWritable();
        await w.write(contents);
        await w.close();
        return 'saved-in-place';
      } catch {
        /* stale handle (file moved/deleted) — fall through to picker */
      }
    }
    try {
      const handle = await window.showSaveFilePicker!({
        suggestedName,
        types: [{ description: 'LaLista progress', accept: { 'application/json': ['.json'] } }],
      });
      const w = await handle.createWritable();
      await w.write(contents);
      await w.close();
      await storeHandle(handle);
      return 'saved-as';
    } catch (e) {
      return (e as Error).name === 'AbortError' ? 'cancelled' : 'failed';
    }
  }
  // Classic download fallback
  try {
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
