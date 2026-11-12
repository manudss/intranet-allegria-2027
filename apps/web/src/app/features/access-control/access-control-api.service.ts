import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type AccessBadgeStatus = 'AVAILABLE' | 'ASSIGNED' | 'LOST' | 'REVOKED';

export interface AccessBadge {
  id: number;
  code: string;
  lot: string | null;
  status: AccessBadgeStatus;
  createdAt: string;
  assignments?: AccessBadgeAssignment[];
}

export interface AccessBadgeAssignment {
  id: number;
  badgeId: number;
  participantId: number;
  startsAt: string;
  endsAt: string | null;
  version: number;
  badge?: AccessBadge;
}

export interface ScannerGrant {
  id: number;
  userId: string;
  pointId: string | null;
  startsAt: string;
  expiresAt: string;
  revokedAt: string | null;
  user?: { firstName: string; lastName: string; email: string };
  point?: { label: string } | null;
}

export interface AccessAuditEntry {
  id: number;
  action: string;
  userId: string | null;
  badgeId: number | null;
  participantId: number | null;
  pointId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface ScanTypeItem {
  id: string;
  code: string;
  label: string;
  description: string | null;
  oneWay: boolean;
  active: boolean;
}

export interface ZoneItem {
  id: number;
  name: string;
  restricted: boolean;
  active: boolean;
}

export interface ScanPointItem {
  id: string;
  code: string;
  label: string;
  type: string;
  zoneId: number | null;
  active: boolean;
}

export interface ParticipantSearchItem {
  id: number;
  firstName: string;
  lastName: string;
  type: string | null;
  group?: { name: string } | null;
  teamMemberships?: { team?: { name: string } | null }[];
}

@Injectable({ providedIn: 'root' })
export class AccessControlApiService {
  private readonly http = inject(HttpClient);
  private readonly badges = '/api/access-control/badges';
  private readonly base = '/api/access-control';

  listBadges(params: { status?: AccessBadgeStatus; lot?: string; q?: string; limit?: number; offset?: number }): Observable<{ items: AccessBadge[]; total: number }> {
    let query = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query = query.set(k, String(v));
    });
    return this.http.get<{ items: AccessBadge[]; total: number }>(this.badges, { params: query });
  }

  registerStock(codes: string[], lot?: string): Observable<unknown> {
    return this.http.post(`${this.badges}/stock`, { codes, lot });
  }

  revokeBadge(id: number, reason: string): Observable<unknown> {
    return this.http.post(`${this.badges}/${id}/revoke`, { reason });
  }

  participantHistory(participantId: number): Observable<AccessBadgeAssignment[]> {
    return this.http.get<AccessBadgeAssignment[]>(`${this.badges}/participants/${participantId}/history`);
  }

  assign(participantId: number, badgeCode: string, operationId: string): Observable<unknown> {
    return this.http.post(`${this.badges}/assign`, { participantId, badgeCode, operationId, reason: 'Attribution intranet' });
  }

  replace(participantId: number, newBadgeCode: string, operationId: string): Observable<unknown> {
    return this.http.post(`${this.badges}/replace`, { participantId, newBadgeCode, operationId, reason: 'Remplacement badge perdu (intranet)' });
  }

  searchParticipants(q: string): Observable<{ items: ParticipantSearchItem[]; total: number }> {
    return this.http.get<{ items: ParticipantSearchItem[]; total: number }>('/api/participants/search', {
      params: new HttpParams().set('q', q.trim()).set('limit', 8),
    });
  }

  listGrants(): Observable<ScannerGrant[]> {
    return this.http.get<ScannerGrant[]>(`${this.base}/scanner-grants`);
  }

  createGrant(grant: { userId: string; pointId?: string; startsAt: string; expiresAt: string }): Observable<unknown> {
    return this.http.post(`${this.base}/scanner-grants`, grant);
  }

  revokeGrant(id: number): Observable<unknown> {
    return this.http.post(`${this.base}/scanner-grants/${id}/revoke`, {});
  }

  listScanTypes(): Observable<ScanTypeItem[]> {
    return this.http.get<ScanTypeItem[]>(`${this.base}/config/scan-types`);
  }

  createScanType(dto: { code: string; label: string; description?: string; oneWay: boolean }): Observable<unknown> {
    return this.http.post(`${this.base}/config/scan-types`, dto);
  }

  listZones(): Observable<ZoneItem[]> {
    return this.http.get<ZoneItem[]>(`${this.base}/config/zones`);
  }

  createZone(dto: { name: string; restricted: boolean }): Observable<unknown> {
    return this.http.post(`${this.base}/config/zones`, dto);
  }

  updateZone(id: number, dto: Partial<{ name: string; restricted: boolean; active: boolean }>): Observable<unknown> {
    return this.http.patch(`${this.base}/config/zones/${id}`, dto);
  }

  listPoints(): Observable<ScanPointItem[]> {
    return this.http.get<ScanPointItem[]>(`${this.base}/config/points`);
  }

  createPoint(dto: { code: string; label: string; type: string; zoneId?: number }): Observable<unknown> {
    return this.http.post(`${this.base}/config/points`, dto);
  }

  audit(params: { action?: string; userId?: string; limit?: number; offset?: number }): Observable<{ items: AccessAuditEntry[]; total: number }> {
    let query = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query = query.set(k, String(v));
    });
    return this.http.get<{ items: AccessAuditEntry[]; total: number }>(`${this.base}/audit`, { params: query });
  }
}
