import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { httpErrorInterceptor } from './http-error.interceptor';
import { NoticeService } from './notice.service';

const run = (status: number, url = '/api/me/volunteer') => {
  const show = vi.fn();
  const navigateByUrl = vi.fn();
  const logout = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: AuthService, useValue: { logout } },
      { provide: Router, useValue: { navigateByUrl } },
      { provide: NoticeService, useValue: { show } },
    ],
  });
  let caught: HttpErrorResponse | null = null;
  TestBed.runInInjectionContext(() =>
    httpErrorInterceptor(new HttpRequest('GET', url), () =>
      throwError(() => new HttpErrorResponse({ status })),
    ),
  ).subscribe({ error: (error: HttpErrorResponse) => (caught = error) });
  return { show, navigateByUrl, logout, caught: caught as HttpErrorResponse | null };
};

describe('httpErrorInterceptor', () => {
  it('explique un 403 au lieu de rediriger silencieusement', () => {
    const { show, navigateByUrl, caught } = run(403);
    expect(show).toHaveBeenCalledOnce();
    expect(show.mock.calls[0][0]).toMatchObject({ label: 'Accès refusé', kind: 'error' });
    expect(navigateByUrl).toHaveBeenCalledWith('/');
    expect(caught?.status).toBe(403);
  });

  it('déconnecte sur 401 hors login, sans alerte', () => {
    const { show, logout } = run(401);
    expect(logout).toHaveBeenCalledOnce();
    expect(show).not.toHaveBeenCalled();
  });

  it('ne fait rien de spécial sur une erreur serveur', () => {
    const { show, navigateByUrl, logout, caught } = run(500);
    expect(show).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(caught?.status).toBe(500);
  });
});
