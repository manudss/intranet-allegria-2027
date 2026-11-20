import { PGlite } from '@electric-sql/pglite';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { FamilyRegistration1790600000000 } from '../../../database/migrations/1790600000000-FamilyRegistration';
import { FamilyRegistrationService, digest, strings } from './family-registration.service';
import { EMPTY_CONTACT, DEFAULT_FAMILY_RULES } from '@mej-allegria/shared';
import type { FamilySpace } from '@mej-allegria/shared';
describe('Family registration SQL, fictitious database only', () => {
  let pg: PGlite, service: FamilyRegistrationService;
  beforeEach(async () => {
    pg = new PGlite();
    const query = async (sql: string, params: unknown[] = []) => (await pg.query(sql, params)).rows;
    await new FamilyRegistration1790600000000().up({
      query: async (sql: string) => pg.exec(sql),
    } as never);
    const db = {
      query,
      transaction: async (fn: (m: unknown) => unknown) => {
        await pg.exec('BEGIN');
        try {
          const r = await fn({ query });
          await pg.exec('COMMIT');
          return r;
        } catch (e) {
          await pg.exec('ROLLBACK');
          throw e;
        }
      },
    };
    service = new FamilyRegistrationService(db as never, { get: () => undefined } as never);
  });
  afterEach(async () => {
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
  it('never accepts health or unknown fields in an administrative contact', () => {
    expect(() => strings({ allergies: 'x' }, EMPTY_CONTACT)).toThrow();
    expect(() => strings(JSON.parse('{"__proto__":"x"}'), EMPTY_CONTACT)).toThrow();
  });
});
