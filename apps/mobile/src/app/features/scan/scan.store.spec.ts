import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { ScanApiService } from './scan-api.service';
import { ScanStore } from './scan.store';
import { listScans, openScanDb, scanDb } from './scan-db';
import { ScanPoint, ScanSessionStart } from './scan.models';

const point: ScanPoint = {
  id: 3,
  zoneId: 1,
  scanTypeId: 2,
  name: 'Repas',
  serviceKey: 'midi',
  active: true,
  scanType: {
    id: 2,
    code: 'REPAS',
    label: 'Repas',
    description: null,
    duplicateRule: 'UNIQUE_PER_SERVICE',
  },
};
const session = (): ScanSessionStart => ({
  sessionId: 7,
  zoneId: 1,
  startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 43_200_000).toISOString(),
  keyExpiresAt: new Date(Date.now() + 1_800_000).toISOString(),
  sessionKey: 'test-key-not-a-secret',
  snapshotVersion: 1,
  maxOfflineMinutes: 240,
  requiresOnlineValidation: false,
  snapshot: [
    {
      assignmentId: 10,
      code: 'aaa',
      firstName: 'Ada',
      lastName: 'Test',
      personType: 'JEUNE',
      version: 1,
    },
  ],
});
let owner = 1;
const api = {
  decide: vi.fn(),
  authorizeException: vi.fn(),
  startSession: vi.fn(),
  renewKey: vi.fn(),
  delta: vi.fn(),
  uploadScans: vi.fn(),
  closeSession: vi.fn(),
  lookupCode: vi.fn(),
};
let store: ScanStore;
beforeEach(async () => {
  owner = 1;
  vi.clearAllMocks();
  api.decide.mockReturnValue(throwError(() => new Error('offline')));
  api.authorizeException.mockReturnValue(throwError(() => new Error('offline')));
  api.startSession.mockImplementation(() => of(session()));
  api.delta.mockReturnValue(of({ version: 2, upserts: [], revokedAssignmentIds: [] }));
  api.closeSession.mockReturnValue(of({ closed: true }));
  api.uploadScans.mockImplementation((_id, scans) =>
    of(
      scans.map((s: { clientEventId: string }) => ({
        clientEventId: s.clientEventId,
        verdict: 'ACCEPTED',
      })),
    ),
  );
  const db = await openScanDb();
  await scanDb.clearAll(db);
  db.close();
  TestBed.configureTestingModule({
    providers: [
      ScanStore,
      { provide: ScanApiService, useValue: api },
      { provide: AuthService, useValue: { currentUser: () => ({ id: owner }) } },
    ],
  });
  store = TestBed.inject(ScanStore);
  await store.init();
});
afterEach(() => {
  store.ngOnDestroy();
  TestBed.resetTestingModule();
});

describe('ScanStore persisted workflow', () => {
  it('never returns green until the online decision is recorded, and retains timeout evidence', async () => {
    api.startSession.mockReturnValue(of({ ...session(), requiresOnlineValidation: true }));
    await store.startSession(point);
    api.decide.mockReturnValue(throwError(() => new Error('timeout')));
    expect((await store.recordScan('aaa')).kind).toBe('offline');
    expect(store.pendingCount()).toBe(1);
    api.decide.mockImplementation((_id, scan) =>
      of({
        clientEventId: scan.clientEventId,
        verdict: 'ACCEPTED',
        eventId: 99,
        needsReview: false,
      }),
    );
    expect((await store.recordScan('aaa')).kind).toBe('ok');
    expect(store.pendingCount()).toBe(1); // only its own ack removed
  });
  it('offers an exception only for a known outside-group refusal and waits for its server confirmation', async () => {
    api.startSession.mockReturnValue(of({ ...session(), requiresOnlineValidation: true }));
    await store.startSession(point);
    api.decide.mockImplementation((_id, scan) =>
      of({
        clientEventId: scan.clientEventId,
        verdict: 'REJECTED_NOT_EXPECTED',
        eventId: 7,
        needsReview: false,
        exceptionAllowed: true,
        passages: [{ id: 4, groupId: 2, groupName: 'Repas' }],
      }),
    );
    const refused = await store.recordScan('aaa');
    expect(refused).toMatchObject({
      kind: 'ko',
      title: 'Hors groupe',
      eventId: 7,
      exceptionAllowed: true,
    });
    api.authorizeException.mockReturnValue(throwError(() => new Error('timeout')));
    await expect(
      store.authorizeException(refused, 4, 'Accompagne équipe', 'operation-123'),
    ).rejects.toThrow();
    expect(store.lastVerdict()?.kind).toBe('ko');
    api.authorizeException.mockReturnValue(
      of({ verdict: 'ACCEPTED', eventId: 99, exceptionId: 5 }),
    );
    expect(
      await store.authorizeException(refused, 4, 'Accompagne équipe', 'operation-123'),
    ).toMatchObject({ kind: 'ok', exceptionConfirmed: true });
  });

  it('restores point and duplicate memory after restart', async () => {
    await store.startSession(point);
    expect((await store.recordScan('aaa')).kind).toBe('ok');
    await store.restore();
    expect(store.activePoint()?.id).toBe(3);
    expect((await store.recordScan('aaa')).kind).toBe('already');
  });
  it('retains all queued scans on upload failure and blocks replacement session', async () => {
    await store.startSession(point);
    await store.recordScan('aaa');
    api.uploadScans.mockReturnValue(throwError(() => new Error('offline')));
    expect(await store.exitSession()).toBe(false);
    expect(store.pendingCount()).toBe(1);
    await expect(store.startSession(point)).rejects.toThrow('Scans non envoyés');
    expect(store.pendingCount()).toBe(1);
  });
  it('uploads 501 scans in batches without deleting unsent rows', async () => {
    await store.startSession(point);
    const db = await openScanDb();
    for (let i = 0; i < 501; i++)
      await scanDb.addScan(db, { clientEventId: `event-${i}`, code: 'aaa', pointId: 3 });
    db.close();
    const result = await store.uploadPending();
    expect(result).toEqual({ sent: 501, failed: false });
    expect(api.uploadScans.mock.calls.map((c) => c[1].length)).toEqual([500, 1]);
    expect(store.pendingCount()).toBe(0);
  });
  it('only deletes acknowledged events on partial response', async () => {
    await store.startSession(point);
    await store.recordScan('aaa');
    await store.recordScan('aaa');
    api.uploadScans.mockImplementation((_id, scans) =>
      of([{ clientEventId: scans[0].clientEventId, verdict: 'ACCEPTED' }]),
    );
    expect(await store.uploadPending()).toEqual({ sent: 1, failed: true });
    expect(store.pendingCount()).toBe(1);
  });
  it('expiry deletes the nominative table but preserves pending events', async () => {
    await store.startSession(point);
    await store.recordScan('aaa');
    const db = await openScanDb();
    const meta = await scanDb.getKv<Record<string, unknown>>(db, 'meta');
    const blob = await scanDb.getTable(db);
    await scanDb.save(
      db,
      { ...meta, keyExpiresAt: '2000-01-01T00:00:00Z' },
      'test-key-not-a-secret',
      blob as ArrayBuffer,
    );
    await store.restore();
    expect(store.ready()).toBe(false);
    expect(store.expired()).toBe(true);
    expect((await listScans(db)).length).toBe(1);
    expect(await scanDb.getTable(db)).toBeUndefined();
    db.close();
  });
  it('revocations from delta remove old badge from the snapshot', async () => {
    await store.startSession(point);
    api.delta.mockReturnValue(of({ version: 2, upserts: [], revokedAssignmentIds: [10] }));
    await store.uploadPending();
    api.lookupCode.mockReturnValue(of({ verdict: 'REJECTED_REVOKED' }));
    expect((await store.recordScan('aaa')).kind).not.toBe('ok');
  });
  it('online-required zones never return OK when lookup fails', async () => {
    api.startSession.mockReturnValue(of({ ...session(), requiresOnlineValidation: true }));
    await store.startSession(point);
    api.lookupCode.mockReturnValue(throwError(() => new Error('offline')));
    expect((await store.recordScan('aaa')).kind).toBe('offline');
  });
  it('blocks another authenticated user from restoring the previous session', async () => {
    await store.startSession(point);
    owner = 2;
    await expect(store.restore()).rejects.toThrow('autre session');
  });
  it('stores pending scans as ciphertext and keeps them readable until acknowledgement', async () => {
    await store.startSession(point);
    await store.recordScan('aaa');
    const db = await openScanDb();
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      const req = db.transaction('scans').objectStore('scans').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(JSON.stringify(raw)).not.toContain('aaa');
    expect((await listScans(db))[0].scan.code).toBe('aaa');
    db.close();
  });
  it('preserves a refused offline observation without claiming passage', async () => {
    await store.startSession(point);
    api.lookupCode.mockReturnValue(throwError(() => new Error('offline')));
    expect((await store.recordScan('unknown')).kind).not.toBe('ok');
    const db = await openScanDb();
    const rows = await listScans(db);
    expect(rows[0].scan).toMatchObject({ code: 'unknown', clientAccepted: false });
    db.close();
  });
  it('enforces the configured offline duration even before key expiry', async () => {
    await store.startSession(point);
    const db = await openScanDb();
    const meta = await scanDb.getKv<Record<string, unknown>>(db, 'meta');
    const blob = await scanDb.getTable(db);
    await scanDb.save(
      db,
      { ...meta, maxOfflineMinutes: 1, lastRefreshAt: new Date(Date.now() - 120000).toISOString() },
      'test-key-not-a-secret',
      blob as ArrayBuffer,
    );
    await store.restore();
    expect(store.expired()).toBe(true);
    expect(store.ready()).toBe(false);
    db.close();
  });
  it('uploads the encrypted retained queue after expiry and can close the old session', async () => {
    await store.startSession(point);
    await store.recordScan('aaa');
    const db = await openScanDb();
    const meta = await scanDb.getKv<Record<string, unknown>>(db, 'meta');
    const blob = await scanDb.getTable(db);
    await scanDb.save(
      db,
      { ...meta, expiresAt: '2000-01-01T00:00:00Z' },
      'test-key-not-a-secret',
      blob as ArrayBuffer,
    );
    await store.restore();
    expect(await store.exitSession()).toBe(true);
    expect(api.uploadScans).toHaveBeenCalledWith(7, [expect.objectContaining({ code: 'aaa' })]);
    db.close();
  });
  it('uses the real session endpoints and metadata for upload', async () => {
    await store.startSession(point);
    await store.recordScan('aaa');
    await store.uploadPending();
    expect(api.startSession).toHaveBeenCalledWith(1);
    expect(api.uploadScans).toHaveBeenCalledWith(7, [
      expect.objectContaining({ code: 'aaa', pointId: 3, assignmentId: 10, tableVersion: 1 }),
    ]);
    expect(api.delta).toHaveBeenCalledWith(7, 1);
  });
});
