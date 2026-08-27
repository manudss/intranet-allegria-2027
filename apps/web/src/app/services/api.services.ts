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
  SkillCount,
  Team,
  TeamParticipant,
  TeamParticipantRole,
  TeamPayload,
  User,
  Volunteer,
  VolunteerMission,
  VolunteerMissionPayload,
  VolunteerMissionStatus,
  VolunteerSkill,
  VolunteerSkillPayload,
  VolunteerSkillType,
  VolunteerShift,
  VolunteerShiftPayload,
  VolunteerShiftStatus,
  VolunteerTag,
  VolunteerTagPayload,
  VolunteerTeam,
  VolunteerTeamMembership,
  VolunteerTeamMembershipPayload,
  VolunteerTeamPayload,
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
  listFiltered(filters?: { skill?: VolunteerSkillType | null; tag?: string }): Observable<Volunteer[]> {
    let params = new HttpParams();
    if (filters?.skill) params = params.set('skill', filters.skill);
    if (filters?.tag) params = params.set('tag', filters.tag);
    return this.http.get<Volunteer[]>(this.path, { params });
  }
}
@Injectable({ providedIn: 'root' })
export class VolunteerSkillsApiService {
  private readonly http = inject(HttpClient);
  list(volunteerId: number): Observable<VolunteerSkill[]> {
    return this.http.get<VolunteerSkill[]>(`/api/volunteers/${volunteerId}/skills`);
  }
  add(volunteerId: number, payload: VolunteerSkillPayload): Observable<VolunteerSkill> {
    return this.http.post<VolunteerSkill>(`/api/volunteers/${volunteerId}/skills`, payload);
  }
  remove(volunteerId: number, skillId: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`/api/volunteers/${volunteerId}/skills/${skillId}`);
  }
  getCounts(): Observable<SkillCount[]> {
    return this.http.get<SkillCount[]>('/api/volunteer-skills/counts');
  }
}
@Injectable({ providedIn: 'root' })
export class VolunteerTagsApiService {
  private readonly http = inject(HttpClient);
  list(volunteerId: number): Observable<VolunteerTag[]> {
    return this.http.get<VolunteerTag[]>(`/api/volunteers/${volunteerId}/tags`);
  }
  add(volunteerId: number, payload: VolunteerTagPayload): Observable<VolunteerTag> {
    return this.http.post<VolunteerTag>(`/api/volunteers/${volunteerId}/tags`, payload);
  }
  remove(volunteerId: number, tagId: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`/api/volunteers/${volunteerId}/tags/${tagId}`);
  }
  getSuggestions(q?: string): Observable<string[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    return this.http.get<string[]>('/api/volunteer-tags/suggestions', { params });
  }
}
@Injectable({ providedIn: 'root' })
export class VolunteerTeamsApiService extends CrudApi<VolunteerTeam, VolunteerTeamPayload> {
  protected readonly path = '/api/volunteer-teams';
}
@Injectable({ providedIn: 'root' })
export class VolunteerTeamMembershipsApiService {
  private readonly http = inject(HttpClient);
  list(volunteerId: number) {
    return this.http.get<VolunteerTeamMembership[]>(`/api/volunteers/${volunteerId}/team-memberships`);
  }
  create(volunteerId: number, payload: VolunteerTeamMembershipPayload) {
    return this.http.post<VolunteerTeamMembership>(`/api/volunteers/${volunteerId}/team-memberships`, payload);
  }
  update(volunteerId: number, membershipId: number, payload: Partial<VolunteerTeamMembershipPayload>) {
    return this.http.patch<VolunteerTeamMembership>(
      `/api/volunteers/${volunteerId}/team-memberships/${membershipId}`,
      payload,
    );
  }
  delete(volunteerId: number, membershipId: number) {
    return this.http.delete<DeleteResponse>(`/api/volunteers/${volunteerId}/team-memberships/${membershipId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class VolunteerMissionsApiService extends CrudApi<VolunteerMission, VolunteerMissionPayload> {
  protected readonly path = '/api/volunteer-missions';

  listFiltered(filters?: {
    volunteerTeamId?: number | null;
    location?: string;
    date?: string;
    status?: VolunteerMissionStatus;
  }): Observable<VolunteerMission[]> {
    let params = new HttpParams();
    if (filters?.volunteerTeamId) params = params.set('volunteerTeamId', filters.volunteerTeamId);
    if (filters?.location) params = params.set('location', filters.location);
    if (filters?.date) params = params.set('date', filters.date);
    if (filters?.status) params = params.set('status', filters.status);
    return this.http.get<VolunteerMission[]>(this.path, { params });
  }

  changeStatus(id: number, status: VolunteerMissionStatus) {
    return this.http.patch<VolunteerMission>(`${this.path}/${id}/status`, { status });
  }

  listShifts(missionId: number) {
    return this.http.get<VolunteerShift[]>(`${this.path}/${missionId}/shifts`);
  }

  createShift(missionId: number, payload: VolunteerShiftPayload) {
    return this.http.post<VolunteerShift>(`${this.path}/${missionId}/shifts`, payload);
  }

  updateShift(missionId: number, shiftId: number, payload: Partial<VolunteerShiftPayload>) {
    return this.http.patch<VolunteerShift>(`${this.path}/${missionId}/shifts/${shiftId}`, payload);
  }

  changeShiftStatus(missionId: number, shiftId: number, status: VolunteerShiftStatus) {
    return this.http.patch<VolunteerShift>(`${this.path}/${missionId}/shifts/${shiftId}/status`, { status });
  }

  deleteShift(missionId: number, shiftId: number) {
    return this.http.delete<DeleteResponse>(`${this.path}/${missionId}/shifts/${shiftId}`);
  }

  getDayView(date: string) {
    const params = new HttpParams().set('date', date);
    return this.http.get<VolunteerShift[]>(`${this.path}/day-view`, { params });
  }
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
