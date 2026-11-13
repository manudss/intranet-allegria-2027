import { PGlite } from '@electric-sql/pglite';
import { describe, it, expect } from 'vitest';
import { CreateAccessExpectedGroups1789800000000 } from '../../../database/migrations/1789800000000-CreateAccessExpectedGroups';
import { EXPECTED_GROUP_SQL } from './access-expected-groups.sql';

describe('Expected groups data model', () => {
  it('migrates both ways and resolves current sources, unbadged volunteers and individual service attendance', async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TYPE person_type_enum AS ENUM('JEUNE','ANIMATEUR','BENEVOLE');
   CREATE TABLE users(id int PRIMARY KEY); INSERT INTO users VALUES(1);
   CREATE TABLE volunteers(id int PRIMARY KEY,"firstName" text,"lastName" text);
   CREATE TABLE participants(id int PRIMARY KEY,volunteer_id int UNIQUE,"firstName" text,"lastName" text,type person_type_enum,status text);
   CREATE TABLE teams(id int PRIMARY KEY,primary_animator_id int,secondary_animator_id int);
   CREATE TABLE team_participants(team_id int,participant_id int);
   CREATE TABLE access_scan_points(id int PRIMARY KEY);
   CREATE TABLE access_scan_types(id int PRIMARY KEY);
   CREATE TABLE access_scan_events(id int PRIMARY KEY,participant_id int,point_id int,scan_type_id int,service_key text,occurred_at_local timestamptz,received_at timestamptz,verdict text,needs_review bool);
   INSERT INTO access_scan_points VALUES(1),(2); INSERT INTO access_scan_types VALUES(1);
   INSERT INTO volunteers VALUES(10,'Volunteer','Sans badge'),(11,'Volunteer','Projeté');
   INSERT INTO participants VALUES(42,NULL,'Ada','Privé','JEUNE','CONFIRMED'),(43,NULL,'Noé','Privé','JEUNE','CONFIRMED'),(44,NULL,'Louis','Exemple','ANIMATEUR','CONFIRMED'),(45,11,'Volunteer','Projeté','BENEVOLE','CONFIRMED'),(46,NULL,'Pending','Privé','JEUNE','PENDING');
   INSERT INTO teams VALUES(8,10,NULL); INSERT INTO team_participants VALUES(8,42),(8,43);
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
      const members = (await db.query(EXPECTED_GROUP_SQL.members, [1, 50, 0])).rows;
      expect(members).toHaveLength(5); // sources are a union, not multiplied
      expect(members.find((r) => r.participantId === 42)?.lastName).toBeNull();
      expect(members.find((r) => r.volunteerId === 10)).toMatchObject({
        personKey: 'volunteer:10',
        participantId: null,
      });
      expect((await db.query(EXPECTED_GROUP_SQL.statusCounts, [1, 1])).rows[0]).toEqual({
        expected: 5,
        confirmed: 1,
        reviewOnly: 1,
        notConfirmed: 3,
      });
      expect(
        (await db.query(EXPECTED_GROUP_SQL.statusRows, [1, 1, 'NOT_CONFIRMED', 50, 0])).rows,
      ).toHaveLength(3);
      // Creating the volunteer projection later changes neither identity nor count.
      await db.exec(
        `INSERT INTO participants VALUES(50,10,'Volunteer','Sans badge','BENEVOLE','CONFIRMED')`,
      );
      expect((await db.query(EXPECTED_GROUP_SQL.memberCount, [1])).rows[0].total).toBe(5);
      expect(
        (await db.query(EXPECTED_GROUP_SQL.members, [1, 50, 0])).rows.find(
          (r) => r.volunteerId === 10,
        )?.personKey,
      ).toBe('volunteer:10');
      // Current group composition follows team changes. Historical events stay put.
      await db.exec(
        `DELETE FROM access_expected_group_sources WHERE person_type='JEUNE'; DELETE FROM team_participants WHERE participant_id=43;`,
      );
      expect((await db.query(EXPECTED_GROUP_SQL.memberCount, [1])).rows[0].total).toBe(4);
      expect((await db.query('SELECT count(*)::int AS n FROM access_scan_events')).rows[0].n).toBe(
        7,
      );
      await expect(
        db.exec(
          `INSERT INTO access_expected_group_sources(group_id,team_id,participant_id) VALUES(1,8,42)`,
        ),
      ).rejects.toThrow();
      await expect(
        db.exec(`INSERT INTO access_expected_group_sources(group_id,team_id) VALUES(1,8)`),
      ).rejects.toThrow();
      await migration.down(runner as never);
      expect((await db.query('SELECT count(*)::int AS n FROM access_scan_events')).rows[0].n).toBe(
        7,
      );
    } finally {
      await db.close();
    }
  }, 20000);
});
