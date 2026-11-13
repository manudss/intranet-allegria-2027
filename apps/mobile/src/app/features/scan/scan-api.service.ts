import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AccessZone,
  LookupResult,
  PendingScan,
  ScanDelta,
  ScanPoint,
  ScanSessionStart,
  ScanType,
  ScanVerdictResult,
} from './scan.models';

@Injectable({ providedIn: 'root' })
export class ScanApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/access-control';

  listZones(): Observable<AccessZone[]> {
    return this.http.get<AccessZone[]>(`${this.base}/config/zones`);
  }

  listPoints(): Observable<ScanPoint[]> {
    return this.http.get<ScanPoint[]>(`${this.base}/config/points`);
  }

  listScanTypes(): Observable<ScanType[]> {
    return this.http.get<ScanType[]>(`${this.base}/config/scan-types`);
  }

  startSession(zoneId?: number): Observable<ScanSessionStart> {
    return this.http.post<ScanSessionStart>(`${this.base}/scan/sessions`, zoneId != null ? { zoneId } : {});
  }

  renewKey(sessionId: number): Observable<{ sessionKey: string; keyExpiresAt: string }> {
    return this.http.get<{ sessionKey: string; keyExpiresAt: string }>(`${this.base}/scan/sessions/${sessionId}/key`);
  }

  delta(sessionId: number, sinceVersion: number): Observable<ScanDelta> {
    return this.http.get<ScanDelta>(`${this.base}/scan/sessions/${sessionId}/delta`, {
      params: new HttpParams().set('since', sinceVersion),
    });
  }

  uploadScans(sessionId: number, scans: PendingScan[]): Observable<ScanVerdictResult[]> {
    return this.http.post<ScanVerdictResult[]>(`${this.base}/scan/sessions/${sessionId}/scans`, { scans });
  }

  closeSession(sessionId: number): Observable<unknown> {
    return this.http.post(`${this.base}/scan/sessions/${sessionId}/close`, {});
  }

  lookupCode(code: string, pointId: number): Observable<LookupResult> {
    return this.http.post<LookupResult>(`${this.base}/scan/lookup`, { code, pointId });
  }
}
