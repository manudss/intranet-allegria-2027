import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
export interface ReportFilters { from: string; to: string; zoneId?: number; entryTypeId?: number; exitTypeId?: number }
export interface CountRow { zoneId: number; zoneName: string; scanTypeId: number; scanTypeLabel: string; serviceKey: string | null; accepted: number; uncertain: number; duplicates: number; rejected: number }
export interface AccessSummary {
  from: string; to: string; zoneId: number | null; counts: CountRow[];
  presence: { estimatedPresent: number; byZone: { zoneId: number; present: number }[] } | null;
  pendingReviews: number; lastReceivedAt: string | null; fetchedAt: string; caveat: string;
}
export interface ScanReviewItem { id: number; participantId: number | null; firstName: string | null; lastName: string | null; verdict: string; needsReview: boolean; occurredAtLocal: string | null; receivedAt: string; pointId: number; pointName: string; zoneId: number }
export interface ReviewPage { items: ScanReviewItem[]; total: number }
@Injectable({ providedIn: 'root' })
export class AccessReportingApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/access-control';
  zones() { return this.http.get<{id: number; name: string}[]>(`${this.base}/config/zones`); }
  types() { return this.http.get<{id: number; code: string; label: string}[]>(`${this.base}/config/scan-types`); }
  summary(filters: ReportFilters) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value != null) params = params.set(key, String(value));
    return this.http.get<AccessSummary>(`${this.base}/reporting/summary`, { params });
  }
  reviews(zoneId: number | undefined, offset: number) {
    let params = new HttpParams().set('offset', offset).set('limit', 50);
    if (zoneId != null) params = params.set('zoneId', zoneId);
    return this.http.get<ReviewPage>(`${this.base}/reporting/reviews`, { params });
  }
  closeReview(id: number, note: string) { return this.http.post(`${this.base}/reporting/reviews/${id}/close`, { note }); }
}
