import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { APP_GUARD } from '@nestjs/core';
import { GlobalAuthGuard } from '../auth/global-auth.guard';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { AuthService } from '../auth/auth.service';
import { RolesController } from '../auth/roles.controller';
import { UsersController } from '../auth/users.controller';
import { RolesService } from '../auth/roles.service';
import { UsersService } from '../auth/users.service';
import { RoleGuard } from '../auth/role.guard';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { INestApplication } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { FamilyRegistration1790600000000 } from '../../../database/migrations/1790600000000-FamilyRegistration';
import {
  FamilyRegistrationController,
  FamilyRegistrationStaffController,
  FamilyHealthStaffController,
  CateringNeedsController,
} from './family-registration.controller';
import { FamilyRegistrationService, digest } from './family-registration.service';
import { RegistrationHealthService } from './registration-health.service';
import { RegistrationDocumentsService } from './registration-documents.service';
import { EMPTY_CONTACT } from '@mej-allegria/shared';
describe('Family HTTP contract with disposable real SQL storage, no mail sent', () => {
  let app: INestApplication, pg: PGlite, url: string, service: FamilyRegistrationService;
  beforeEach(async () => {
    pg = new PGlite();
    await new FamilyRegistration1790600000000().up({
      query: (sql: string) => pg.exec(sql),
    } as never);
    const query = async (sql: string, params: unknown[] = []) => (await pg.query(sql, params)).rows;
    const db = {
      query,
      transaction: async (fn: (m: unknown) => unknown) => {
        await pg.exec('BEGIN');
        try {
          const result = await fn({ query });
          await pg.exec('COMMIT');
          return result;
        } catch (e) {
          await pg.exec('ROLLBACK');
          throw e;
        }
      },
    };
    service = new FamilyRegistrationService(db as never, { get: () => undefined } as never);
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 120 }])],
      controllers: [
        RolesController,
        UsersController,
        FamilyRegistrationController,
        FamilyRegistrationStaffController,
        FamilyHealthStaffController,
        CateringNeedsController,
      ],
      providers: [
        {
          provide: RolesService,
          useValue: {
            assignRole: () => ({ id: 1 }),
            create: () => ({ id: 1 }),
            unassignRole: () => ({}),
          },
        },
        {
          provide: UsersService,
          useValue: { create: () => ({ id: 1 }), update: () => ({ id: 1 }) },
        },
        RoleGuard,
        AuthTokenGuard,
        { provide: APP_GUARD, useClass: GlobalAuthGuard },
        {
          provide: AuthService,
          useValue: {
            resolveToken: async (t: string) =>
              ['ADMIN', 'HEALTH', 'CATERING', 'VIEWER'].includes(t)
                ? { id: 1, email: 'staff-fiction@example.test', roles: [t] }
                : null,
          },
        },
        { provide: FamilyRegistrationService, useValue: service },
        {
          provide: RegistrationHealthService,
          useValue: new RegistrationHealthService(
            db as never,
            { get: () => undefined } as never,
            service,
          ),
        },
        {
          provide: RegistrationDocumentsService,
          useValue: new RegistrationDocumentsService(db as never, service),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterEach(async () => {
    await app.close();
    await pg.close();
  });
  async function login(email = 'fiction@example.test') {
    const challenge = randomUUID();
    await pg.query(
      `INSERT INTO registration_challenges(id,email,digest,"expiresAt") VALUES($1,$2,$3,now()+interval '10 minutes')`,
      [challenge, email, digest(challenge + '12345678')],
    );
    const r = await fetch(url + '/api/public/family-space/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: url },
      body: JSON.stringify({ challengeId: challenge, code: '12345678' }),
    });
    expect(r.status).toBe(201);
    const header = r.headers.get('set-cookie')!;
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/api/public/family-space');
    return { cookie: header.split(';')[0], space: await r.json() };
  }
  it('persists pages through a fresh HTTP request, rejects cross-family access, stale revision and foreign origins, then logs out', async () => {
    const a = await login(),
      path = url + '/api/public/family-space';
    const send = (suffix: string, method: string, body: unknown, cookie = a.cookie, origin = url) =>
      fetch(path + suffix, {
        method,
        headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await fetch(path)).status).toBe(401);
    let r = await send('/youths', 'POST', { revision: 0 });
    expect(r.status).toBe(201);
    let s = await r.json();
    const youth = s.youths[0].id;
    r = await send('/contact', 'PATCH', {
      revision: s.revision,
      contact: { ...EMPTY_CONTACT, name: 'Parent fictif', city: 'Lyon' },
    });
    expect(r.status).toBe(200);
    s = await r.json();
    r = await send('/youths/' + youth, 'PATCH', {
      revision: s.revision,
      patch: { identity: { firstName: 'Camille', lastName: 'FICTIF' }, currentPage: 2 },
    });
    expect(r.status).toBe(200);
    s = await r.json();
    const fresh = await fetch(path, { headers: { Cookie: a.cookie } });
    expect(fresh.headers.get('cache-control')).toContain('no-store');
    const restored = await fresh.json();
    expect(restored.youths[0].identity.firstName).toBe('Camille');
    expect(restored.contact.name).toBe('Parent fictif');
    expect(
      (await send('/youths/' + youth, 'PATCH', { revision: 0, patch: { currentPage: 1 } })).status,
    ).toBe(409);
    expect(
      (
        await send(
          '/youths/' + youth,
          'PATCH',
          { revision: s.revision, patch: { currentPage: 1 } },
          a.cookie,
          'https://outside.example',
        )
      ).status,
    ).toBe(403);
    const b = await login('other-fiction@example.test');
    expect(
      (
        await send(
          '/youths/' + youth,
          'PATCH',
          { revision: 0, patch: { currentPage: 1 } },
          b.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (await fetch(path + '/youths/' + youth + '/health', { headers: { Cookie: a.cookie } }))
        .status,
    ).toBe(403);
    expect(
      (await send('/youths/' + youth + '/submit', 'POST', { revision: s.revision, accepted: true }))
        .status,
    ).toBe(403);
    expect(
      (
        await fetch(path + '/session', {
          method: 'DELETE',
          headers: { Cookie: a.cookie, Origin: url },
        })
      ).status,
    ).toBe(200);
    expect((await fetch(path, { headers: { Cookie: a.cookie } })).status).toBe(401);
  });
  it('rejects an executable administrative upload without retaining bytes', async () => {
    const a = await login(),
      s = await service.add(a.space.id, 0),
      form = new FormData();
    form.append('file', new Blob(['not a supported document']), 'bad.exe');
    const r = await fetch(
      url + '/api/public/family-space/youths/' + s.youths[0].id + '/documents',
      { method: 'POST', headers: { Cookie: a.cookie, Origin: url }, body: form },
    );
    expect(r.status).toBe(400);
    expect(
      (await pg.query('SELECT count(*)::int AS n FROM registration_documents')).rows[0],
    ).toMatchObject({ n: 0 });
  });
  it('separates admin, health and catering bearer permissions, never accepting family cookies as staff access', async () => {
    const a = await login();
    for (const route of ['/api/family-registrations', '/api/family-health', '/api/catering-needs'])
      expect((await fetch(url + route, { headers: { Cookie: a.cookie } })).status).toBe(401);
    expect(
      (
        await fetch(url + '/api/family-registrations', {
          headers: { Authorization: 'Bearer VIEWER' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url + '/api/family-registrations', {
          headers: { Authorization: 'Bearer ADMIN' },
        })
      ).status,
    ).toBe(200);
    expect(
      (await fetch(url + '/api/family-health', { headers: { Authorization: 'Bearer ADMIN' } }))
        .status,
    ).toBe(403);
    expect(
      (await fetch(url + '/api/catering-needs', { headers: { Authorization: 'Bearer HEALTH' } }))
        .status,
    ).toBe(403);
    expect(
      (await fetch(url + '/api/family-health', { headers: { Authorization: 'Bearer HEALTH' } }))
        .status,
    ).toBe(403);
  });
  it('denies staff privilege escalation and other-user password changes before service invocation', async () => {
    for (const [route, method, body] of [
      ['/api/roles', 'POST', { code: 'HEALTH', label: 'Santé' }],
      ['/api/roles/users/1/1', 'POST', {}],
      ['/api/roles/users/1/1', 'DELETE', {}],
      ['/api/users', 'POST', { email: 'new@example.test', password: 'not-a-real-secret' }],
      ['/api/users/1', 'PATCH', { password: 'not-a-real-secret' }],
    ] as const) {
      const denied = await fetch(url + route, {
        method,
        headers: { Authorization: 'Bearer VIEWER', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(denied.status).toBe(403);
      const allowed = await fetch(url + route, {
        method,
        headers: { Authorization: 'Bearer ADMIN', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(allowed.status).toBe(method === 'POST' ? 201 : 200);
    }
  });
});
