import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AutoPlaceResult, Board, HostingGroup, PlaceResult, PlacementRules } from './hosting-placement.models';

@Injectable({ providedIn: 'root' })
export class HostingPlacementApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/hosting';

  board(): Observable<Board> {
    return this.http.get<Board>(`${this.base}/board`);
  }
  createGroup(name: string): Observable<HostingGroup> {
    return this.http.post<HostingGroup>(`${this.base}/groups`, { name });
  }
  renameGroup(id: number, name: string): Observable<HostingGroup> {
    return this.http.patch<HostingGroup>(`${this.base}/groups/${id}`, { name });
  }
  deleteGroup(id: number) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/groups/${id}`);
  }
  setTeamGroup(teamId: number, hostingGroupId: number | null) {
    return this.http.put<{ teamId: number; hostingGroupId: number | null }>(
      `${this.base}/teams/${teamId}/group`,
      { hostingGroupId },
    );
  }
  setFamilyGroup(familyId: number, hostingGroupId: number | null) {
    return this.http.put<{ familyId: number; hostingGroupId: number | null }>(
      `${this.base}/families/${familyId}/group`,
      { hostingGroupId },
    );
  }
  place(body: {
    participantId: number;
    hostFamilyId: number;
    arrivalDate?: string;
    departureDate?: string;
    replaceExisting?: boolean;
    rules?: PlacementRules;
  }): Observable<PlaceResult> {
    return this.http.post<PlaceResult>(`${this.base}/placements`, body);
  }
  unplace(participantId: number) {
    return this.http.delete<{ removed: number }>(`${this.base}/placements/${participantId}`);
  }
  autoPlace(
    groupId: number,
    body: { arrivalDate: string; departureDate: string; apply: boolean; rules: PlacementRules },
  ): Observable<AutoPlaceResult> {
    return this.http.post<AutoPlaceResult>(`${this.base}/groups/${groupId}/auto-place`, body);
  }
}
