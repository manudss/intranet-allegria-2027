import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService — frontière de déconnexion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('purge les caches de données du service worker à la déconnexion', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('caches', {
      keys: async () => [
        'ngsw:1:api-program:data:dynamic',
        'ngsw:1:api-public-program:data:dynamic',
        'ngsw:1:assets:content:cache',
      ],
      delete: async (key: string) => {
        deleted.push(key);
        return true;
      },
    });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
    const auth = TestBed.inject(AuthService);
    localStorage.setItem('allegria_access_token', 'token');

    auth.logout(false);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(localStorage.getItem('allegria_access_token')).toBeNull();
    expect(deleted).toEqual([
      'ngsw:1:api-program:data:dynamic',
      'ngsw:1:api-public-program:data:dynamic',
    ]);
  });

  it('ne casse pas la déconnexion sans service worker', () => {
    vi.stubGlobal('caches', undefined);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
    const auth = TestBed.inject(AuthService);
    expect(() => auth.logout(false)).not.toThrow();
    expect(localStorage.getItem('allegria_access_token')).toBeNull();
  });
});
