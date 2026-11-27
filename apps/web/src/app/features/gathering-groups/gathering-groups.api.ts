import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  GatheringBoard,
  GatheringCategory,
  GatheringFiche,
  GatheringProposal,
  GatheringRepartition,
  GatheringSequenceRef,
} from './gathering-groups.models';

@Injectable({ providedIn: 'root' })
export class GatheringGroupsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/gathering';

  list(date?: string): Observable<GatheringRepartition[]> {
    return this.http.get<GatheringRepartition[]>(
      `${this.base}/repartitions`,
      date ? { params: { date } } : undefined,
    );
  }
  createRepartition(body: { name: string; programSequenceId?: number | null; notes?: string | null }) {
    return this.http.post<{ id: number }>(`${this.base}/repartitions`, body);
  }
  updateRepartition(
    id: number,
    body: { name?: string; programSequenceId?: number | null; notes?: string | null; countAnimators?: boolean },
  ) {
    return this.http.patch(`${this.base}/repartitions/${id}`, body);
  }
  removeRepartition(id: number) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/repartitions/${id}`);
  }
  setOverflow(id: number, allowOverflow: boolean) {
    return this.http.put(`${this.base}/repartitions/${id}/overflow`, { allowOverflow });
  }
  duplicateRepartition(id: number, name?: string) {
    return this.http.post<{ id: number }>(`${this.base}/repartitions/${id}/duplicate`, { name });
  }
  linkSequence(groupId: number, sequenceId: number) {
    return this.http.put(`${this.base}/groups/${groupId}/sequences/${sequenceId}`, {});
  }

  unlinkSequence(groupId: number, sequenceId: number) {
    return this.http.delete(`${this.base}/groups/${groupId}/sequences/${sequenceId}`);
  }

  sequenceOptions(): Observable<GatheringSequenceRef[]> {
    return this.http.get<GatheringSequenceRef[]>(`${this.base}/sequences`);
  }

  forSequence(sequenceId: number): Observable<GatheringRepartition[]> {
    return this.http.get<GatheringRepartition[]>(`${this.base}/sequences/${sequenceId}/repartitions`);
  }

  board(repartitionId: number): Observable<GatheringBoard> {
    return this.http.get<GatheringBoard>(`${this.base}/repartitions/${repartitionId}/board`);
  }
  propose(repartitionId: number): Observable<GatheringProposal> {
    return this.http.post<GatheringProposal>(`${this.base}/repartitions/${repartitionId}/propose`, {});
  }
  apply(repartitionId: number, assignments: { teamId: number; groupId: number | null }[]) {
    return this.http.post<{ applied: number }>(`${this.base}/repartitions/${repartitionId}/apply`, {
      assignments,
    });
  }

  createGroup(
    repartitionId: number,
    body: {
      name: string;
      category?: GatheringCategory;
      capacityPersons?: number | null;
      location?: string | null;
    },
  ) {
    return this.http.post<{ id: number }>(`${this.base}/repartitions/${repartitionId}/groups`, body);
  }
  updateGroup(
    id: number,
    body: Partial<{
      name: string;
      category: GatheringCategory;
      capacityPersons: number | null;
      location: string | null;
      hostingGroupId: number | null;
      documentLinkId: number | null;
      notes: string | null;
    }>,
  ) {
    return this.http.patch(`${this.base}/groups/${id}`, body);
  }
  removeGroup(id: number) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/groups/${id}`);
  }
  fiche(id: number): Observable<GatheringFiche> {
    return this.http.get<GatheringFiche>(`${this.base}/groups/${id}`);
  }
  assignTeam(groupId: number, teamId: number) {
    return this.http.put(`${this.base}/groups/${groupId}/teams/${teamId}`, {});
  }
  unassignTeam(groupId: number, teamId: number) {
    return this.http.delete(`${this.base}/groups/${groupId}/teams/${teamId}`);
  }
  attachVolunteerTeam(groupId: number, volunteerTeamId: number) {
    return this.http.put(`${this.base}/groups/${groupId}/volunteer-teams/${volunteerTeamId}`, {});
  }
  detachVolunteerTeam(groupId: number, volunteerTeamId: number) {
    return this.http.delete(`${this.base}/groups/${groupId}/volunteer-teams/${volunteerTeamId}`);
  }
  setManagers(groupId: number, userIds: number[]) {
    return this.http.put(`${this.base}/groups/${groupId}/managers`, { userIds });
  }
}
