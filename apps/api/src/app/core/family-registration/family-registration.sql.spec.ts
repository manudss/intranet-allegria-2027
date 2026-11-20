import { PGlite } from '@electric-sql/pglite';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { FamilyRegistration1790600000000 } from '../../../database/migrations/1790600000000-FamilyRegistration';
import { RegistrationHealthService } from './registration-health.service';
import { RegistrationDocumentsService } from './registration-documents.service';
import { randomBytes } from 'node:crypto';
import { FamilyRegistrationService, digest, strings } from './family-registration.service';
import { EMPTY_CONTACT, DEFAULT_FAMILY_RULES, DIOCESES } from '@mej-allegria/shared';
describe('Family registration SQL, fictitious database only', () => {
  let pg: PGlite,
    service: FamilyRegistrationService,
    health: RegistrationHealthService,
    documents: RegistrationDocumentsService;
  beforeEach(async () => {
    pg = new PGlite();
    const query = async (sql: string, params: unknown[] = []) => (await pg.query(sql, params)).rows;
    await new FamilyRegistration1790600000000().up({
      query: async (sql: string) => pg.exec(sql),
    } as never);
    await pg.exec('CREATE TABLE test_participants(id serial PRIMARY KEY,data jsonb NOT NULL)');
    const repository = {
      create: (v: unknown) => v,
      save: async (v: { id?: number }) => {
        if (v.id) {
          await query('UPDATE test_participants SET data=$1 WHERE id=$2', [v, v.id]);
          return v;
        }
        const [r] = await query('INSERT INTO test_participants(data) VALUES($1) RETURNING id', [v]);
        return { ...v, id: (r as { id: number }).id };
      },
      update: async (id: number, v: unknown) =>
        query('UPDATE test_participants SET data=data||$1::jsonb WHERE id=$2', [v, id]),
    };
    const db = {
      query,
      transaction: async (fn: (m: unknown) => unknown) => {
        await pg.exec('BEGIN');
        try {
          const r = await fn({ query, getRepository: () => repository });
          await pg.exec('COMMIT');
          return r;
        } catch (e) {
          await pg.exec('ROLLBACK');
          throw e;
        }
      },
    };
    service = new FamilyRegistrationService(db as never, { get: () => undefined } as never);
    documents = new RegistrationDocumentsService(db as never, service);
    const config: Record<string, string> = {
      FAMILY_HEALTH_APPROVAL_REFERENCE: 'TEST-ONLY',
      FAMILY_HEALTH_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      FAMILY_HEALTH_DECLARATION_VERSION: 'test-v1',
      FAMILY_HEALTH_DECLARATION_TEXT: 'Déclaration fictive de test',
    };
    health = new RegistrationHealthService(
      db as never,
      { get: (k: string) => config[k] } as never,
      service,
    );
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await pg.close();
  });
  async function access(email: string) {
    const id = randomUUID();
    await pg.query(
      'INSERT INTO registration_challenges(id,email,digest,"expiresAt") VALUES($1,$2,$3,now()+interval \'10 minutes\')',
      [id, email, digest(id + '12345678')],
    );
    return service.verify(id, '12345678');
  }
  it('consumes a one-time challenge, stores only token digests and persists a family session', async () => {
    const result = await access('fictitious@example.fr');
    expect(await service.session(result.token)).toBe(result.familyId);
    const row = (await pg.query('SELECT digest FROM registration_sessions')).rows[0] as {
      digest: string;
    };
    expect(row.digest).not.toBe(result.token);
    expect(row.digest).toBe(digest(result.token));
    expect((await service.get(result.familyId)).email).toBe('fictitious@example.fr');
    await service.logout(result.token);
    await expect(service.session(result.token)).rejects.toThrow();
  });
  it('counts failed guesses durably and rejects the sixth even if correct', async () => {
    const id = randomUUID();
    await pg.query(
      'INSERT INTO registration_challenges(id,email,digest,"expiresAt") VALUES($1,$2,$3,now()+interval \'10 minutes\')',
      [id, 'fictitious@example.fr', digest(id + '12345678')],
    );
    for (let i = 0; i < 5; i++) await expect(service.verify(id, '00000000')).rejects.toThrow();
    await expect(service.verify(id, '12345678')).rejects.toThrow();
    expect((await pg.query('SELECT attempts FROM registration_challenges')).rows[0]).toMatchObject({
      attempts: 5,
    });
  });
  it('rejects cross-family youth ids, stale windows, forbidden fields and does not overwrite', async () => {
    const a = await access('a@example.fr'),
      b = await access('b@example.fr');
    const as = await service.add(a.familyId, 0),
      bs = await service.add(b.familyId, 0);
    await expect(
      service.saveYouth(a.familyId, bs.youths[0].id, 1, { currentPage: 2 }),
    ).rejects.toThrow('introuvable');
    await expect(service.add(a.familyId, 0)).rejects.toThrow('autre fenêtre');
    expect(() =>
      service.saveYouth(a.familyId, as.youths[0].id, 1, { state: 'CONFIRMED' }),
    ).toThrow();
    expect((await service.get(a.familyId)).revision).toBe(1);
  });
  it('saves draft pages and shared contacts durably, separate from simulated payments', async () => {
    const a = await access('a@example.fr');
    let s = await service.add(a.familyId, 0);
    s = await service.saveContact(a.familyId, 1, { ...EMPTY_CONTACT, name: 'Foyer fictif' });
    s = await service.saveYouth(a.familyId, s.youths[0].id, 2, {
      identity: { firstName: 'Camille' },
      currentPage: 4,
      simulation: 'SUCCESS',
    });
    expect((await service.get(a.familyId)).youths[0]).toMatchObject({
      state: 'DRAFT',
      currentPage: 4,
      simulation: 'SUCCESS',
    });
    s = await service.add(a.familyId, 3);
    expect(s.youths[1].signatures).toEqual([]);
    expect(s.contact.name).toBe('Foyer fictif');
  });
  it('blocks final submission while organizational rules are not validated', async () => {
    const a = await access('a@example.fr');
    const s = await service.add(a.familyId, 0);
    await expect(service.submit(a.familyId, s.youths[0].id, 1, true)).rejects.toThrow(
      'pas encore ouvert',
    );
    expect((await service.get(a.familyId)).youths[0].state).toBe('DRAFT');
    expect((await service.rules()).healthMode).toBe('PAPER');
  });
  it('does not send or expose access codes when mail is not configured', async () => {
    await expect(service.challenge('a@example.fr')).rejects.toThrow('pas encore configuré');
    expect((await pg.query('SELECT * FROM registration_challenges')).rows).toHaveLength(0);
  });
  it.each([429, 500])(
    'removes the challenge after a provider HTTP%s without leaking provider details',
    async (status) => {
      const query = async (sql: string, params: unknown[] = []) =>
        (await pg.query(sql, params)).rows;
      const mail = new FamilyRegistrationService(
        { query } as never,
        new ConfigService({
          FAMILY_MAIL_PROVIDER: 'resend',
          FAMILY_MAIL_FROM: 'fiction@example.test',
          FAMILY_RESEND_API_KEY: 'test-only',
        }),
      );
      const fetcher = vi.fn().mockResolvedValue({ ok: false, status });
      vi.stubGlobal('fetch', fetcher);
      await expect(mail.challenge('fiction@example.test')).rejects.toThrow(
        "Le code n'a pas pu être envoyé",
      );
      expect((await pg.query('SELECT * FROM registration_challenges')).rows).toHaveLength(0);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('stores only a digest after a provider acknowledges an access email', async () => {
    const query = async (sql: string, params: unknown[] = []) => (await pg.query(sql, params)).rows;
    const mail = new FamilyRegistrationService(
      { query } as never,
      new ConfigService({
        FAMILY_MAIL_PROVIDER: 'resend',
        FAMILY_MAIL_FROM: 'fiction@example.test',
        FAMILY_RESEND_API_KEY: 'test-only',
      }),
    );
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'provider-fiction' }) });
    vi.stubGlobal('fetch', fetcher);
    const result = await mail.challenge('fiction@example.test');
    const row = (await pg.query('SELECT * FROM registration_challenges')).rows[0] as {
      id: string;
      digest: string;
    };
    expect(result.challengeId).toBe(row.id);
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    const code = payload.text.match(/\d{8}/)[0];
    expect(row.digest).toBe(digest(row.id + code));
    expect(JSON.stringify(row)).not.toContain(code);
    expect(JSON.stringify(result)).not.toContain(code);
  });
  it('never accepts health or unknown fields in an administrative contact', () => {
    expect(() => strings({ allergies: 'x' }, EMPTY_CONTACT)).toThrow();
    expect(() => strings(JSON.parse('{"__proto__":"x"}'), EMPTY_CONTACT)).toThrow();
  });
  it('freezes health content atomically, rejects a stale page and keeps signed history after changes', async () => {
    const a = await access('health-fiction@example.test');
    let s = await service.add(a.familyId, 0);
    const id = s.youths[0].id;
    const h = await health.save(a.familyId, id, 0, {
      answers: { foodAllergy: 'Test fictif' },
      presence: { foodAllergy: 'YES', animalAllergy: 'NO' },
      foodAllergens: ['MILK'],
      page: 3,
    });
    expect(h.presence).toEqual({ foodAllergy: 'YES', animalAllergy: 'NO' });
    await expect(
      health.save(a.familyId, id, h.revision, {
        answers: {},
        presence: { foodAllergy: 'MAYBE' },
        foodAllergens: [],
        page: 0,
      }),
    ).rejects.toThrow('Choix du modèle');
    await expect(
      health.sign(a.familyId, id, h.revision, {
        name: 'Parent fictif',
        capacity: 'LEGAL',
        accepted: true,
        version: 'old',
      }),
    ).rejects.toThrow();
    const signed = await health.sign(a.familyId, id, h.revision, {
      name: 'Parent fictif',
      capacity: 'LEGAL',
      accepted: true,
      version: 'test-v1',
    });
    const navigated = await health.save(a.familyId, id, signed.revision, {
      answers: signed.answers,
      presence: signed.presence,
      foodAllergens: signed.foodAllergens,
      page: 5,
    });
    expect(navigated.signature?.digest).toBe(signed.signature?.digest);
    expect(navigated.signedPayload).toBe(signed.signedPayload);
    expect(signed.signature?.digest).toHaveLength(64);
    expect(signed.signedPayload).toBeTruthy();
    const frozen = JSON.parse(signed.signedPayload || '{}');
    expect(frozen.answers.foodAllergy).toBe('Test fictif');
    expect(frozen.presence.animalAllergy).toBe('NO');
    expect(frozen.presence.drugAllergy).toBeUndefined();
    await expect(
      health.save(a.familyId, id, h.revision, { answers: {}, foodAllergens: [], page: 0 }),
    ).rejects.toThrow('autre fenêtre');
    s = await service.saveYouth(a.familyId, id, s.revision, {
      identity: { firstName: 'Prénom modifié' },
    });
    expect((await health.get(a.familyId, id)).signature).toBeNull();
    expect((await health.get(a.familyId, id)).answers.foodAllergy).toBe('Test fictif');
    expect(
      (await pg.query('SELECT count(*)::int AS n FROM registration_health_versions')).rows[0],
    ).toMatchObject({ n: 1 });
  });
  it('rejects duplicate templates, impossible dates and text changes without a new version', async () => {
    await expect(
      service.configure({ ...DEFAULT_FAMILY_RULES, ageReferenceDate: '2027-02-31' }),
    ).rejects.toThrow();
    const template = {
      id: 'a',
      version: '1',
      title: 'Document fictif',
      text: 'Texte test',
      enabled: true,
      required: true,
    };
    await service.configure({ ...DEFAULT_FAMILY_RULES, templates: [template] });
    await expect(
      service.configure({
        ...DEFAULT_FAMILY_RULES,
        templates: [{ ...template, text: 'Texte changé' }],
      }),
    ).rejects.toThrow('nouvelle version');
    await expect(
      service.configure({ ...DEFAULT_FAMILY_RULES, templates: [template, template] }),
    ).rejects.toThrow();
  });
  it('submits once, freezes shared contacts, corrects and resubmits the same participant without duplication', async () => {
    await service.configure({
      ...DEFAULT_FAMILY_RULES,
      registrationOpen: true,
      ageReferenceDate: '2027-10-30',
    });
    const a = await access('submission-fiction@example.test');
    let s = await service.add(a.familyId, 0);
    const id = s.youths[0].id;
    s = await service.saveContact(a.familyId, s.revision, {
      ...EMPTY_CONTACT,
      name: 'Parent initial',
      phone: '0600000000',
      emergencyName: 'Urgence fictive',
      emergencyPhone: '0600000001',
    });
    s = await service.saveYouth(a.familyId, id, s.revision, {
      identity: {
        firstName: 'Camille',
        lastName: 'FICTIF',
        dateOfBirth: '2012-05-01',
        sex: 'FEMALE',
        mejAgeGroup: 'TA',
        dioceseId: DIOCESES[0].id,
        legalCapacity: 'LEGAL',
      },
      logistics: { presence: 'FULL' },
    });
    s = await service.submit(a.familyId, id, s.revision, true);
    const participant = s.youths[0].participantId;
    await expect(service.submit(a.familyId, id, s.revision, true)).rejects.toThrow('lecture seule');
    s = await service.add(a.familyId, s.revision);
    s = await service.saveContact(a.familyId, s.revision, { ...s.contact, name: 'Parent actuel' });
    expect(s.youths[0].contactAtSubmission?.name).toBe('Parent initial');
    expect(s.contact.name).toBe('Parent actuel');
    s = await service.review(
      a.familyId,
      id,
      s.revision,
      'CONFIRMED',
      'Test fictif',
      'staff@example.test',
    );
    expect((await pg.query('SELECT data FROM test_participants')).rows[0]).toMatchObject({
      data: { status: 'CONFIRMED', diocese: DIOCESES[0].name },
    });
    const documentId = randomUUID();
    await pg.query(
      'INSERT INTO registration_documents(id,family_id,"youthId",name,mime,content,digest) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        documentId,
        a.familyId,
        id,
        'Fictif.pdf',
        'application/pdf',
        Buffer.from('%PDF-TEST'),
        '0'.repeat(64),
      ],
    );
    await documents.staffReview(
      a.familyId,
      id,
      documentId,
      'CORRECTION',
      'Préciser les coordonnées',
      'staff@example.test',
    );
    s = await service.get(a.familyId);
    expect(s.youths[0].state).toBe('CORRECTION');
    expect((await pg.query('SELECT data FROM test_participants')).rows[0]).toMatchObject({
      data: { status: 'PENDING' },
    });
    s = await service.submit(a.familyId, id, s.revision, true);
    expect(s.youths[0].participantId).toBe(participant);
    expect(
      (await pg.query('SELECT count(*)::int AS n FROM test_participants')).rows[0],
    ).toMatchObject({ n: 1 });
    expect((await pg.query('SELECT data FROM test_participants')).rows[0]).toMatchObject({
      data: { status: 'PENDING' },
    });
    const actors = await pg.query(
      `SELECT actor FROM registration_audit WHERE action='DOCUMENT_REVIEWED'`,
    );
    expect(actors.rows[0]).toMatchObject({ actor: 'staff@example.test' });
  });
  it('only exposes transmitted signed health versions, not drafts or unsubmitted corrections, and audits every staff read', async () => {
    const a = await access('private-health-fiction@example.test');
    const s = await service.add(a.familyId, 0);
    const id = s.youths[0].id;
    const saved = await health.save(a.familyId, id, 0, {
      answers: { foodAllergy: 'Ancienne consigne fictive' },
      foodAllergens: ['MILK'],
      page: 6,
    });
    const signed = await health.sign(a.familyId, id, saved.revision, {
      name: 'Parent fictif',
      capacity: 'LEGAL',
      accepted: true,
      version: 'test-v1',
    });
    expect(await health.staffList()).toEqual([]);
    await expect(health.staffRead(a.familyId, id, 'health@example.test')).rejects.toThrow(
      'non envoyé',
    );
    expect((await health.catering()).items).toEqual([]);
    const [encrypted] = await pg
      .query('SELECT envelope FROM registration_health WHERE family_id=$1', [a.familyId])
      .then((r) => r.rows as { envelope: string }[]);
    await pg.query(
      'INSERT INTO registration_health_submissions(family_id,"youthId",envelope) VALUES($1,$2,$3)',
      [a.familyId, id, encrypted.envelope],
    );
    const f = await service.get(a.familyId);
    f.youths[0].state = 'CORRECTION';
    await pg.query('UPDATE registration_families SET dossier=$1 WHERE id=$2', [f, a.familyId]);
    await health.save(a.familyId, id, signed.revision, {
      answers: { foodAllergy: 'Nouveau brouillon secret' },
      foodAllergens: ['PEANUTS'],
      page: 3,
    });
    const read = await health.staffRead(a.familyId, id, 'health@example.test');
    expect(read.health.answers.foodAllergy).toBe('Ancienne consigne fictive');
    expect(JSON.stringify(read)).not.toContain('Nouveau brouillon secret');
    expect(
      (
        await pg.query(
          `SELECT count(*)::int AS n FROM registration_audit WHERE action='HEALTH_READ' AND actor='health@example.test'`,
        )
      ).rows[0],
    ).toMatchObject({ n: 1 });
  });
});
