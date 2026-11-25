import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AccessRightsService } from '../access-rights/access-rights.service';
import {
  ACCESS_LEVEL_KEY,
  ACCESS_MODULE_KEY,
  GROUP_SCOPE_AWARE_KEY,
} from './access-module.decorator';
import { RoleGuard } from './role.guard';

type Grant = { module: string; level: string; scope: string; sources: string[] };

function run(opts: {
  method: string;
  grants: Grant[];
  aware?: boolean;
  level?: string;
  module?: string | null;
  groupIds?: number[];
  user?: { id: number; email: string; roles: string[] } | null;
}) {
  const meta: Record<string, unknown> = {
    [ACCESS_MODULE_KEY]: opts.module === null ? undefined : (opts.module ?? 'PARTICIPANTS'),
    [ACCESS_LEVEL_KEY]: opts.level,
    [GROUP_SCOPE_AWARE_KEY]: opts.aware,
  };
  const reflector = { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
  const rights = {
    effective: async () => Object.fromEntries(opts.grants.map((g) => [g.module, g])),
    groupIdsForUser: async () => opts.groupIds ?? [],
  } as unknown as AccessRightsService;
  const request: Record<string, unknown> = {
    method: opts.method,
    user:
      opts.user === undefined ? { id: 7, email: 'x@allegria.local', roles: ['VIEWER'] } : opts.user,
  };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
  const result = new RoleGuard(reflector, rights).canActivate(context);
  return { result: Promise.resolve(result), request };
}
const g = (level: string, scope = 'ALL'): Grant => ({
  module: 'PARTICIPANTS',
  level,
  scope,
  sources: ['ROLE:X'],
});

describe('RoleGuard avec la matrice de droits', () => {
  it('refuse par défaut quand aucune règle ne couvre le module', async () => {
    await expect(run({ method: 'GET', grants: [] }).result).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('déduit le niveau de la méthode HTTP', async () => {
    await expect(run({ method: 'GET', grants: [g('VIEW')] }).result).resolves.toBe(true);
    await expect(run({ method: 'PATCH', grants: [g('VIEW')] }).result).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(run({ method: 'PATCH', grants: [g('EDIT')] }).result).resolves.toBe(true);
    await expect(run({ method: 'POST', grants: [g('EDIT')] }).result).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(run({ method: 'DELETE', grants: [g('MANAGE')] }).result).resolves.toBe(true);
  });
  it('respecte un niveau imposé par la route', async () => {
    await expect(run({ method: 'POST', level: 'EDIT', grants: [g('EDIT')] }).result).resolves.toBe(
      true,
    );
  });
  it('refuse une portée partielle sur une route non prête (fermé par défaut)', async () => {
    for (const scope of ['GROUPS', 'OWN_TEAM', 'SELF']) {
      await expect(
        run({ method: 'GET', grants: [g('VIEW', scope)] }).result,
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
  it('accepte la portée groupes sur une route qui filtre, et expose la liste des groupes', async () => {
    const { result, request } = run({
      method: 'GET',
      aware: true,
      groupIds: [3, 4],
      grants: [g('VIEW', 'GROUPS')],
    });
    await expect(result).resolves.toBe(true);
    expect(request['accessScope']).toEqual({ all: false, groupIds: [3, 4] });
  });
  it('portée groupes sans aucun groupe : liste vide, jamais « tout »', async () => {
    const { result, request } = run({
      method: 'GET',
      aware: true,
      groupIds: [],
      grants: [g('VIEW', 'GROUPS')],
    });
    await expect(result).resolves.toBe(true);
    expect(request['accessScope']).toEqual({ all: false, groupIds: [] });
  });
  it('les autres portées restent refusées même sur une route qui filtre par groupes', async () => {
    await expect(
      run({ method: 'GET', aware: true, grants: [g('VIEW', 'OWN_TEAM')] }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('refuse sans utilisateur authentifié', async () => {
    await expect(
      run({ method: 'GET', user: null, grants: [g('VIEW')] }).result,
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('les routes sans module gardent l’ancien comportement @Roles', async () => {
    await expect(run({ method: 'GET', module: null, grants: [] }).result).resolves.toBe(true);
  });
});

describe('AccessRightsService.groupInScope', () => {
  it('applique la portée', () => {
    expect(AccessRightsService.groupInScope({ all: true }, null)).toBe(true);
    expect(AccessRightsService.groupInScope({ all: false, groupIds: [1] }, 1)).toBe(true);
    expect(AccessRightsService.groupInScope({ all: false, groupIds: [1] }, 2)).toBe(false);
    expect(AccessRightsService.groupInScope({ all: false, groupIds: [1] }, null)).toBe(false);
  });
});
