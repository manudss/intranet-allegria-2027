/** IndexedDB: snapshot AES-GCM, session metadata/key and pending scan queue.
 * Queue entries contain opaque badge codes, not names. Expiry never deletes
 * unacknowledged events. All writes resolve on transaction commit, not request success.
 */
import { decryptJson, deriveTableKey, encryptJson } from './scan-crypto';
import type { PendingScan } from './scan.models';
export const SCAN_DB_NAME = 'alegria-scan';

export function openScanDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SCAN_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('kv');
      db.createObjectStore('table');
      db.createObjectStore('scans', { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function read<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}
function write(db: IDBDatabase, stores: string[], run: (t: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite');
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Transaction annulée'));
    run(t);
  });
}
export interface StoredScanRow { id: IDBValidKey; scan: PendingScan }
export const scanDb = {
  getKv: <T>(db: IDBDatabase, key: string) => read<T>(db, 'kv', key),
  getTable: (db: IDBDatabase) => read<ArrayBuffer>(db, 'table', 'current'),
  /** Atomically replaces snapshot, key and metadata; optionally queues a scan. */
  save: async (db: IDBDatabase, meta: unknown, sessionKey: string, blob: ArrayBuffer, scan?: PendingScan) => {
    const encryptedScan = scan ? await encryptJson(await deriveTableKey(sessionKey), scan) : undefined;
    return write(db, ['kv', 'table', 'scans'], (t) => {
      t.objectStore('kv').put(meta, 'meta');
      t.objectStore('kv').put(sessionKey, 'sessionKey');
      t.objectStore('table').put(blob, 'current');
      if (encryptedScan) t.objectStore('scans').add(encryptedScan);
    });
  },
  addScan: async (db: IDBDatabase, scan: PendingScan) => {
    const secret = await read<string>(db, 'kv', 'sessionKey');
    if (!secret) throw new Error('Clé de session indisponible');
    const blob = await encryptJson(await deriveTableKey(secret), scan);
    return write(db, ['scans'], (t) => { t.objectStore('scans').add(blob); });
  },
  removeScans: (db: IDBDatabase, ids: IDBValidKey[]) => write(db, ['scans'], (t) => {
    for (const id of ids) t.objectStore('scans').delete(id);
  }),
  clearTable: (db: IDBDatabase) => write(db, ['table'], (t) => { t.objectStore('table').clear(); }),
  clearAll: (db: IDBDatabase) => write(db, ['kv', 'table', 'scans'], (t) => {
    for (const store of ['kv', 'table', 'scans']) t.objectStore(store).clear();
  }),
};
export async function listScans(db: IDBDatabase): Promise<StoredScanRow[]> {
  const secret = await read<string>(db, 'kv', 'sessionKey');
  const key = secret ? await deriveTableKey(secret) : null;
  const rows = await readStoredScans(db);
  return Promise.all(rows.map(async ({ id, payload }) => ({ id, scan: !('code' in payload) ? (key ? await decryptJson<PendingScan>(key, payload) : await Promise.reject(new Error('Clé de file indisponible'))) : payload })));
}
function readStoredScans(db: IDBDatabase): Promise<{ id: IDBValidKey; payload: ArrayBuffer | PendingScan }[]> {
  return new Promise((resolve, reject) => {
    const rows: { id: IDBValidKey; payload: ArrayBuffer | PendingScan }[] = [];
    const req = db.transaction('scans').objectStore('scans').openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(rows); return; }
      rows.push({ id: cursor.primaryKey, payload: cursor.value as ArrayBuffer | PendingScan });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
