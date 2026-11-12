import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AccessTableDto,
  PendingScan,
  ScanLookupResponse,
  ScanPointConfig,
  ScanTypeConfig,
  ScanUploadResponse,
} from './scan.models';

@Injectable({ providedIn: 'root' })
export class ScanApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/access-control';

  listPoints(): Observable<ScanPointConfig[]> {
    return this.http.get<ScanPointConfig[]>(`${this.base}/config/points`);
  }

  listScanTypes(): Observable<ScanTypeConfig[]> {
    return this.http.get<ScanTypeConfig[]>(`${this.base}/config/scan-types`);
  }

  downloadTable(pointId: string, scope?: string): Observable<AccessTableDto> {
    const options = scope ? { params: new HttpParams().set('scope', scope) } : {};
    return this.http.get<AccessTableDto>(`${this.base}/scan/table/${pointId}`, options);
  }

  uploadScans(scans: PendingScan[]): Observable<ScanUploadResponse> {
    return this.http.post<ScanUploadResponse>(`${this.base}/scan/upload`, { scans });
  }

  lookupCode(code: string, pointId: string, scanType: string): Observable<ScanLookupResponse> {
    return this.http.get<ScanLookupResponse>(`${this.base}/scan/lookup`, {
      params: new HttpParams().set('code', code).set('pointId', pointId).set('scanType', scanType),
    });
  }
}
