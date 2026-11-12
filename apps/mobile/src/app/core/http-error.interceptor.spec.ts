import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TuiAlertService } from '@taiga-ui/core';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { httpErrorInterceptor } from './http-error.interceptor';

const run = (status: number, url = '/api/me/volunteer') => {
  const open = vi.fn().mockReturnValue(of(null));
  const navigateByUrl = vi.fn();
  const logout = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: AuthService, useValue: { logout } },
      { provide: Router, useValue: { navigateByUrl } },
      { provide: TuiAlertService, useValue: { open } },
    ],
  });
  let caught: HttpErrorResponse | null = null;
  TestBed.runInInjectionContext(() =>
    httpErrorInterceptor(new HttpRequest('GET', url), () =>
      throwError(() => new HttpErrorResponse({ status })),
    ),
  ).subscribe({ error: (error: HttpErrorResponse) => (caught = error) });
  return { open, navigateByUrl, logout, caught: caught as HttpErrorResponse | null };
};

describe('httpErrorInterceptor', () => {
  it('explique un 403 au lieu de rediriger silencieusement', () => {
    const { open, navigateByUrl, caught } = run(403);
    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0][1]).toMatchObject({ label: 'Accès refusé' });
    expect(navigateByUrl).toHaveBeenCalledWith('/');
    expect(caught?.status).toBe(403);
  });

  it('déconnecte sur 401 hors login, sans alerte', () => {
    const { open, logout } = run(401);
    expect(logout).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });

  it('ne fait rien de spécial sur une erreur serveur', () => {
    const { open, navigateByUrl, logout, caught } = run(500);
    expect(open).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(caught?.status).toBe(500);
  });
});
