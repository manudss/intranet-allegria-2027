import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AssignmentPayload,
  BenevoleAssignment,
  ApplyRepartitionEntry,
  ApplyRepartitionResult,
  RepartitionFilters,
  RepartitionTeamRow,
  RepartitionVolunteersResult,
  DashboardGlobalSummary,
  DashboardLocationRow,
  DashboardTeamSummary,
  DashboardTodoList,
  DashboardWhoDoesWhatResult,
  DeleteResponse,
  Group,
  GroupPayload,
  ApplyJeunesRepartitionEntry,
  ApplyJeunesRepartitionResult,
  BulkCreateTeamsResult,
  JeunesRepartitionFilters,
  JeunesRepartitionParams,
  JeunesRepartitionParticipantsResult,
  JeunesRepartitionTeamRow,
  ProposeJeunesRepartitionResult,
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
  ProgramChangeLogEntry,
  ProgramDay,
  ProgramInsertPreview,
  ProgramResizePreview,
  ProgramSequenceCreatePayload,
  ProgramSequenceUpdatePayload,
  ProgramSequence,
  ProgramSequenceDiff,
  ProgramSequenceDraft,
  SkillCount,
  StatusCounters,
  Team,
  TeamParticipant,
  TeamParticipantRole,
  TeamPayload,
  User,
  VolunteerAuditAction,
  VolunteerAuditLogSearchParams,
  VolunteerAuditLogSearchResult,
  Volunteer,
  VolunteerMission,
  VolunteerMissionPayload,
  VolunteerMissionStatus,
  VolunteerMissionStatusPayload,
  VolunteerSkill,
  VolunteerSkillPayload,
  VolunteerSkillType,
  VolunteerShift,
  VolunteerShiftAssignment,
  VolunteerShiftAssignmentPayload,
  VolunteerShiftAssignmentSearchParams,
  VolunteerShiftAssignmentStatus,
  VolunteerShiftAssignmentStatusPayload,
  VolunteerShiftAssignmentVolunteerSearchResult,
  VolunteerShiftPayload,
  VolunteerShiftStatus,
  VolunteerShiftStatusPayload,
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
  search(filters: {
    unassignedOnly?: boolean;
    type?: PersonType | null;
    teamId?: number | null;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '')
        params = params.set(key, String(value));
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
  listFiltered(filters?: {
    skill?: VolunteerSkillType | null;
    tag?: string;
  }): Observable<Volunteer[]> {
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
    return this.http.get<VolunteerTeamMembership[]>(
      `/api/volunteers/${volunteerId}/team-memberships`,
    );
  }
  create(volunteerId: number, payload: VolunteerTeamMembershipPayload) {
    return this.http.post<VolunteerTeamMembership>(
      `/api/volunteers/${volunteerId}/team-memberships`,
      payload,
    );
  }
  update(
    volunteerId: number,
    membershipId: number,
    payload: Partial<VolunteerTeamMembershipPayload>,
  ) {
    return this.http.patch<VolunteerTeamMembership>(
      `/api/volunteers/${volunteerId}/team-memberships/${membershipId}`,
      payload,
    );
  }
  delete(volunteerId: number, membershipId: number) {
    return this.http.delete<DeleteResponse>(
      `/api/volunteers/${volunteerId}/team-memberships/${membershipId}`,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class VolunteerMissionsApiService extends CrudApi<
  VolunteerMission,
  VolunteerMissionPayload
> {
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

  changeStatus(id: number, payload: VolunteerMissionStatusPayload) {
    return this.http.patch<VolunteerMission>(`${this.path}/${id}/status`, payload);
  }

  getStatusCounters(): Observable<StatusCounters> {
    return this.http.get<StatusCounters>(`${this.path}/summary/counters`);
  }

  listShiftsByStatus(
    status: VolunteerShiftStatus,
    mandatory?: boolean,
  ): Observable<VolunteerShift[]> {
    let params = new HttpParams();
    if (mandatory !== undefined) params = params.set('mandatory', String(mandatory));
    return this.http.get<VolunteerShift[]>(`${this.path}/shifts/by-status/${status}`, { params });
  }

  listMissionsByStatus(
    status: VolunteerMissionStatus,
    mandatory?: boolean,
  ): Observable<VolunteerMission[]> {
    let params = new HttpParams();
    if (mandatory !== undefined) params = params.set('mandatory', String(mandatory));
    return this.http.get<VolunteerMission[]>(`${this.path}/missions/by-status/${status}`, {
      params,
    });
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

  changeShiftStatus(missionId: number, shiftId: number, payload: VolunteerShiftStatusPayload) {
    return this.http.patch<VolunteerShift>(
      `${this.path}/${missionId}/shifts/${shiftId}/status`,
      payload,
    );
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
export class VolunteerShiftAssignmentsApiService {
  private readonly http = inject(HttpClient);

  searchVolunteers(params: VolunteerShiftAssignmentSearchParams) {
    let query = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query = query.set(key, String(value));
      }
    });
    return this.http.get<VolunteerShiftAssignmentVolunteerSearchResult[]>(
      '/api/volunteer-shift-assignments/volunteer-search',
      {
        params: query,
      },
    );
  }

  listForShift(missionId: number, shiftId: number, status?: VolunteerShiftAssignmentStatus) {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<VolunteerShiftAssignment[]>(
      `/api/volunteer-missions/${missionId}/shifts/${shiftId}/assignments`,
      {
        params,
      },
    );
  }

  create(missionId: number, shiftId: number, payload: VolunteerShiftAssignmentPayload) {
    return this.http.post<VolunteerShiftAssignment>(
      `/api/volunteer-missions/${missionId}/shifts/${shiftId}/assignments`,
      payload,
    );
  }

  changeStatus(
    missionId: number,
    shiftId: number,
    assignmentId: number,
    payload: VolunteerShiftAssignmentStatusPayload,
  ) {
    return this.http.patch<VolunteerShiftAssignment>(
      `/api/volunteer-missions/${missionId}/shifts/${shiftId}/assignments/${assignmentId}/status`,
      payload,
    );
  }

  cancel(missionId: number, shiftId: number, assignmentId: number, notes?: string | null) {
    return this.http.post<VolunteerShiftAssignment>(
      `/api/volunteer-missions/${missionId}/shifts/${shiftId}/assignments/${assignmentId}/cancel`,
      { notes: notes ?? null },
    );
  }

  listVolunteerPlanning(volunteerId: number, status?: VolunteerShiftAssignmentStatus) {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<VolunteerShiftAssignment[]>(
      `/api/volunteers/${volunteerId}/shift-assignments`,
      { params },
    );
  }
}

@Injectable({ providedIn: 'root' })
export class VolunteerAuditLogsApiService {
  private readonly http = inject(HttpClient);

  list(params: VolunteerAuditLogSearchParams): Observable<VolunteerAuditLogSearchResult> {
    let query = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query = query.set(key, String(value));
      }
    });

    return this.http.get<VolunteerAuditLogSearchResult>('/api/volunteer-audit-logs', {
      params: query,
    });
  }

  getActionOptions(): readonly VolunteerAuditAction[] {
    return Object.values(VolunteerAuditAction);
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
export class TeamBenevolesApiService {
  private readonly http = inject(HttpClient);
  /** Toutes les affectations bénévoles → équipes (page de répartition). */
  listAssignments(): Observable<BenevoleAssignment[]> {
    return this.http.get<BenevoleAssignment[]>('/api/benevoles/assignments');
  }
  listForTeam(teamId: number): Observable<BenevoleAssignment[]> {
    return this.http.get<BenevoleAssignment[]>(`/api/teams/${teamId}/benevoles`);
  }
  assign(teamId: number, volunteerId: number): Observable<BenevoleAssignment> {
    return this.http.post<BenevoleAssignment>(`/api/teams/${teamId}/benevoles`, { volunteerId });
  }
  unassign(teamId: number, volunteerId: number) {
    return this.http.delete<DeleteResponse>(`/api/teams/${teamId}/benevoles/${volunteerId}`);
  }

  // ── Page de répartition bénévoles → équipes ──────────────────────────────
  repartitionFilters(): Observable<RepartitionFilters> {
    return this.http.get<RepartitionFilters>('/api/benevoles/repartition/filters');
  }
  repartitionTeams(query: {
    search?: string;
    hostingGroupId?: number | null;
    groupId?: number | null;
    fill?: 'all' | 'free' | 'full';
  } = {}): Observable<RepartitionTeamRow[]> {
    return this.http.get<RepartitionTeamRow[]>('/api/benevoles/repartition/teams', {
      params: repartitionParams(query),
    });
  }
  repartitionVolunteers(query: {
    search?: string;
    skill?: string;
    tag?: string;
    poleId?: number | null;
    assignment?: 'all' | 'unassigned' | 'assigned';
    limit?: number;
    offset?: number;
  } = {}): Observable<RepartitionVolunteersResult> {
    return this.http.get<RepartitionVolunteersResult>('/api/benevoles/repartition/volunteers', {
      params: repartitionParams(query),
    });
  }
  applyRepartition(assignments: ApplyRepartitionEntry[]): Observable<ApplyRepartitionResult> {
    return this.http.post<ApplyRepartitionResult>('/api/benevoles/repartition/apply', { assignments });
  }
}
@Injectable({ providedIn: 'root' })
export class JeunesRepartitionApiService {
  private readonly http = inject(HttpClient);

  repartitionFilters(): Observable<JeunesRepartitionFilters> {
    return this.http.get<JeunesRepartitionFilters>('/api/jeunes/repartition/filters');
  }

  participants(
    query: {
      search?: string;
      type?: 'all' | 'JEUNE' | 'ANIMATEUR';
      ageGroup?: string;
      sex?: string;
      groupId?: number | null;
      city?: string;
      diocese?: string;
      assignment?: 'all' | 'unassigned' | 'assigned';
      limit?: number;
      offset?: number;
    } = {},
  ): Observable<JeunesRepartitionParticipantsResult> {
    return this.http.get<JeunesRepartitionParticipantsResult>('/api/jeunes/repartition/participants', {
      params: repartitionParams(query),
    });
  }

  repartitionTeams(
    query: {
      search?: string;
      groupId?: number | null;
      fill?: 'all' | 'free' | 'full';
    } = {},
  ): Observable<JeunesRepartitionTeamRow[]> {
    return this.http.get<JeunesRepartitionTeamRow[]>('/api/jeunes/repartition/teams', {
      params: repartitionParams(query),
    });
  }

  bulkCreateTeams(query: {
    count: number;
    baseName?: string;
    maxSize?: number;
  }): Observable<BulkCreateTeamsResult> {
    return this.http.post<BulkCreateTeamsResult>('/api/jeunes/repartition/teams/bulk-create', query);
  }

  propose(
    participantIds: number[],
    teamIds: number[],
    params: Partial<JeunesRepartitionParams>,
  ): Observable<ProposeJeunesRepartitionResult> {
    return this.http.post<ProposeJeunesRepartitionResult>('/api/jeunes/repartition/propose', {
      participantIds,
      teamIds,
      params,
    });
  }

  apply(assignments: ApplyJeunesRepartitionEntry[]): Observable<ApplyJeunesRepartitionResult> {
    return this.http.post<ApplyJeunesRepartitionResult>('/api/jeunes/repartition/apply', { assignments });
  }
}

/** Paramètres de requête : ignore les valeurs vides/null. */
function repartitionParams(query: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '' && value !== 'all') {
      params[key] = String(value);
    }
  }
  return params;
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

// ─── Tableau de bord opérationnel Jour J ─────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OperationalDashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/operational-dashboard';

  private params(filters?: Record<string, string | number | undefined | null>): HttpParams {
    let p = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
      });
    }
    return p;
  }

  getGlobalSummary(
    date?: string,
    volunteerTeamId?: number | null,
  ): Observable<DashboardGlobalSummary> {
    return this.http.get<DashboardGlobalSummary>(`${this.base}/global`, {
      params: this.params({ date, volunteerTeamId }),
    });
  }

  getTeamsSummary(
    date?: string,
    volunteerTeamId?: number | null,
  ): Observable<DashboardTeamSummary[]> {
    return this.http.get<DashboardTeamSummary[]>(`${this.base}/teams`, {
      params: this.params({ date, volunteerTeamId }),
    });
  }

  getLocationsSummary(
    date?: string,
    volunteerTeamId?: number | null,
  ): Observable<DashboardLocationRow[]> {
    return this.http.get<DashboardLocationRow[]>(`${this.base}/locations`, {
      params: this.params({ date, volunteerTeamId }),
    });
  }

  getWhoDoesWhat(options: {
    date?: string;
    volunteerTeamId?: number | null;
    q?: string;
    page?: number;
    limit?: number;
  }): Observable<DashboardWhoDoesWhatResult> {
    return this.http.get<DashboardWhoDoesWhatResult>(`${this.base}/who-does-what`, {
      params: this.params({ ...options }),
    });
  }

  getTodoList(date?: string, volunteerTeamId?: number | null): Observable<DashboardTodoList> {
    return this.http.get<DashboardTodoList>(`${this.base}/todo`, {
      params: this.params({ date, volunteerTeamId }),
    });
  }

  exportOperationalData(
    kind:
      | 'global-planning'
      | 'team-planning'
      | 'volunteer-planning'
      | 'location-planning'
      | 'confirmed-assignments'
      | 'provisional-assignments'
      | 'unfilled-shifts'
      | 'unfinished-missions',
    options: {
      format: 'xlsx' | 'print' | 'pdf';
      date?: string;
      dateFrom?: string;
      dateTo?: string;
      volunteerTeamId?: number | null;
      volunteerId?: number | null;
      location?: string | null;
      missionStatus?: string | null;
      shiftStatus?: string | null;
      assignmentStatus?: string | null;
    },
  ): Observable<Blob> {
    return this.http.get(`${this.base}/exports/${kind}`, {
      params: this.params({ ...options }),
      responseType: 'blob',
    });
  }
}

@Injectable({ providedIn: 'root' })
export class ProgramApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/program';

  getDay(date: string): Observable<ProgramDay> {
    return this.http.get<ProgramDay>(`${this.base}/days/${date}`);
  }

  previewInsert(
    afterSequenceId: number,
    draft: ProgramSequenceDraft,
  ): Observable<ProgramInsertPreview> {
    return this.http.post<ProgramInsertPreview>(
      `${this.base}/sequences/${afterSequenceId}/insert-after/preview`,
      draft,
    );
  }

  applyInsert(
    afterSequenceId: number,
    draft: ProgramSequenceDraft,
    version: string,
  ): Observable<{ sequence: ProgramSequence; affected: ProgramSequenceDiff[] }> {
    return this.http.post<{ sequence: ProgramSequence; affected: ProgramSequenceDiff[] }>(
      `${this.base}/sequences/${afterSequenceId}/insert-after/apply`,
      { ...draft, version },
    );
  }

  previewResize(sequenceId: number, durationMinutes: number): Observable<ProgramResizePreview> {
    return this.http.patch<ProgramResizePreview>(
      `${this.base}/sequences/${sequenceId}/resize/preview`,
      {
        durationMinutes,
      },
    );
  }

  applyResize(
    sequenceId: number,
    durationMinutes: number,
    version: string,
  ): Observable<{ affected: ProgramSequenceDiff[] }> {
    return this.http.patch<{ affected: ProgramSequenceDiff[] }>(
      `${this.base}/sequences/${sequenceId}/resize/apply`,
      { durationMinutes, version },
    );
  }

  freeze(sequenceId: number): Observable<ProgramSequence> {
    return this.http.patch<ProgramSequence>(`${this.base}/sequences/${sequenceId}/freeze`, {});
  }

  unfreeze(sequenceId: number): Observable<ProgramSequence> {
    return this.http.patch<ProgramSequence>(`${this.base}/sequences/${sequenceId}/unfreeze`, {});
  }

  createSequence(payload: ProgramSequenceCreatePayload): Observable<ProgramSequence> {
    return this.http.post<ProgramSequence>(`${this.base}/sequences`, payload);
  }

  updateSequence(
    sequenceId: number,
    payload: ProgramSequenceUpdatePayload,
  ): Observable<ProgramSequence> {
    return this.http.patch<ProgramSequence>(`${this.base}/sequences/${sequenceId}`, payload);
  }

  deleteSequence(sequenceId: number, closeGap = false): Observable<{ deletedId: number; shiftedMinutes: number }> {
    const params = closeGap ? new HttpParams().set('closeGap', 'true') : new HttpParams();
    return this.http.delete<{ deletedId: number; shiftedMinutes: number }>(
      `${this.base}/sequences/${sequenceId}`,
      { params },
    );
  }

  getChangeLog(date?: string): Observable<ProgramChangeLogEntry[]> {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<ProgramChangeLogEntry[]>(`${this.base}/change-log`, { params });
  }
}
