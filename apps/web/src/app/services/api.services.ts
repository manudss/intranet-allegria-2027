import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AssignmentPayload,
  DeleteResponse,
  Group,
  GroupPayload,
  HostFamily,
  HostFamilyPayload,
  LoginCredentials,
  LoginResponse,
  Participant,
  ParticipantHealth,
  ParticipantHealthPayload,
  ParticipantHostFamilyAssignment,
  ParticipantPayload,
  ParticipantSearchResult,
  PersonType,
  Team,
  TeamParticipant,
  TeamParticipantRole,
  TeamPayload,
  User,
  Volunteer,
  VolunteerPayload,
} from '../models/models';

@Injectable()
abstract class CrudApi<T, P> {
  protected abstract readonly path: string;
  protected readonly http = inject(HttpClient);
  list(): Observable<T[]> {
    return this.http.get<T[]>(this.path);
  }
  get(id: number): Observable<T> {
    return this.http.get<T>(`${this.path}/${id}`);
  }
  create(payload: P): Observable<T> {
    return this.http.post<T>(this.path, payload);
  }
  update(id: number, payload: Partial<P>): Observable<T> {
    return this.http.patch<T>(`${this.path}/${id}`, payload);
  }
  delete(id: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${this.path}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ParticipantsApiService extends CrudApi<Participant, ParticipantPayload> {
  protected readonly path = '/api/participants';
  getParticipants(filters?: { groupId?: number; diocese?: string }): Observable<Participant[]> {
    let params = new HttpParams();
    if (filters?.groupId) params = params.set('groupId', filters.groupId);
    if (filters?.diocese) params = params.set('diocese', filters.diocese);
    return this.http.get<Participant[]>(this.path, { params });
  }
  getParticipant(id: number) {
    return this.get(id);
  }
  createParticipant(payload: ParticipantPayload) {
    return this.create(payload);
  }
  updateParticipant(id: number, payload: Partial<ParticipantPayload>) {
    return this.update(id, payload);
  }
  deleteParticipant(id: number) {
    return this.delete(id);
  }
  search(filters: { unassignedOnly?: boolean; type?: PersonType | null; teamId?: number | null; q?: string; limit?: number; offset?: number }) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<ParticipantSearchResult>(`${this.path}/search`, { params });
  }
}
@Injectable({ providedIn: 'root' })
export class GroupsApiService extends CrudApi<Group, GroupPayload> {
  protected readonly path = '/api/groups';
  getParticipants(id: number) {
    return this.http.get<Participant[]>(`${this.path}/${id}/participants`);
  }
  getTeams(id: number) {
    return this.http.get<Team[]>(`${this.path}/${id}/teams`);
  }
}
@Injectable({ providedIn: 'root' })
export class VolunteersApiService extends CrudApi<Volunteer, VolunteerPayload> {
  protected readonly path = '/api/volunteers';
}
@Injectable({ providedIn: 'root' })
export class TeamsApiService extends CrudApi<Team, TeamPayload> {
  protected readonly path = '/api/teams';
  getParticipants(id: number) {
    return this.http.get<Participant[]>(`${this.path}/${id}/participants`);
  }
}
@Injectable({ providedIn: 'root' })
export class TeamParticipantsApiService {
  private readonly http = inject(HttpClient);
  add(
    teamId: number,
    participantId: number,
    role: TeamParticipantRole = TeamParticipantRole.MEMBER,
    notes: string | null = null,
  ) {
    return this.http.post<TeamParticipant>(`/api/teams/${teamId}/participants`, {
      participantId,
      role,
      notes,
    });
  }
  remove(teamId: number, participantId: number) {
    return this.http.delete<DeleteResponse>(`/api/teams/${teamId}/participants/${participantId}`);
  }
}
@Injectable({ providedIn: 'root' })
export class HostFamiliesApiService extends CrudApi<HostFamily, HostFamilyPayload> {
  protected readonly path = '/api/host-families';
  getAssignments(id: number) {
    return this.http.get<ParticipantHostFamilyAssignment[]>(`${this.path}/${id}/assignments`);
  }
}
@Injectable({ providedIn: 'root' })
export class AssignmentsApiService extends CrudApi<
  ParticipantHostFamilyAssignment,
  AssignmentPayload
> {
  protected readonly path = '/api/assignments';
}
@Injectable({ providedIn: 'root' })
export class HealthApiService {
  private readonly http = inject(HttpClient);
  getParticipantHealth(id: number) {
    return this.http.get<ParticipantHealth | null>(`/api/participants/${id}/health`);
  }
  updateParticipantHealth(id: number, payload: ParticipantHealthPayload) {
    return this.http.patch<ParticipantHealth>(`/api/participants/${id}/health`, payload);
  }
}
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  login(credentials: LoginCredentials) {
    return this.http.post<LoginResponse>('/api/auth/login', credentials);
  }
  getCurrentUser() {
    return this.http.get<User>('/api/users/me');
  }
}
