import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject, Subscription, interval, switchMap } from 'rxjs';
import { decryptJson, encryptJson, exportKey, generateTableKey, hashQrCode, importKey } from './scan-crypto';
import { listScans, openScanDb, scanDb, ScanSessionMeta } from './scan-db';
import { ScanApiService } from './scan-api.service';
import {
  AccessTableDto,
  PendingScan,
  ScanPointConfig,
  ScanTypeCode,
  ScanTableRow,
  Verdict,
  evaluateScan,
} from './scan.models';

export const SCAN_KEY_TTL_MS = 30 * 60 * 1000; // TTL clé de table : 30 min
export const SCAN_SESSION_MAX_MS = 12 * 60 * 60 * 1000; // session max : 12 h
export const SCAN_UPLOAD_INTERVAL_MS = 45 * 1000; // envoi groupé toutes les 45 s
const UPLOAD_BATCH = 500;

export interface ScanSessionState {
  meta: ScanSessionMeta;
  table: Map<string, ScanTableRow>;
  key: CryptoKey;
  scannedToday: Set<string>;
}

@Injectable({ providedIn: 'root' })
export class ScanStore implements OnDestroy {
  private readonly api = inject(ScanApiService);

  readonly ready = signal(false);
  readonly expired = signal(false);
  readonly pendingCount = signal(0);
  readonly lastSyncAt = signal<Date | null>(null);
  readonly tableFreshness = signal<'fresh' | 'stale' | 'none'>('none');
  readonly activePoint = signal<ScanPointConfig | null>(null);
  readonly activeScanType = signal<ScanTypeCode>('ENTRY');
  readonly lastVerdict = signal<Verdict | null>(null);

  private db: IDBDatabase | null = null;
  private session: ScanSessionState | null = null;
  private localSeq = 0;
  private uploadSub: Subscription | null = null;
  private readonly stop$ = new Subject<void>();

  async init(): Promise<void> {
    this.db = await openScanDb();
    await this.restore();
    this.startUploadLoop();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    this.uploadSub?.unsubscribe();
    this.stop$.next();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') void this.refreshExpiry();
  };

  /** Restaure la session chiffrée si elle existe et n'est pas expirée. */
  async restore(): Promise<void> {
    if (!this.db) return;
    const meta = await scanDb.getKv<ScanSessionMeta>(this.db, 'meta');
    const rawKey = await scanDb.getKv<ArrayBuffer>(this.db, 'key');
    const blob = await scanDb.getTable(this.db);
    if (!meta || !rawKey || !blob) return;
    if (this.isExpired(meta)) {
      await this.wipe();
      return;
    }
    const key = await importKey(rawKey);
    const dto = await decryptJson<AccessTableDto>(key, blob);
    this.session = this.buildSession(meta, key, dto);
    this.applySession(meta.pointId, meta.scanTypeCode as ScanTypeCode);
    this.updateFreshness(meta);
  }

  private buildSession(meta: ScanSessionMeta, key: CryptoKey, dto: AccessTableDto): ScanSessionState {
    return {
      meta,
      key,
      table: new Map(dto.participants.map((p) => [p.qrCodeHash, p])),
      scannedToday: new Set(),
    };
  }

  private applySession(pointId: string, scanType: ScanTypeCode): void {
    this.activeScanType.set(scanType);
    this.ready.set(true);
    void this.refreshPendingCount();
  }

  /** Télécharge et chiffre la table pour le point choisi. */
  async startSession(point: ScanPointConfig, scanType: ScanTypeCode): Promise<void> {
    if (!this.db) this.db = await openScanDb();
    const dto = await this.api.downloadTable(point.id).toPromise();
    if (!dto) throw new Error('empty table response');
    const key = await generateTableKey();
    const meta: ScanSessionMeta = {
      pointId: point.id,
      scanTypeCode: scanType,
      generatedAt: dto.generatedAt,
      expiresAt: dto.expiresAt,
      downloadedAt: new Date().toISOString(),
    };
    const blob = await encryptJson(key, dto);
    await scanDb.clearAll(this.db);
    await scanDb.setTable(this.db, blob);
    await scanDb.setKv(this.db, 'key', await exportKey(key));
    await scanDb.setKv(this.db, 'meta', meta);
    this.session = this.buildSession(meta, key, dto);
    this.activePoint.set(point);
    this.applySession(point.id, scanType);
    this.updateFreshness(meta);
  }

  /** Enregistre un scan : verdict immédiat depuis la table chiffrée. */
  async recordScan(code: string): Promise<Verdict> {
    if (!this.db || !this.session) {
      const v: Verdict = { kind: 'offline', title: 'Mode scan non prêt', detail: 'Téléchargez la table avant de scanner.' };
      this.lastVerdict.set(v);
      return v;
    }
    if (this.isExpired(this.session.meta)) {
      const v: Verdict = { kind: 'expired', title: 'Table expirée', detail: 'Retournez à l’accueil du scan pour la renouveler.' };
      this.lastVerdict.set(v);
      await this.wipe();
      return v;
    }
    const hash = await hashQrCode(code);
    const point = this.activePoint();
    const scanType = this.activeScanType();
    const row = this.session.table.get(hash);
    let verdict = point
      ? evaluateScan(row, scanType, point, this.session.scannedToday)
      : ({ kind: 'ko', title: 'Point non configuré', detail: '' } as Verdict);

    if (verdict.kind === 'unknown' && navigator.onLine) {
      verdict = await this.lookupOnline(code, point?.id, scanType) ?? verdict;
    }

    if ((verdict.kind === 'ok' || verdict.kind === 'already') && row) {
      this.session.scannedToday.add(hash);
      if (verdict.kind === 'ok' && scanType === 'EXIT') row.checkedOutAt = new Date().toISOString();
      if (verdict.kind === 'ok' && verdict.servedCount != null) row.servedMealCount = verdict.servedCount;
    }

    if (verdict.kind === 'ok' || verdict.kind === 'ko' || verdict.kind === 'already') {
      const scan: PendingScan = {
        qrCodeHash: hash,
        scannedAt: new Date().toISOString(),
        pointId: point?.id ?? '',
        scanTypeCode: scanType,
        localSeq: ++this.localSeq,
      };
      await scanDb.addScan(this.db, scan);
      await this.refreshPendingCount();
    }
    this.lastVerdict.set(verdict);
    return verdict;
  }

  /** Secours en ligne pour un code inconnu de la table (badge récent). */
  private async lookupOnline(code: string, pointId: string | undefined, scanType: ScanTypeCode): Promise<Verdict | null> {
    if (!pointId) return null;
    try {
      const res = await this.api.lookupCode(code, pointId, scanType).toPromise();
      if (!res || !res.participant) return null;
      const p = res.participant;
      if (!res.allowed) {
        return { kind: 'ko', title: 'Accès refusé', detail: `${p.firstName} ${p.lastName} — ${res.reason}` };
      }
      return {
        kind: 'ok',
        title: scanType === 'EXIT' ? 'Sortie enregistrée' : 'OK (vérifié en ligne)',
        detail: `${p.firstName} ${p.lastName}${p.teamName ? ` · ${p.teamName}` : ''}`,
        servedCount: p.servedMealCount + 1,
      };
    } catch {
      return null;
    }
  }

  /** Envoie les scans en attente, puis efface seulement après confirmation. */
  async uploadPending(): Promise<{ sent: number; failed: boolean }> {
    if (!this.db) return { sent: 0, failed: false };
    const rows = await listScans(this.db);
    if (rows.length === 0) return { sent: 0, failed: false };
    const batch = rows.slice(0, UPLOAD_BATCH) as unknown as PendingScan[];
    try {
      await this.api.uploadScans(batch).toPromise();
      await scanDb.clearScans(this.db);
      this.lastSyncAt.set(new Date());
      await this.refreshPendingCount();
      return { sent: batch.length, failed: false };
    } catch {
      return { sent: 0, failed: true };
    }
  }

  /**
   * Sortie du mode scan : envoie les scans en attente. Les données locales ne
   * sont effacées que si tout a été confirmé par le serveur ; sinon la session
   * est conservée pour réessayer (jamais de perte de scans non confirmés).
   */
  async exitSession(): Promise<boolean> {
    const res = await this.uploadPending();
    if (res.failed || this.pendingCount() > 0) return false;
    await this.wipe();
    return true;
  }

  async wipe(): Promise<void> {
    if (this.db) await scanDb.clearAll(this.db);
    this.session = null;
    this.ready.set(false);
    this.expired.set(false);
    this.tableFreshness.set('none');
    this.pendingCount.set(0);
    this.activePoint.set(null);
    this.lastVerdict.set(null);
  }

  isExpired(meta: ScanSessionMeta, now = Date.now()): boolean {
    const downloaded = Date.parse(meta.downloadedAt);
    const expires = Date.parse(meta.expiresAt);
    return now > expires || now - downloaded > SCAN_SESSION_MAX_MS;
  }

  async refreshExpiry(): Promise<void> {
    if (this.session && this.isExpired(this.session.meta)) {
      this.expired.set(true);
      await this.wipe();
    }
  }

  private updateFreshness(meta: ScanSessionMeta): void {
    const age = Date.now() - Date.parse(meta.generatedAt);
    this.tableFreshness.set(age < SCAN_KEY_TTL_MS ? 'fresh' : 'stale');
  }

  private async refreshPendingCount(): Promise<void> {
    if (!this.db) return;
    this.pendingCount.set((await listScans(this.db)).length);
  }

  private startUploadLoop(): void {
    this.uploadSub = interval(SCAN_UPLOAD_INTERVAL_MS)
      .pipe(switchMap(() => this.uploadPending()))
      .subscribe({ error: () => undefined });
  }
}
