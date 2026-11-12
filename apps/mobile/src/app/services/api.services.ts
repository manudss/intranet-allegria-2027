import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LoginCredentials,
  LoginResponse,
  ProgramChangeLogEntry,
  ProgramDay,
  ShiftAssignment,
  TeamMembership,
  Teammate,
  UpdateMyVolunteerPayload,
  VolunteerHosting,
  User,
  Volunteer,
} from '../models/models';

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

@Injectable({ providedIn: 'root' })
export class ProgramApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/program';

  getDay(date: string): Observable<ProgramDay> {
    return this.http.get<ProgramDay>(`${this.base}/days/${date}`);
  }

  getChangeLog(date?: string): Observable<ProgramChangeLogEntry[]> {
    const options = date ? { params: new HttpParams().set('date', date) } : {};
    return this.http.get<ProgramChangeLogEntry[]>(`${this.base}/change-log`, options);
  }
}

@Injectable({ providedIn: 'root' })
export class MySpaceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/me';

  getVolunteer(): Observable<Volunteer> {
    return this.http.get<Volunteer>(`${this.base}/volunteer`);
  }

  getShiftAssignments(): Observable<ShiftAssignment[]> {
    return this.http.get<ShiftAssignment[]>(`${this.base}/shift-assignments`);
  }

  getTeamMemberships(): Observable<TeamMembership[]> {
    return this.http.get<TeamMembership[]>(`${this.base}/team-memberships`);
  }

  getTeammates(membershipId: number): Observable<Teammate[]> {
    return this.http.get<Teammate[]>(`${this.base}/team-memberships/${membershipId}/members`);
  }

  getHosting(): Observable<VolunteerHosting | null> {
    return this.http.get<VolunteerHosting | null>(`${this.base}/hosting`);
  }

  updateVolunteer(payload: UpdateMyVolunteerPayload): Observable<Volunteer> {
    return this.http.patch<Volunteer>(`${this.base}/volunteer`, payload);
  }
}
