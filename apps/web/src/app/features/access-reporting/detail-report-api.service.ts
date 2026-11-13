import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
export interface DetailFilters {
  from: string;
  to: string;
  zoneId?: number;
  pointId?: number;
  scanTypeId?: number;
  serviceKey?: string;
  teamId?: number;
  participantId?: number;
  expectedGroupId?: number;
  personType?: string;
  q?: string;
  verdict?: string;
  anomaliesOnly?: string;
  reviewOnly?: string;
  limit?: number;
  offset?: number;
}
export interface PointCounts {
  pointId: number;
  pointName: string;
  zoneId: number;
  zoneName: string;
  active: boolean;
  scannedPeople: number;
  attempts: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  needsReview: number;
  lastReceivedAt: string | null;
}
export interface Dashboard {
  points: PointCounts[];
  totals: Omit<PointCounts, 'pointId' | 'pointName' | 'zoneId' | 'zoneName' | 'active'>;
  fetchedAt: string;
  caveat: string;
}
export interface DetailEvent {
  id: number;
  participantId: number | null;
  firstName: string | null;
  lastName: string | null;
  type: string;
  pointId: number;
  pointName: string;
  zoneName: string;
  scanTypeLabel: string;
  serviceKey: string | null;
  occurredAtLocal: string | null;
  receivedAt: string;
  verdict: string;
  needsReview: boolean;
  reviewClosed?: boolean;
  exceptionId?: number | null;
  exceptionReason?: string;
  teams?: { id: number; name: string }[];
}
export interface DetailPage {
  items: DetailEvent[];
  total: number;
  fetchedAt: string;
}
export interface ConfigPoint {
  id: number;
  name: string;
  zoneId: number;
  scanTypeId: number;
  serviceKey: string | null;
  active: boolean;
}
@Injectable({ providedIn: 'root' })
export class DetailReportApi {
  private http = inject(HttpClient);
  private base = '/api/access-control';
  private params(q: DetailFilters) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(q))
      if (v != null && v !== '') params = params.set(k, String(v));
    return params;
  }
  dashboard(q: DetailFilters) {
    return this.http.get<Dashboard>(this.base + '/reporting/dashboard', { params: this.params(q) });
  }
  events(q: DetailFilters) {
    return this.http.get<DetailPage>(this.base + '/reporting/events', { params: this.params(q) });
  }
  scanned(q: DetailFilters) {
    return this.http.get<DetailPage>(this.base + '/reporting/scanned', { params: this.params(q) });
  }
  points() {
    return this.http.get<ConfigPoint[]>(this.base + '/config/points');
  }
  zones() {
    return this.http.get<{ id: number; name: string }[]>(this.base + '/config/zones');
  }
  types() {
    return this.http.get<{ id: number; label: string }[]>(this.base + '/config/scan-types');
  }
  teams() {
    return this.http.get<{ id: number; name: string }[]>('/api/teams');
  }
}
