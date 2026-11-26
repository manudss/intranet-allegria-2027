import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { GlobalAuthGuard } from './global-auth.guard';
import { AuthTokenGuard } from './auth-token.guard';
import { defaultEffectiveForRoles } from '../access-rights/access-defaults';
import { AccessRightsService } from '../access-rights/access-rights.service';
import { RoleGuard } from './role.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('GET /users/search passe par les vraies gardes HTTP', () => {
  it('suit la matrice de droits (ADMIN ou BADGES, portée tout) : custom accepté, révoqué refusé et transmet des paramètres bornés', async () => {
    const calls: unknown[] = [];
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        RoleGuard,
        {
          provide: AccessRightsService,
          useValue: {
            effective: async (_id: number, roles: string[]) => {
              // Cas matrice : droit personnalisé sans rôle littéral, droit révoqué malgré le rôle, portée partielle.
              if (roles.includes('CUSTOM'))
                return { BADGES: { pairs: [{ level: 'EDIT', scope: 'ALL' }] } } as never;
              if (roles.includes('READONLY'))
                return { BADGES: { pairs: [{ level: 'VIEW', scope: 'ALL' }] } } as never;
              if (roles.includes('REVOKED')) return {} as never;
              if (roles.includes('PARTIAL'))
                return { BADGES: { pairs: [{ level: 'VIEW', scope: 'GROUPS' }] } } as never;
              return defaultEffectiveForRoles(roles);
            },
          },
        },
        AuthTokenGuard,
        { provide: APP_GUARD, useClass: GlobalAuthGuard },
        {
          provide: AuthService,
          useValue: {
            resolveToken: async (token: string) =>
              [
                'ADMIN',
                'BADGE_MANAGER',
                'VIEWER',
                'CUSTOM',
                'REVOKED',
                'PARTIAL',
                'READONLY',
              ].includes(token)
                ? { id: 1, email: 'fiction@example.test', roles: [token] }
                : null,
          },
        },
        {
          provide: UsersService,
          useValue: {
            search: async (p: unknown) => {
              calls.push(p);
              return { items: [], total: 0, hasMore: false };
            },
            searchFilters: async () => ({ roles: [], teamTypes: [], teams: [], groups: [] }),
            findOne: () => ({ id: 1, passwordHash: 'hidden' }),
          },
        },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    try {
      expect((await fetch(`${url}/users/search?q=mar`)).status).toBe(401);
      const viewer = await fetch(`${url}/users/search?q=mar`, {
        headers: { Authorization: 'Bearer VIEWER' },
      });
      expect(viewer.status).toBe(403);
      expect(calls).toHaveLength(0);
      // Droit révoqué dans la matrice (rôle conservé) et portée partielle : refusés.
      for (const token of ['REVOKED', 'PARTIAL', 'READONLY']) {
        const res = await fetch(`${url}/users/search?q=mar`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status).toBe(403);
      }
      expect(calls).toHaveLength(0);
      for (const token of ['ADMIN', 'BADGE_MANAGER', 'CUSTOM']) {
        const res = await fetch(
          `${url}/users/search?q=mar&role=ADMIN&teamId=12&groupId=x&limit=5&offset=10`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ items: [], total: 0, hasMore: false });
      }
      // Même autorité pour les listes de filtres.
      for (const [token, status] of [
        ['CUSTOM', 200],
        ['ADMIN', 200],
        ['REVOKED', 403],
        ['READONLY', 403],
        ['PARTIAL', 403],
        ['VIEWER', 403],
      ] as const) {
        const res = await fetch(`${url}/users/search/filters`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status).toBe(status);
      }
      expect((await fetch(`${url}/users/search/filters`)).status).toBe(401);
      expect(calls[0]).toEqual({
        q: 'mar',
        role: 'ADMIN',
        teamType: undefined,
        teamId: 12,
        groupId: undefined,
        limit: 5,
        offset: 10,
      });
    } finally {
      await app.close();
    }
  });
});
