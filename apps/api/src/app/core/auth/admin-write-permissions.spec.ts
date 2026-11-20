import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { GlobalAuthGuard } from './global-auth.guard';
import { AuthTokenGuard } from './auth-token.guard';
import { RoleGuard } from './role.guard';
import { RolesController } from './roles.controller';
import { UsersController } from './users.controller';
import { RolesService } from './roles.service';
import { UsersService } from './users.service';
describe('Administrative mutations require ADMIN through the real HTTP guards', () => {
  it('rejects anonymous and ordinary users, allows ADMIN, preserves ordinary reads and self lookup', async () => {
    let writes = 0;
    const write = () => {
      writes++;
      return { id: 1, passwordHash: 'never-return-this' };
    };
    const module = await Test.createTestingModule({
      controllers: [RolesController, UsersController],
      providers: [
        RoleGuard,
        AuthTokenGuard,
        { provide: APP_GUARD, useClass: GlobalAuthGuard },
        {
          provide: AuthService,
          useValue: {
            resolveToken: async (token: string) =>
              ['ADMIN', 'VIEWER'].includes(token)
                ? { id: 1, email: 'fiction@example.test', roles: [token] }
                : null,
          },
        },
        {
          provide: RolesService,
          useValue: { create: write, assignRole: write, unassignRole: write, findAll: () => [] },
        },
        {
          provide: UsersService,
          useValue: {
            create: write,
            update: write,
            findAll: () => [],
            findOne: () => ({ id: 1, passwordHash: 'hidden' }),
          },
        },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    try {
      for (const [route, method] of [
        ['/roles', 'POST'],
        ['/roles/users/1/1', 'POST'],
        ['/roles/users/1/1', 'DELETE'],
        ['/users', 'POST'],
        ['/users/1', 'PATCH'],
      ]) {
        const before = writes;
        expect((await fetch(url + route, { method })).status).toBe(401);
        expect(
          (await fetch(url + route, { method, headers: { Authorization: 'Bearer VIEWER' } }))
            .status,
        ).toBe(403);
        expect(writes).toBe(before);
        const allowed = await fetch(url + route, {
          method,
          headers: { Authorization: 'Bearer ADMIN' },
        });
        expect(allowed.status).toBe(method === 'POST' ? 201 : 200);
        if (route.startsWith('/users')) expect(await allowed.text()).not.toContain('passwordHash');
        expect(writes).toBe(before + 1);
      }
      for (const route of ['/roles', '/users', '/users/1', '/users/me']) {
        const res = await fetch(url + route, { headers: { Authorization: 'Bearer VIEWER' } });
        expect(res.status).toBe(200);
        expect(await res.text()).not.toContain('passwordHash');
      }
    } finally {
      await app.close();
    }
  });
});
