/**
 * Persistance IndexedDB du mode scan :
 *  - store "kv"     : clé de chiffrement (raw), métadonnées (point, expiration…)
 *  - store "table"  : table chiffrée (un blob AES-GCM)
 *  - store "scans"  : scans en attente d'envoi (index localSeq)
 * Effacée intégralement après téléversement confirmé ou à l'expiration.
 */

export const SCAN_DB_NAME = 'alegria-scan';
const SCAN_DB_VERSION = 1;

export interface ScanSessionMeta {
  pointId: string;
  scanTypeCode: string;
  generatedAt: string;
  expiresAt: string;
  downloadedAt: string;
}

export function openScanDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SCAN_DB_NAME, SCAN_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('table')) db.createObjectStore('table');
      if (!db.objectStoreNames.contains('scans')) db.createObjectStore('scans', { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const scanDb = {
  setKv: (db: IDBDatabase, key: string, value: unknown) => tx(db, 'kv', 'readwrite', (s) => s.put(value, key)),
  getKv: <T>(db: IDBDatabase, key: string) => tx<T | undefined>(db, 'kv', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
  setTable: (db: IDBDatabase, blob: ArrayBuffer) => tx(db, 'table', 'readwrite', (s) => s.put(blob, 'current')),
  getTable: (db: IDBDatabase) => tx<ArrayBuffer | undefined>(db, 'table', 'readonly', (s) => s.get('current') as IDBRequest<ArrayBuffer | undefined>),
  addScan: (db: IDBDatabase, scan: unknown) => tx<number>(db, 'scans', 'readwrite', (s) => s.add(scan) as IDBRequest<number>),
  clearScans: (db: IDBDatabase) => tx(db, 'scans', 'readwrite', (s) => s.clear()),
  clearAll: async (db: IDBDatabase) => {
    await tx(db, 'kv', 'readwrite', (s) => s.clear());
    await tx(db, 'table', 'readwrite', (s) => s.clear());
    await tx(db, 'scans', 'readwrite', (s) => s.clear());
  },
};

export interface StoredScanRow extends Record<string, unknown> {
  id?: number;
}

export function listScans(db: IDBDatabase): Promise<StoredScanRow[]> {
  return new Promise((resolve, reject) => {
    const t = db.transaction('scans', 'readonly');
    const req = t.objectStore('scans').getAll();
    req.onsuccess = () => resolve(req.result as StoredScanRow[]);
    req.onerror = () => reject(req.error);
  });
}
