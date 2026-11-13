import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
export interface ExpectedPassage {
  id: number;
  group_id: number;
  point_id: number;
  groupName: string;
  pointName: string;
  label: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
}
export interface ExpectedPerson {
  personKey: string;
  participantId: number | null;
  volunteerId: number | null;
  firstName: string;
  lastName: string | null;
  type: string;
  status: 'CONFIRMED' | 'REVIEW_ONLY' | 'NOT_CONFIRMED';
  lastReceivedAt: string | null;
  isException: boolean;
  exception: {
    id: number;
    authorizedEmail: string;
    createdAt: string;
    reason: string;
    eventId: number;
    sessionId?: number;
    refusedAt?: string;
    acceptedAt?: string;
  } | null;
  lastAttempt: {
    verdict: string;
    needsReview: boolean;
    occurredAtLocal: string | null;
    receivedAt: string;
  } | null;
}
export interface ExpectedCounts {
  expected: number;
  confirmed: number;
  reviewOnly: number;
  notConfirmed: number;
  exceptions: number;
}
export interface ExpectedStatusPage {
  items: ExpectedPerson[];
  total: number;
  counts: ExpectedCounts;
  membershipBasis: string;
}
@Injectable({ providedIn: 'root' })
export class ExpectedReportApi {
  private http = inject(HttpClient);
  private base = '/api/access-control/expected';
  passage(id: number) {
    return this.http.get<ExpectedPassage>(`${this.base}/passages/${id}`);
  }
  passages(offset = 0) {
    return this.http.get<{ items: ExpectedPassage[]; total: number }>(`${this.base}/passages`, {
      params: new HttpParams().set('limit', 100).set('offset', offset),
    });
  }
  status(id: number, status: string, offset: number, q: string) {
    let params = new HttpParams().set('limit', 50).set('offset', offset);
    if (status) params = params.set('status', status);
    if (q.trim()) params = params.set('q', q.trim());
    return this.http.get<ExpectedStatusPage>(`${this.base}/passages/${id}/status`, { params });
  }
}
