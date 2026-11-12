import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { firstValueFrom, Subscription, interval, timeout } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { decryptJson, deriveTableKey, encryptJson } from './scan-crypto';
import { listScans, openScanDb, scanDb } from './scan-db';
import { ScanApiService } from './scan-api.service';
import { PendingScan, ScanPoint, SnapshotEntry, Verdict, duplicateKeyOf, evaluateScan } from './scan.models';
export const SCAN_UPLOAD_INTERVAL_MS = 45_000;
const UPLOAD_BATCH = 500;

export interface SessionMeta {
  sessionId: number;
  ownerId: number;
  point: ScanPoint;
  expiresAt: string;
  keyExpiresAt: string;
  snapshotVersion: number;
  maxOfflineMinutes: number;
  requiresOnlineValidation: boolean;
  startedAt: string;
  lastRefreshAt: string;
}
interface LocalTable {
  entries: SnapshotEntry[];
  seenKeys: string[];
  servedByService: Record<string, number>;
}
@Injectable({ providedIn: 'root' })
export class ScanStore implements OnDestroy {
  private readonly api = inject(ScanApiService);
  private readonly auth = inject(AuthService);
  readonly ready = signal(false);
  readonly expired = signal(false);
  readonly pendingCount = signal(0);
  readonly lastSyncAt = signal<Date | null>(null);
  readonly tableFreshness = signal<'fresh' | 'stale' | 'none'>('none');
  readonly activePoint = signal<ScanPoint | null>(null);
  readonly lastVerdict = signal<Verdict | null>(null);
  private db: IDBDatabase | null = null;
  private meta: SessionMeta | null = null;
  private key: CryptoKey | null = null;
  private sessionKey = '';
  private entries = new Map<string, SnapshotEntry>();
  private seenKeys = new Set<string>();
  private servedByService = new Map<string, number>();
  private uploadSub: Subscription | null = null;
  private initPromise: Promise<void> | null = null;
  /** Serialize persistence, scan and sync to prevent queue/snapshot races. */
  private tail: Promise<unknown> = Promise.resolve();
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.tail.then(run);
    this.tail = next.catch(() => undefined);
    return next;
  }
  init(): Promise<void> {
    this.initPromise ??= this.serial(async () => {
      this.db = await openScanDb();
      await this.restore();
      this.uploadSub = interval(SCAN_UPLOAD_INTERVAL_MS).subscribe(() => {
        void this.uploadPending().catch(() => undefined);
      });
      document.addEventListener('visibilitychange', this.onVisibility);
    });
    return this.initPromise;
  }
  ngOnDestroy(): void {
    this.uploadSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.db?.close();
  }
  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') void this.refreshExpiry().catch(() => undefined);
  };
  private isOwner(): boolean { return this.meta?.ownerId === this.auth.currentUser()?.id; }
  async restore(): Promise<void> {
    if (!this.db) return;
    const meta = await scanDb.getKv<SessionMeta>(this.db, 'meta');
    if (!meta) return;
    this.meta = meta;
    if (!this.isOwner()) throw new Error('Une autre session de scan doit être clôturée par son utilisateur.');
    await this.refreshPendingCount();
    this.activePoint.set(meta.point);
    this.sessionKey = await scanDb.getKv<string>(this.db, 'sessionKey') ?? '';
    if (this.isExpired(meta)) {
      // Keep queue and its session routing. Never erase unconfirmed scans.
      await this.suspend();
      return;
    }
    const blob = await scanDb.getTable(this.db);
    if (!this.sessionKey || !blob) { this.ready.set(false); return; }
    this.key = await deriveTableKey(this.sessionKey);
    const local = await decryptJson<LocalTable>(this.key, blob);
    this.entries = new Map(local.entries.map((e) => [e.code, e]));
    this.seenKeys = new Set(local.seenKeys);
    this.servedByService = new Map(Object.entries(local.servedByService));
    this.ready.set(true);
    this.updateFreshness();
  }
  startSession(point: ScanPoint): Promise<void> {
    return this.serial(async () => {
      if (!this.db) throw new Error('Mode scan non initialisé');
      if (this.meta) {
        if (!this.isOwner()) throw new Error('Session appartenant à un autre utilisateur');
        const result = await this.sync();
        if (result.failed || this.pendingCount()) throw new Error('Scans non envoyés, session conservée');
      }
      const res = await firstValueFrom(this.api.startSession(point.zoneId).pipe(timeout(10_000)));
      this.key = await deriveTableKey(res.sessionKey);
      this.sessionKey = res.sessionKey;
      this.meta = {
        sessionId: res.sessionId, ownerId: this.auth.currentUser()?.id ?? 0, point,
        expiresAt: res.expiresAt, keyExpiresAt: res.keyExpiresAt, snapshotVersion: res.snapshotVersion,
        maxOfflineMinutes: res.maxOfflineMinutes, requiresOnlineValidation: res.requiresOnlineValidation,
        startedAt: res.startedAt, lastRefreshAt: new Date().toISOString(),
      };
      this.entries = new Map(res.snapshot.map((e) => [e.code, e]));
      this.seenKeys.clear(); this.servedByService.clear();
      await this.persist();
      this.activePoint.set(point); this.ready.set(true); this.expired.set(false);
      this.updateFreshness();
    });
  }
  private async persist(scan?: PendingScan): Promise<void> {
    if (!this.db || !this.key || !this.meta) throw new Error('Session indisponible');
    const local: LocalTable = { entries: [...this.entries.values()], seenKeys: [...this.seenKeys], servedByService: Object.fromEntries(this.servedByService) };
    const blob = await encryptJson(this.key, local);
    await scanDb.save(this.db, this.meta, this.sessionKey, blob, scan);
  }
  recordScan(rawCode: string): Promise<Verdict> {
    return this.serial(async () => {
      if (!this.meta || !this.db || !this.isOwner()) return this.verdict('offline', 'Mode scan non prêt', 'Démarrez une session avant de scanner.');
      if (Date.now() >= Date.parse(this.meta.keyExpiresAt) && navigator.onLine) await this.renewKeyIfNeeded();
      if (this.isExpired(this.meta)) {
        await this.suspend();
        return this.verdict('expired', 'Session expirée', 'Les scans non envoyés sont conservés. Reconnectez cet appareil.');
      }
      if (!this.ready() || !this.key) return this.verdict('offline', 'Mode scan non prêt', 'Redémarrez une session en ligne.');
      const code = rawCode.trim();
      const point = this.meta.point;
      const rule = point.scanType?.duplicateRule ?? 'ALLOW';
      const entry = this.entries.get(code);
      const now = new Date();
      const scope = `${point.scanTypeId}|${rule === 'UNIQUE_PER_DAY' ? now.toISOString().slice(0, 10) : point.serviceKey ?? ''}`;
      const seen = new Set([...this.seenKeys].filter((k) => k.startsWith(scope + ':')).map((k) => k.slice(scope.length + 1)));
      let verdict = evaluateScan(entry, rule, point.serviceKey, seen, this.servedByService.get(scope) ?? 0);
      const onlineRequired = this.meta.requiresOnlineValidation;
      if (onlineRequired || verdict.kind === 'unknown') {
        const online = navigator.onLine ? await this.lookupOnline(code, point.id) : null;
        verdict = online ?? { kind: 'offline', title: 'À vérifier', detail: onlineRequired ? 'Validation en ligne obligatoire. Ne pas laisser passer.' : 'Badge absent de la table. Vérifiez avec un référent.' };
      }
      if (verdict.kind === 'ok') {
        this.seenKeys.add(`${scope}:${duplicateKeyOf(code, rule, point.serviceKey)}`);
        this.servedByService.set(scope, (this.servedByService.get(scope) ?? 0) + 1);
      }
      const scan: PendingScan = {
        clientEventId: crypto.randomUUID(), code, pointId: point.id, assignmentId: entry?.assignmentId,
        tableVersion: this.meta.snapshotVersion, occurredAtLocal: now.toISOString(), serviceKey: point.serviceKey ?? undefined,
      };
      // Unknown/refused scans are also retained for server review.
      await this.persist(scan);
      await this.refreshPendingCount();
      this.lastVerdict.set(verdict);
      return verdict;
    });
  }
  private verdict(kind: Verdict['kind'], title: string, detail: string): Verdict {
    const v = { kind, title, detail }; this.lastVerdict.set(v); return v;
  }
  private async lookupOnline(code: string, pointId: number): Promise<Verdict | null> {
    try {
      const res = await firstValueFrom(this.api.lookupCode(code, pointId).pipe(timeout(4_000)));
      if (res.verdict === 'ACCEPTED') return { kind: 'ok', title: 'OK (vérifié en ligne)', detail: [res.firstName, res.lastName].filter(Boolean).join(' ') };
      if (res.verdict === 'DUPLICATE') return { kind: 'already', title: 'Déjà validé', detail: 'Vérifié en ligne.' };
      return { kind: 'ko', title: 'Accès refusé', detail: 'Badge inconnu, révoqué, remplacé ou sans droit.' };
    } catch { return null; }
  }
  uploadPending(): Promise<{ sent: number; failed: boolean }> { return this.serial(() => this.sync()); }
  private async sync(): Promise<{ sent: number; failed: boolean }> {
    if (!this.db || !this.meta || !this.isOwner()) return { sent: 0, failed: this.pendingCount() > 0 };
    let sent = 0;
    try {
      let rows = await listScans(this.db);
      while (rows.length) {
        const batch = rows.slice(0, UPLOAD_BATCH);
        const results = await firstValueFrom(this.api.uploadScans(this.meta.sessionId, batch.map((r) => r.scan)).pipe(timeout(10_000)));
        const ack = new Set(results.map((r) => r.clientEventId));
        const confirmed = batch.filter((r) => ack.has(r.scan.clientEventId));
        await scanDb.removeScans(this.db, confirmed.map((r) => r.id));
        sent += confirmed.length;
        await this.refreshPendingCount();
        if (confirmed.length !== batch.length) return { sent, failed: true };
        rows = await listScans(this.db);
      }
      await this.renewKeyIfNeeded();
      if (this.ready() && this.key && !this.isExpired(this.meta)) {
        const delta = await firstValueFrom(this.api.delta(this.meta.sessionId, this.meta.snapshotVersion).pipe(timeout(4_000)));
        const revoked = new Set(delta.revokedAssignmentIds);
        for (const [code, entry] of this.entries) if (revoked.has(entry.assignmentId)) this.entries.delete(code);
        for (const entry of delta.upserts) this.entries.set(entry.code, entry);
        this.meta = { ...this.meta, snapshotVersion: delta.version, lastRefreshAt: new Date().toISOString() };
        await this.persist();
        this.lastSyncAt.set(new Date());
      }
      this.updateFreshness();
      return { sent, failed: false };
    } catch { await this.refreshPendingCount(); this.updateFreshness(); return { sent, failed: true }; }
  }
  private async renewKeyIfNeeded(): Promise<void> {
    if (!this.meta || !this.key || Date.now() < Date.parse(this.meta.keyExpiresAt) - 60_000) return;
    try {
      const res = await firstValueFrom(this.api.renewKey(this.meta.sessionId).pipe(timeout(4_000)));
      this.key = await deriveTableKey(res.sessionKey); this.sessionKey = res.sessionKey;
      this.meta = { ...this.meta, keyExpiresAt: res.keyExpiresAt };
      await this.persist();
    } catch { /* Expiry check will suspend the table, preserving pending events. */ }
  }
  exitSession(): Promise<boolean> {
    return this.serial(async () => {
      const result = await this.sync();
      if (result.failed || this.pendingCount() || !this.isOwner()) return false;
      try { if (this.meta) await firstValueFrom(this.api.closeSession(this.meta.sessionId).pipe(timeout(4_000))); }
      catch { return false; }
      if (this.db) await scanDb.clearAll(this.db);
      this.meta = null; this.key = null; this.sessionKey = '';
      this.entries.clear(); this.seenKeys.clear(); this.servedByService.clear();
      this.ready.set(false); this.expired.set(false); this.activePoint.set(null); this.tableFreshness.set('none');
      return true;
    });
  }
  isExpired(meta: SessionMeta, now = Date.now()): boolean {
    return now >= Date.parse(meta.expiresAt) || now >= Date.parse(meta.keyExpiresAt)
      || now - Date.parse(meta.lastRefreshAt) >= meta.maxOfflineMinutes * 60_000;
  }
  refreshExpiry(): Promise<void> {
    return this.serial(async () => {
      await this.renewKeyIfNeeded();
      if (this.meta && this.isExpired(this.meta)) await this.suspend();
    });
  }
  private async suspend(): Promise<void> {
    if (this.db) await scanDb.clearTable(this.db);
    this.entries.clear(); this.seenKeys.clear(); this.servedByService.clear();
    this.key = null; this.ready.set(false); this.expired.set(true); this.tableFreshness.set('none');
  }
  private updateFreshness(): void {
    if (!this.meta || !this.ready()) { this.tableFreshness.set('none'); return; }
    this.tableFreshness.set(Date.now() - Date.parse(this.meta.lastRefreshAt) < 90_000 ? 'fresh' : 'stale');
  }
  private async refreshPendingCount(): Promise<void> {
    if (this.db) this.pendingCount.set((await listScans(this.db)).length);
  }
}
