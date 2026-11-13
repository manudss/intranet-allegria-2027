import { PGlite } from '@electric-sql/pglite';
import { describe, it, expect } from 'vitest';
import { AccessReportingPeopleService } from './access-reporting-people.service';
import { ExpectedPageQuery } from './access-expected-groups.types';
describe('People without scans', () => {
  it('includes unbadged people and unprojected volunteers without exposing youth surnames', async () => {
    const db = new PGlite();
    try {
      await db.exec(
        `CREATE TABLE participants(id int,volunteer_id int,"firstName" text,"lastName" text,type text,status text);CREATE TABLE volunteers(id int,"firstName" text,"lastName" text);INSERT INTO participants VALUES(1,NULL,'Ada','Privé','JEUNE','CONFIRMED'),(2,10,'Louis','Exemple','BENEVOLE','CONFIRMED'),(3,NULL,'Pending','Privé','JEUNE','PENDING');INSERT INTO volunteers VALUES(10,'Louis','Exemple'),(11,'Camille','SansBadge');`,
      );
      const manager = {
        query: async (sql: string, args: unknown[]) => (await db.query(sql, args)).rows,
      };
      const s = new AccessReportingPeopleService({
        transaction: (_level: unknown, fn: (m: unknown) => unknown) => fn(manager),
      } as never);
      const all = await s.people(new ExpectedPageQuery());
      expect(all.total).toBe(3);
      expect(
        all.items.find((r: { firstName: string }) => r.firstName === 'Ada').lastName,
      ).toBeNull();
      expect(
        all.items.find((r: { volunteerId: number }) => r.volunteerId === 11).participantId,
      ).toBeNull();
      expect((await s.people({ ...new ExpectedPageQuery(), q: 'Privé' })).total).toBe(0);
      expect((await s.people({ ...new ExpectedPageQuery(), offset: 100 })).total).toBe(3);
    } finally {
      await db.close();
    }
  }, 20000);
});
