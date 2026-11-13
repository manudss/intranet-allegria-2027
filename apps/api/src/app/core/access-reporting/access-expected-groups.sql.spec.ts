import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { ExpectedPageQuery } from './access-expected-groups.types';
import { PGlite } from '@electric-sql/pglite';
import { describe, it, expect } from 'vitest';
import { CreateAccessExpectedGroups1789800000000 } from '../../../database/migrations/1789800000000-CreateAccessExpectedGroups';
import { AccessExpectedGroupsService } from './access-expected-groups.service';
import { EXPECTED_GROUP_SQL } from './access-expected-groups.sql';

describe('Expected groups data model', () => {
  it('accepts the EXCEPTION server filter and rejects unknown statuses', () => {
    const q = new ExpectedPageQuery();
    q.status = 'EXCEPTION';
    expect(validateSync(q)).toHaveLength(0);
    q.status = 'UNSAFE';
    expect(validateSync(q)).not.toHaveLength(0);
  });
  it('migrates both ways and resolves current sources, unbadged volunteers and individual service attendance', async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TYPE person_type_enum AS ENUM('JEUNE','ANIMATEUR','BENEVOLE');
   CREATE TABLE users(id int PRIMARY KEY,email text); INSERT INTO users VALUES(1,'admin@test');
   CREATE TABLE volunteers(id int PRIMARY KEY,"firstName" text,"lastName" text);
   CREATE TABLE participants(id int PRIMARY KEY,volunteer_id int UNIQUE,"firstName" text,"lastName" text,type person_type_enum,status text);
   CREATE TABLE teams(id int PRIMARY KEY,name text,primary_animator_id int,secondary_animator_id int);
   CREATE TABLE team_participants(team_id int,participant_id int);
   CREATE TABLE access_scan_points(id int PRIMARY KEY,name text);
   CREATE TABLE access_scan_types(id int PRIMARY KEY);
   CREATE TABLE access_passage_exceptions(id int,passage_id int,participant_id int,authorized_by int,created_at timestamptz,reason text,accepted_event_id int,refused_event_id int,session_id int);
   CREATE TABLE access_scan_events(id int PRIMARY KEY,participant_id int,point_id int,scan_type_id int,service_key text,occurred_at_local timestamptz,received_at timestamptz,verdict text,needs_review bool);
   INSERT INTO access_scan_points VALUES(1,'Repas'),(2,'Autre'); INSERT INTO access_scan_types VALUES(1);
   INSERT INTO volunteers VALUES(10,'Volunteer','Sans badge'),(11,'Volunteer','Projeté');
   INSERT INTO participants VALUES(42,NULL,'Ada','Privé','JEUNE','CONFIRMED'),(43,NULL,'Noé','Privé','JEUNE','CONFIRMED'),(44,NULL,'Louis','Exemple','ANIMATEUR','CONFIRMED'),(45,11,'Volunteer','Projeté','BENEVOLE','CONFIRMED'),(46,NULL,'Pending','Privé','JEUNE','PENDING');
   INSERT INTO teams VALUES(8,'Équipe A',10,NULL); INSERT INTO team_participants VALUES(8,42),(8,43);
   `);
      const runner = { query: (sql: string) => db.exec(sql) };
      const migration = new CreateAccessExpectedGroups1789800000000();
      await migration.up(runner as never);
      await db.exec(`INSERT INTO access_expected_groups(id,name,created_by) VALUES(1,'Repas nord',1);
   INSERT INTO access_expected_group_sources(group_id,team_id) VALUES(1,8);
   INSERT INTO access_expected_group_sources(group_id,person_type) VALUES(1,'JEUNE'),(1,'BENEVOLE');
   INSERT INTO access_expected_group_sources(group_id,participant_id) VALUES(1,44),(1,42);
   INSERT INTO access_expected_passages(id,group_id,point_id,scan_type_id,service_key,label,starts_at,ends_at,created_by)
    VALUES(1,1,1,1,'midi','Déjeuner','2027-07-31 10:00Z','2027-07-31 12:00Z',1);
   INSERT INTO access_scan_events VALUES
   (1,42,1,1,'midi','2027-07-31 10:30Z','2027-07-31 10:30Z','ACCEPTED',false),
   (2,42,1,1,'midi','2027-07-31 10:31Z','2027-07-31 10:31Z','DUPLICATE',false),
   (3,43,1,1,'midi','2027-07-31 10:32Z','2027-07-31 12:10Z','ACCEPTED',true),
   (4,44,2,1,'midi','2027-07-31 10:33Z','2027-07-31 10:33Z','ACCEPTED',false),
   (5,45,1,1,'autre','2027-07-31 10:34Z','2027-07-31 10:34Z','ACCEPTED',false),
   (6,44,1,1,'midi','2027-07-31 10:35Z','2027-07-31 10:35Z','REJECTED_REVOKED',false),
   (7,45,1,1,'midi','2027-07-31 12:00Z','2027-07-31 12:00Z','ACCEPTED',false);`);
      const members = (
        await db.query<Record<string, unknown>>(EXPECTED_GROUP_SQL.members, [1, 50, 0])
      ).rows;
      const service = new AccessExpectedGroupsService({
        query: async (sql: string, args: unknown[]) =>
          (await db.query<Record<string, unknown>>(sql, args)).rows,
      } as never);
      const groupReader = new AccessExpectedGroupsService({
        transaction: async (_: unknown, work: (m: unknown) => unknown) =>
          work({ query: async (sql: string, args: unknown[]) => (await db.query(sql, args)).rows }),
      } as never);
      const group = await groupReader.group(1);
      expect(
        group.sources.find((s: { participantId: number }) => s.participantId === 42).label,
      ).toBe('Ada');
      expect(
        group.sources.find((s: { participantId: number }) => s.participantId === 44).label,
      ).toBe('Louis Exemple');
      expect(group.sources.find((s: { teamId: number }) => s.teamId === 8).label).toBe('Équipe A');
      const ownPassages = await groupReader.passages({ groupId: 1, limit: 50, offset: 0 });
      expect(ownPassages.total).toBe(1);
      expect(ownPassages.items[0].id).toBe(1);
      expect((await groupReader.passages({ groupId: 999, limit: 50, offset: 0 })).total).toBe(0);
      expect((await service.passage(1)).id).toBe(1);
      const dashboard = await service.dashboard('2027-07-31T00:00:00Z', '2027-08-01T00:00:00Z');
      expect(dashboard[0]).toMatchObject({
        expected: 5,
        confirmed: 1,
        reviewOnly: 1,
        notConfirmed: 3,
        exceptions: 0,
      });
      expect(members).toHaveLength(5); // sources are a union, not multiplied
      expect(members.find((r) => r.participantId === 42)?.lastName).toBeNull();
      expect(members.find((r) => r.volunteerId === 10)).toMatchObject({
        personKey: 'volunteer:10',
        participantId: null,
      });
      expect(
        (await db.query<Record<string, unknown>>(EXPECTED_GROUP_SQL.statusCounts, [1, 1])).rows[0],
      ).toEqual({
        expected: 5,
        exceptions: 0,
        confirmed: 1,
        reviewOnly: 1,
        notConfirmed: 3,
      });
      expect(
        (
          await db.query<Record<string, unknown>>(EXPECTED_GROUP_SQL.statusRows, [
            1,
            1,
            'NOT_CONFIRMED',
            50,
            0,
          ])
        ).rows,
      ).toHaveLength(3);
      // Creating the volunteer projection later changes neither identity nor count.
      await db.exec(
        `INSERT INTO participants VALUES(50,10,'Volunteer','Sans badge','BENEVOLE','CONFIRMED')`,
      );
      expect(
        (await db.query<Record<string, unknown>>(EXPECTED_GROUP_SQL.memberCount, [1])).rows[0]
          .total,
      ).toBe(5);
      expect(
        (await db.query<Record<string, unknown>>(EXPECTED_GROUP_SQL.members, [1, 50, 0])).rows.find(
          (r) => r.volunteerId === 10,
        )?.personKey,
      ).toBe('volunteer:10');
      // Current group composition follows team changes. Historical events stay put.
      await db.exec(
        `DELETE FROM access_expected_group_sources WHERE person_type='JEUNE'; DELETE FROM team_participants WHERE participant_id=43;`,
      );
      expect(
        (await db.query<Record<string, unknown>>(EXPECTED_GROUP_SQL.memberCount, [1])).rows[0]
          .total,
      ).toBe(4);
      expect(
        (
          await db.query<Record<string, unknown>>(
            'SELECT count(*)::int AS n FROM access_scan_events',
          )
        ).rows[0].n,
      ).toBe(7);
      await expect(
        db.exec(
          `INSERT INTO access_expected_group_sources(group_id,team_id,participant_id) VALUES(1,8,42)`,
        ),
      ).rejects.toThrow();
      await expect(
        db.exec(`INSERT INTO access_expected_group_sources(group_id,team_id) VALUES(1,8)`),
      ).rejects.toThrow();
      await db.exec(`INSERT INTO access_scan_events VALUES
        (8,44,1,1,'midi','2027-07-31 10:40Z','2027-07-31 10:40Z','REJECTED_NOT_EXPECTED',false),
        (9,44,1,1,'midi','2027-07-31 10:41Z','2027-07-31 10:41Z','ACCEPTED',false);
        INSERT INTO access_passage_exceptions VALUES(1,1,44,1,'2027-07-31 10:41Z','Accompagne le groupe',9,8,3);`);
      const exceptions = (
        await db.query<Record<string, unknown>>(EXPECTED_GROUP_SQL.statusRows, [
          1,
          1,
          'EXCEPTION',
          50,
          0,
        ])
      ).rows;
      expect(exceptions).toHaveLength(1);
      expect(exceptions[0]).toMatchObject({
        participantId: 44,
        status: 'CONFIRMED',
        isException: true,
        exception: {
          authorizedEmail: 'admin@test',
          reason: 'Accompagne le groupe',
          eventId: 9,
          sessionId: 3,
        },
        lastAttempt: { verdict: 'ACCEPTED', needsReview: false },
      });
      expect(exceptions[0].exception).toHaveProperty('refusedAt');
      expect(
        (await db.query<Record<string, unknown>>(EXPECTED_GROUP_SQL.statusCounts, [1, 1])).rows[0],
      ).toMatchObject({
        exceptions: 1,
        confirmed: 2,
      });
      // Exercise the public read service against SQL, not a mocked list.
      await db.exec(`INSERT INTO participants(id,"firstName","lastName",type,status)
        SELECT 300+i,'Pagination '||lpad(i::text,2,'0'),'Test','ANIMATEUR','CONFIRMED' FROM generate_series(1,60) i;
        INSERT INTO access_expected_group_sources(group_id,participant_id) SELECT 1,300+i FROM generate_series(1,60) i;`);
      const actual = new AccessExpectedGroupsService({
        transaction: async (_isolation: string, work: (m: unknown) => unknown) =>
          work({
            query: async (sql: string, args: unknown[]) =>
              (await db.query<Record<string, unknown>>(sql, args)).rows,
          }),
      } as never);
      const first = await actual.status(
        1,
        Object.assign(new ExpectedPageQuery(), { limit: 50, offset: 0 }),
      );
      const second = await actual.status(
        1,
        Object.assign(new ExpectedPageQuery(), { limit: 50, offset: 50 }),
      );
      expect(first.total).toBe(64);
      expect(first.counts.expected).toBe(64);
      expect(first.items).toHaveLength(50);
      expect(second.total).toBe(64);
      expect(second.items).toHaveLength(14);
      expect(
        new Set([...first.items, ...second.items].map((r: { personKey: string }) => r.personKey))
          .size,
      ).toBe(64);
      const onlyExceptions = await actual.status(
        1,
        Object.assign(new ExpectedPageQuery(), { status: 'EXCEPTION' }),
      );
      expect(onlyExceptions.total).toBe(1);
      expect(onlyExceptions.items).toHaveLength(1);
      expect(onlyExceptions.counts.expected).toBe(64);
      const searched = await actual.status(
        1,
        Object.assign(new ExpectedPageQuery(), { q: 'Pagination 60' }),
      );
      expect(searched.total).toBe(1);
      expect(searched.items[0].participantId).toBe(360);
      await migration.down(runner as never);
      expect(
        (
          await db.query<Record<string, unknown>>(
            'SELECT count(*)::int AS n FROM access_scan_events',
          )
        ).rows[0].n,
      ).toBe(9);
    } finally {
      await db.close();
    }
  }, 20000);
});
