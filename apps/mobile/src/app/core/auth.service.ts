import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, of, tap } from 'rxjs';
import { LoginCredentials, User } from '../models/models';
import { AuthApiService } from '../services/api.services';

/** Rôles ouvrant l'accès à « Mon espace » : miroir de READ_ROLES dans
 * apps/api/src/app/core/my-space/my-space.controller.ts (sinon 403 côté API). */
export const MY_SPACE_ROLES = ['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS', 'VIEWER'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly tokenKey = 'allegria_access_token';
  private readonly userState = signal<User | null>(null);
  private readonly restoredState = signal(false);
  readonly currentUser = this.userState.asReadonly();
  readonly restored = this.restoredState.asReadonly();
  readonly isAuthenticated = computed(() => !!this.userState() && !!this.token);
  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }
  login(credentials: LoginCredentials) {
    return this.api.login(credentials).pipe(
      tap(({ accessToken, user }) => {
        localStorage.setItem(this.tokenKey, accessToken);
        this.setUser(user);
        this.restoredState.set(true);
      }),
    );
  }
  restoreSession() {
    if (this.restoredState()) return of(this.isAuthenticated());
    if (!this.token) {
      this.restoredState.set(true);
      return of(false);
    }
    return this.api.getCurrentUser().pipe(
      tap((user) => this.setUser(user)),
      map(() => true),
      catchError(() => {
        this.clear();
        return of(false);
      }),
      finalize(() => this.restoredState.set(true)),
    );
  }
  logout(redirect = true) {
    this.clear();
    if (redirect) void this.router.navigateByUrl('/login');
  }
  hasRole(role: string) {
    return this.userState()?.roles.includes(role) ?? false;
  }
  hasAnyRole(roles: string[]) {
    return roles.some((role) => this.hasRole(role));
  }
  private setUser(user: User | null) {
    this.userState.set(user);
  }
  private clear() {
    localStorage.removeItem(this.tokenKey);
    this.setUser(null);
  }
}
