import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type BadgeStatus = 'AVAILABLE' | 'ASSIGNED' | 'LOST' | 'REVOKED';

export interface AccessBadgeAssignment {
  id: number;
  participantId: number;
  startsAt: string;
  endsAt: string | null;
  version: number;
  badge?: AccessBadge;
}

export interface AccessBadge {
  id: number;
  code: string;
  lot: string | null;
  status: BadgeStatus;
  assignments?: AccessBadgeAssignment[];
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
export class BadgeAssignApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/access-control/badges';

  findByCode(code: string): Observable<AccessBadge> {
    return this.http.get<AccessBadge>(`${this.base}/by-code/${encodeURIComponent(code.trim())}`);
  }

  searchParticipants(q: string): Observable<{ items: ParticipantSearchItem[]; total: number }> {
    return this.http.get<{ items: ParticipantSearchItem[]; total: number }>('/api/participants/search', {
      params: new HttpParams().set('q', q.trim()).set('limit', 5),
    });
  }

  participantHistory(participantId: number): Observable<AccessBadgeAssignment[]> {
    return this.http.get<AccessBadgeAssignment[]>(`${this.base}/participants/${participantId}/history`);
  }

  assign(participantId: number, badgeCode: string, operationId: string, reason?: string): Observable<unknown> {
    return this.http.post(`${this.base}/assign`, { participantId, badgeCode, operationId, reason });
  }

  replace(participantId: number, newBadgeCode: string, operationId: string, reason?: string): Observable<unknown> {
    return this.http.post(`${this.base}/replace`, { participantId, newBadgeCode, operationId, reason });
  }
}

/** Déduit le mode du parcours : attribution simple ou remplacement d'un badge actif. */
export function deriveAssignMode(history: AccessBadgeAssignment[]): 'assign' | 'replace' {
  return history.some((a) => a.endsAt === null) ? 'replace' : 'assign';
}

/** Code du badge actuellement actif pour une personne, s'il existe. */
export function activeAssignmentOf(history: AccessBadgeAssignment[]): AccessBadgeAssignment | null {
  return history.find((a) => a.endsAt === null) ?? null;
}
