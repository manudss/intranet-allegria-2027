import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APP_GUARD } from '@nestjs/core';
import { GlobalAuthGuard } from '../auth/global-auth.guard';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { AuthService } from '../auth/auth.service';
import { RolesController } from '../auth/roles.controller';
import { UsersController } from '../auth/users.controller';
import { RolesService } from '../auth/roles.service';
import { UsersService } from '../auth/users.service';
import { AccessRightsService } from '../access-rights/access-rights.service';
import { RoleGuard } from '../auth/role.guard';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { INestApplication } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID, randomBytes } from 'node:crypto';
import { FamilyRegistration1790600000000 } from '../../../database/migrations/1790600000000-FamilyRegistration';
import {
  FamilyRegistrationController,
  FamilyRegistrationStaffController,
  FamilyHealthStaffController,
  CateringNeedsController,
} from './family-registration.controller';
import { FamilyRegistrationService, digest } from './family-registration.service';
import { RegistrationHealthService, seal } from './registration-health.service';
import { RegistrationDocumentsService } from './registration-documents.service';
import { EMPTY_CONTACT, EMPTY_HEALTH } from '@mej-allegria/shared';
describe('Family HTTP contract with disposable real SQL storage, no mail sent', () => {
  let app: INestApplication, pg: PGlite, url: string, service: FamilyRegistrationService;
  let configValues: Record<string, string>;
  beforeEach(async () => {
    configValues = {};
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
    service = new FamilyRegistrationService(
      db as never,
      { get: (key: string) => configValues[key] } as never,
    );
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 600000, limit: 5 }])],
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
        { provide: AccessRightsService, useValue: { effective: async () => new Map() } },
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
            { get: (key: string) => configValues[key] } as never,
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
    vi.unstubAllGlobals();
    await app.close();
    await pg.close();
  });
  it('keeps the family policy explicit with the legacy global5/10min default', async () => {
    for (let i = 0; i < 7; i++) {
      const r = await fetch(url + '/api/public/family-space/rules');
      expect(r.status).toBe(200);
      expect(r.headers.get('x-ratelimit-limit')).toBe('120');
      expect(Number(r.headers.get('x-ratelimit-reset'))).toBeLessThanOrEqual(60);
    }
  });
  it('retains strict per-route access-code abuse protection', async () => {
    for (let i = 0; i < 6; i++) {
      const r = await fetch(url + '/api/public/family-space/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: url },
        body: JSON.stringify({ email: 'limit@example.test' }),
      });
      if (i < 5) expect(r.headers.get('x-ratelimit-limit')).toBe('5');
      expect(r.status).toBe(i < 5 ? 503 : 429);
      if (i === 5) expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
    }
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
  it('opens only the pre-seeded fictional preview family, never a caller-selected family or production', async () => {
    const route = url + '/api/public/family-space/preview-demo';
    const send = (body: unknown = {}, origin = url) =>
      fetch(route, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await send()).status).toBe(403);
    Object.assign(configValues, {
      FAMILY_PREVIEW_DEMO_ENABLED: 'pr42-fictional-only',
      RENDER_SERVICE_NAME: 'al-pr42-api',
      RENDER_GIT_BRANCH: 'feat/family-registration',
      RENDER_EXTERNAL_HOSTNAME: 'al-pr42-api.onrender.com',
    });
    expect((await send()).status).toBe(403);
    await login('famille-demo@example.test');
    await pg.query('INSERT INTO registration_settings(id,rules) VALUES(1,$1)', [
      { previewDemoSeed: true, registrationOpen: true },
    ]);
    expect((await send({ email: 'other@example.test' })).status).toBe(400);
    expect((await send({}, 'https://other.test')).status).toBe(403);
    const response = await send();
    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect((await response.json()).email).toBe('famille-demo@example.test');
    configValues.RENDER_GIT_BRANCH = 'main';
    expect((await send()).status).toBe(403);
    expect((await service.rules()).previewDemo).toBe(false);
    expect((await service.rules()).registrationOpen).toBe(false);
  });
  it('exports unsigned templates only for the owning family and enabled models', async () => {
    const a = await login(),
      b = await login('other@example.test'),
      family = await service.add(a.space.id, 0),
      id = family.youths[0].id;
    await pg.query('INSERT INTO registration_settings(id,rules) VALUES(1,$1)', [
      {
        templates: [
          {
            id: 'demo',
            title: 'FICTIF',
            text: 'Texte fictif',
            enabled: true,
            required: false,
            version: '1',
          },
        ],
      },
    ]);
    const route = url + '/api/public/family-space/youths/' + id + '/templates/demo/pdf';
    const pdf = await fetch(route, { headers: { Cookie: a.cookie } });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');
    expect(pdf.headers.get('cache-control')).toContain('no-store');
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    expect((await fetch(route, { headers: { Cookie: b.cookie } })).status).toBe(404);
    expect((await fetch(route)).status).toBe(401);
    expect(
      (await fetch(route.replace('/demo/', '/unknown/'), { headers: { Cookie: a.cookie } })).status,
    ).toBe(400);
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
  it('shows the complete transmitted dossier to HEALTH only, never correction drafts or administrative decisions', async () => {
    const key = randomBytes(32);
    Object.assign(configValues, {
      FAMILY_HEALTH_APPROVAL_REFERENCE: 'FICTION ONLY',
      FAMILY_HEALTH_ENCRYPTION_KEY: key.toString('base64'),
      FAMILY_HEALTH_DECLARATION_VERSION: 'fiction',
      FAMILY_HEALTH_DECLARATION_TEXT: 'Fiction only',
    });
    const a = await login();
    const f = await service.add(a.space.id, 0);
    const y = f.youths[0];
    y.state = 'CORRECTION';
    y.logistics.notes = 'Unsubmitted private draft';
    y.administrativeAtSubmission = {
      identity: { ...y.identity, firstName: 'Transmitted' },
      logistics: { ...y.logistics, notes: 'Transmitted travel note' },
      signatures: [],
      simulation: 'NOT_TESTED',
      paperHealth: 'TO_ORGANISE',
      submittedAt: '2026-11-20T12:00:00Z',
      participantId: 123,
    };
    await pg.query('UPDATE registration_families SET dossier=$1 WHERE id=$2', [f, f.id]);
    const h = {
      ...EMPTY_HEALTH,
      answers: { foodAllergy: 'Transmitted medical instruction' },
      signedPayload: JSON.stringify({
        identity: y.administrativeAtSubmission.identity,
        contact: f.contact,
      }),
    };
    await pg.query(
      'INSERT INTO registration_health_submissions(family_id,"youthId",envelope) VALUES($1,$2,$3)',
      [f.id, y.id, seal(h, key, f.id + ':' + y.id)],
    );
    const endpoint = url + '/api/family-health/' + f.id + '/youths/' + y.id;
    for (const role of ['ADMIN', 'CATERING', 'VIEWER'])
      expect((await fetch(endpoint, { headers: { Authorization: 'Bearer ' + role } })).status).toBe(
        403,
      );
    const r = await fetch(endpoint, { headers: { Authorization: 'Bearer HEALTH' } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.administrative.logistics.notes).toBe('Transmitted travel note');
    expect(body.health.answers.foodAllergy).toBe('Transmitted medical instruction');
    expect(JSON.stringify(body)).not.toContain('Unsubmitted private draft');
    expect(
      (
        await fetch(url + '/api/family-registrations', {
          headers: { Authorization: 'Bearer HEALTH' },
        })
      ).status,
    ).toBe(403);
    const admin = await fetch(url + '/api/family-registrations', {
      headers: { Authorization: 'Bearer ADMIN' },
    });
    expect(JSON.stringify(await admin.json())).not.toContain('Transmitted medical instruction');
  });
  it('keeps live PDF previews owner-only and side-effect free, then requires the distinct signature code over HTTP', async () => {
    Object.assign(configValues, {
      FAMILY_HEALTH_APPROVAL_REFERENCE: 'FICTION ONLY',
      FAMILY_HEALTH_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      FAMILY_HEALTH_DECLARATION_VERSION: 'test',
      FAMILY_HEALTH_DECLARATION_TEXT: 'Déclaration FICTIVE',
      FAMILY_MAIL_PROVIDER: 'resend',
      FAMILY_MAIL_FROM: 'Fiction <fiction@example.test>',
      FAMILY_RESEND_API_KEY: 'fake-test-only',
    });
    const a = await login(),
      f = await service.add(a.space.id, 0),
      id = f.youths[0].id,
      path = url + '/api/public/family-space/youths/' + id + '/health';
    const body = {
        health: {
          answers: { foodAllergy: 'Consigne FICTIVE jamais enregistrée par aperçu' },
          presence: { foodAllergy: 'YES' },
          foodAllergens: [],
          page: 0,
        },
      },
      send = (suffix: string, b: unknown, cookie = a.cookie, origin = url) =>
        fetch(path + suffix, {
          method: 'POST',
          headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify(b),
        });
    expect((await send('/preview', body, '')).status).toBe(401);
    expect((await send('/preview', body, a.cookie, 'https://other.example.test')).status).toBe(403);
    const b = await login('other@example.test');
    expect((await send('/preview', body, b.cookie)).status).toBe(404);
    const preview = await send('/preview', body);
    expect(preview.status).toBe(201);
    expect(preview.headers.get('cache-control')).toContain('no-store');
    expect(preview.headers.get('content-type')).toContain('application/pdf');
    expect(
      Buffer.from(await preview.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
    expect((await pg.query('SELECT * FROM registration_health')).rows).toHaveLength(0);
    const saved = await fetch(path, {
      method: 'PATCH',
      headers: { Cookie: a.cookie, Origin: url, 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: 0, ...body }),
    });
    expect(saved.status).toBe(200);
    const proposal = {
      revision: 1,
      name: 'Parent FICTIF',
      capacity: 'LEGAL',
      accepted: true,
      version: 'test',
      appearance: { method: 'NAME' },
    };
    expect((await send('/sign', proposal)).status).toBe(401);
    const original = globalThis.fetch;
    let code = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input, init) => {
        if (String(input) === 'https://api.resend.com/emails') {
          code = JSON.parse(String(init?.body)).text.match(/\d{8}/)[0];
          return new Response(JSON.stringify({ id: 'fictional-test' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return original(input, init);
      }),
    );
    const challenge = await send('/sign/code', proposal);
    expect(challenge.status).toBe(201);
    const c = await challenge.json();
    expect(c.code).toBeUndefined();
    expect((await send('/sign', { ...proposal, challengeId: c.challengeId, code })).status).toBe(
      201,
    );
    const pdf = await fetch(path + '/pdf', { headers: { Cookie: a.cookie } });
    expect(pdf.status).toBe(200);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    const again = await fetch(path + '/pdf', { headers: { Cookie: a.cookie } });
    expect(Buffer.from(await again.arrayBuffer())).toEqual(bytes);
    expect(
      (await send('/sign', { ...proposal, challengeId: c.challengeId, code })).status,
    ).not.toBe(201);
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
