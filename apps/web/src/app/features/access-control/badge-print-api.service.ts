import { firstValueFrom } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PrintCard } from './badge-print.logic';
import {
  JeunesRepartitionFilters,
  JeunesRepartitionParticipantRow,
  RepartitionVolunteerRow,
} from '../../models/models';
export interface PoolPerson {
  key: string;
  id: number;
  kind: 'participant' | 'volunteer';
  firstName: string;
  lastName: string | null;
  type: string;
  mejAgeGroup?: string | null;
  age?: number | null;
  sex?: string | null;
  groupName?: string | null;
  city?: string | null;
  teamName?: string | null;
  teamId?: number | null;
  poles?: string[];
}
export interface VolunteerPrintFilters {
  poles: { id: number; name: string }[];
  skills: string[];
  tags: string[];
}
export interface PrintPreparation {
  items: PrintCard[];
  created: number;
  reused: number;
}
@Injectable({ providedIn: 'root' })
export class BadgePrintApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/access-control/printing';
  youthFilters() {
    return this.http.get<JeunesRepartitionFilters>(`${this.base}/selection/participants/filters`);
  }
  volunteerFilters() {
    return this.http.get<VolunteerPrintFilters>(`${this.base}/selection/volunteers/filters`);
  }
  async people(
    kind: 'participant' | 'volunteer',
    filters: Record<string, unknown>,
  ): Promise<{ items: PoolPerson[]; total: number }> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters))
      if (value !== undefined && value !== null && value !== '')
        params = params.set(key, String(value));
    if (kind === 'participant') {
      const r = await firstValueFrom(
        this.http.get<{ participants: JeunesRepartitionParticipantRow[]; total: number }>(
          `${this.base}/selection/participants`,
          { params },
        ),
      );
      return {
        total: r.total,
        items: r.participants.map((p) => ({ ...p, key: `p:${p.id}`, kind: 'participant' })),
      };
    }
    const r = await firstValueFrom(
      this.http.get<{ volunteers: RepartitionVolunteerRow[]; total: number }>(
        `${this.base}/selection/volunteers`,
        { params },
      ),
    );
    return {
      total: r.total,
      items: r.volunteers.map((p) => ({
        ...p,
        key: `v:${p.id}`,
        kind: 'volunteer',
        type: 'BENEVOLE',
      })),
    };
  }
  preview(pool: PoolPerson[]) {
    return this.http.post<PrintPreparation>(
      `${this.base}/participants/preview`,
      this.selection(pool),
    );
  }
  prepare(pool: PoolPerson[]) {
    return this.http.post<PrintPreparation>(
      `${this.base}/participants/prepare`,
      this.selection(pool),
    );
  }
  private selection(pool: PoolPerson[]) {
    return {
      participantIds: pool.filter((p) => p.kind === 'participant').map((p) => p.id),
      volunteerIds: pool.filter((p) => p.kind === 'volunteer').map((p) => p.id),
    };
  }
}
