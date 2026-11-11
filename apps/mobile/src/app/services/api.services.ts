import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LoginCredentials,
  LoginResponse,
  ProgramChangeLogEntry,
  ProgramDay,
  User,
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
