import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { decryptJson, deriveTableKey, encryptJson } from './scan-crypto';
import { listScans, openScanDb, scanDb } from './scan-db';
import { ScanApiService } from './scan-api.service';
import {
  DuplicateRule,
  PendingScan,
  ScanPoint,
  ScanSessionStart,
  SnapshotEntry,
  Verdict,
  duplicateKeyOf,
  evaluateScan,
} from './scan.models';

export const SCAN_UPLOAD_INTERVAL_MS = 45 * 1000; // envoi groupé toutes les 45 s
const UPLOAD_BATCH = 500;

interface SessionMeta {
  sessionId: number;
  pointId: number;
  expiresAt: string;
  keyExpiresAt: string;
  snapshotVersion: number;
  maxOfflineMinutes: number;
  requiresOnlineValidation: boolean;
  startedAt: string;
}

interface LocalTable {
  entries: SnapshotEntry[];
  /** Clés de doublon acceptées localement (code ou code|service). */
  seenKeys: string[];
  /** Passages acceptés par serviceKey (compteur de service, direction C). */
  servedByService: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ScanStore implements OnDestroy {
  private readonly api = inject(ScanApiService);

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
  private entries = new Map<string, SnapshotEntry>();
  private seenKeys = new Set<string>();
  private servedByService = new Map<string, number>();
  private uploadSub: Subscription | null = null;

  async init(): Promise<void> {
    this.db = await openScanDb();
    await this.restore();
    this.startUploadLoop();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    this.uploadSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') void this.refreshExpiry();
  };

  async restore(): Promise<void> {
    if (!this.db) return;
    const meta = await scanDb.getKv<SessionMeta>(this.db, 'meta');
    const sessionKey = await scanDb.getKv<string>(this.db, 'sessionKey');
    const blob = await scanDb.getTable(this.db);
    if (!meta || !sessionKey || !blob) return;
    if (this.isExpired(meta)) {
      await this.wipe();
      return;
    }
    this.key = await deriveTableKey(sessionKey);
    const local = await decryptJson<LocalTable>(this.key, blob);
    this.meta = meta;
    this.entries = new Map(local.entries.map((e) => [e.code, e]));
    this.seenKeys = new Set(local.seenKeys);
    this.servedByService = new Map(Object.entries(local.servedByService));
    this.ready.set(true);
    this.updateFreshness();
    await this.refreshPendingCount();
  }

  /** Démarre une session serveur et chiffre l'instantané localement. */
  async startSession(point: ScanPoint): Promise<void> {
    if (!this.db) this.db = await openScanDb();
    if (this.meta) await this.uploadPending(); // ne pas perdre les scans d'une session précédente
    await scanDb.clearAll(this.db);
    const res = await this.api.startSession(point.zoneId).toPromise();
    if (!res) throw new Error('empty session response');
    this.key = await deriveTableKey(res.sessionKey);
    this.meta = {
      sessionId: res.sessionId,
      pointId: point.id,
      expiresAt: res.expiresAt,
      keyExpiresAt: res.keyExpiresAt,
      snapshotVersion: res.snapshotVersion,
      maxOfflineMinutes: res.maxOfflineMinutes,
      requiresOnlineValidation: res.requiresOnlineValidation,
      startedAt: res.startedAt,
    };
    this.entries = new Map(res.snapshot.map((e) => [e.code, e]));
    this.seenKeys = new Set();
    this.servedByService = new Map();
    await this.persist(res.sessionKey);
    this.activePoint.set(point);
    this.ready.set(true);
    this.updateFreshness();
    await this.refreshPendingCount();
  }

  private async persist(sessionKey: string): Promise<void> {
    if (!this.db || !this.key || !this.meta) return;
    const local: LocalTable = {
      entries: [...this.entries.values()],
      seenKeys: [...this.seenKeys],
      servedByService: Object.fromEntries(this.servedByService),
    };
    const blob = await encryptJson(this.key, local);
    await scanDb.clearKvAndTable(this.db);
    await scanDb.setTable(this.db, blob);
    await scanDb.setKv(this.db, 'sessionKey', sessionKey);
    await scanDb.setKv(this.db, 'meta', this.meta);
  }

  /** Enregistre un scan : verdict immédiat depuis l'instantané chiffré. */
  async recordScan(rawCode: string): Promise<Verdict> {
    if (!this.db || !this.meta || !this.key || !this.ready()) {
      const v: Verdict = { kind: 'offline', title: 'Mode scan non prêt', detail: "Démarrez une session avant de scanner." };
      this.lastVerdict.set(v);
      return v;
    }
    if (this.isExpired(this.meta)) {
      const v: Verdict = { kind: 'expired', title: 'Session expirée', detail: 'Redémarrez le mode scan en ligne.' };
      this.lastVerdict.set(v);
      await this.wipe();
      return v;
    }
    const code = rawCode.trim();
    const point = this.activePoint();
    if (!point) {
      const v: Verdict = { kind: 'ko', title: 'Point non configuré', detail: '' };
      this.lastVerdict.set(v);
      return v;
    }
    const rule: DuplicateRule = point.scanType?.duplicateRule ?? 'ALLOW';
    const entry = this.entries.get(code);
    let verdict = evaluateScan(entry, rule, point.serviceKey, this.seenKeys, this.servedByService.get(point.serviceKey ?? '') ?? 0);

    if (verdict.kind === 'unknown' && navigator.onLine) {
      verdict = (await this.lookupOnline(code, point.id)) ?? verdict;
    }

    if (verdict.kind === 'ok') {
      this.seenKeys.add(duplicateKeyOf(code, rule, point.serviceKey));
      if (rule === 'UNIQUE_PER_SERVICE') {
        const k = point.serviceKey ?? '';
        this.servedByService.set(k, (this.servedByService.get(k) ?? 0) + 1);
      }
    }

    if (verdict.kind === 'ok' || verdict.kind === 'already' || verdict.kind === 'ko') {
      const scan: PendingScan = {
        clientEventId: crypto.randomUUID(),
        code,
        pointId: point.id,
        assignmentId: entry?.assignmentId,
        tableVersion: this.meta.snapshotVersion,
        occurredAtLocal: new Date().toISOString(),
        serviceKey: point.serviceKey ?? undefined,
      };
      await scanDb.addScan(this.db, scan);
      await this.refreshPendingCount();
    }
    this.lastVerdict.set(verdict);
    return verdict;
  }

  /** Secours en ligne pour un code absent de l'instantané (badge récent). */
  private async lookupOnline(code: string, pointId: number): Promise<Verdict | null> {
    try {
      const res = await this.api.lookupCode(code, pointId).toPromise();
      if (!res) return null;
      if (res.verdict === 'ACCEPTED') {
        const name = res.firstName ? `${res.firstName} ${res.lastName ?? ''}`.trim() : '';
        return { kind: 'ok', title: 'OK (vérifié en ligne)', detail: name };
      }
      if (res.verdict === 'DUPLICATE') {
        return { kind: 'already', title: 'Déjà validé', detail: 'Vérifié en ligne.' };
      }
      if (res.verdict === 'REJECTED_UNKNOWN') return null;
      return { kind: 'ko', title: 'Accès refusé', detail: 'Badge révoqué, remplacé ou sans droit.' };
    } catch {
      return null;
    }
  }

  /** Envoie les scans en attente + rafraîchit l'instantané (delta). */
  async uploadPending(): Promise<{ sent: number; failed: boolean }> {
    if (!this.db || !this.meta) return { sent: 0, failed: false };
    const rows = (await listScans(this.db)) as unknown as PendingScan[];
    let failed = false;
    let sent = 0;
    if (rows.length > 0) {
      const batch = rows.slice(0, UPLOAD_BATCH);
      try {
        await this.api.uploadScans(this.meta.sessionId, batch).toPromise();
        // Le serveur a enregistré chaque événement (accepté, doublon ou rejeté
        // à vérifier) : la copie locale n'a plus de raison d'être.
        await scanDb.clearScans(this.db);
        sent = batch.length;
        this.lastSyncAt.set(new Date());
      } catch {
        failed = true;
      }
    }
    if (!failed) {
      await this.refreshDelta();
      await this.renewKeyIfNeeded();
    }
    await this.refreshPendingCount();
    return { sent, failed };
  }

  /** Applique les changements serveur (révocations, nouvelles attributions). */
  private async refreshDelta(): Promise<void> {
    if (!this.meta || !this.db || !this.key) return;
    try {
      const delta = await this.api.delta(this.meta.sessionId, this.meta.snapshotVersion).toPromise();
      if (!delta) return;
      for (const up of delta.upserts) this.entries.set(up.code, up);
      const revoked = new Set(delta.revokedAssignmentIds);
      if (revoked.size > 0) {
        for (const [code, entry] of [...this.entries]) {
          if (revoked.has(entry.assignmentId)) this.entries.delete(code);
        }
      }
      this.meta = { ...this.meta, snapshotVersion: delta.version };
      const sessionKey = await scanDb.getKv<string>(this.db, 'sessionKey');
      if (sessionKey) await this.persist(sessionKey);
      this.updateFreshness();
    } catch {
      /* hors-ligne : on garde l'instantané courant */
    }
  }

  /** Renouvelle la clé de session (TTL 30 min) quand le réseau est là. */
  private async renewKeyIfNeeded(): Promise<void> {
    if (!this.meta || !this.db) return;
    if (Date.now() < Date.parse(this.meta.keyExpiresAt) - 60_000) return;
    try {
      const res = await this.api.renewKey(this.meta.sessionId).toPromise();
      if (!res) return;
      this.key = await deriveTableKey(res.sessionKey);
      this.meta = { ...this.meta, keyExpiresAt: res.keyExpiresAt };
      await this.persist(res.sessionKey);
    } catch {
      /* sans réseau, l'expiration de clé finira par effacer la session */
    }
  }

  /** Sortie du mode scan : envoie, ferme la session, puis efface si tout est confirmé. */
  async exitSession(): Promise<boolean> {
    const res = await this.uploadPending();
    if (res.failed || this.pendingCount() > 0) return false;
    if (this.meta) {
      try {
        await this.api.closeSession(this.meta.sessionId).toPromise();
      } catch {
        /* la fermeture serveur est best-effort ; la session expire d'elle-même */
      }
    }
    await this.wipe();
    return true;
  }

  async wipe(): Promise<void> {
    if (this.db) await scanDb.clearAll(this.db);
    this.meta = null;
    this.key = null;
    this.entries = new Map();
    this.seenKeys = new Set();
    this.servedByService = new Map();
    this.ready.set(false);
    this.expired.set(false);
    this.tableFreshness.set('none');
    this.pendingCount.set(0);
    this.activePoint.set(null);
    this.lastVerdict.set(null);
  }

  isExpired(meta: SessionMeta, now = Date.now()): boolean {
    return now > Date.parse(meta.expiresAt) || now > Date.parse(meta.keyExpiresAt);
  }

  async refreshExpiry(): Promise<void> {
    if (this.meta && this.isExpired(this.meta)) {
      this.expired.set(true);
      await this.wipe();
    }
  }

  private updateFreshness(): void {
    if (!this.meta) {
      this.tableFreshness.set('none');
      return;
    }
    this.tableFreshness.set(navigator.onLine ? 'fresh' : 'stale');
  }

  private async refreshPendingCount(): Promise<void> {
    if (!this.db) return;
    this.pendingCount.set((await listScans(this.db)).length);
  }

  private startUploadLoop(): void {
    this.uploadSub = interval(SCAN_UPLOAD_INTERVAL_MS).subscribe(() => void this.uploadPending());
  }
}
