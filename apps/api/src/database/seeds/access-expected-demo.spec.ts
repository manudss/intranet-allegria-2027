import { PGlite } from '@electric-sql/pglite';
import { describe, it, expect } from 'vitest';
import { seedAccessExpectedDemo } from './access-expected-demo';
describe('Expected QR seed demo', () => {
  it('seeds a passage, explicit scoped grant and exception with seven-day window', async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE access_expected_groups(id serial primary key,name text,created_by int);CREATE TABLE access_expected_group_sources(group_id int,participant_id int);
 CREATE TABLE access_expected_passages(id serial primary key,group_id int,point_id int,scan_type_id int,service_key text,label text,starts_at timestamptz,ends_at timestamptz,timezone text,created_by int,CHECK(ends_at>starts_at AND ends_at<=starts_at+interval '31 days'));
 CREATE TABLE access_scan_points(id int,expected_online_required bool);INSERT INTO access_scan_points VALUES(7,false);
 CREATE TABLE access_exception_grants(user_id int,point_id int,created_by int,starts_at timestamptz,ends_at timestamptz);
 CREATE TABLE access_passage_exceptions(passage_id int,participant_id int,authorized_by int,session_id int,reason text,created_at timestamptz,refused_event_id int,accepted_event_id int,operation_id text);`);
      const result = await seedAccessExpectedDemo(
        {
          query: async (sql: string, args: unknown[]) => (await db.query(sql, args)).rows,
        } as never,
        {
          adminId: 1,
          scannerId: 2,
          pointId: 7,
          scanTypeId: 3,
          sessionId: 4,
          memberIds: [10, 11, 12],
          exceptionParticipantId: 13,
          refusedEventId: 20,
          acceptedEventId: 21,
          now: new Date('2026-11-13T14:00:00Z'),
        },
      );
      expect(result).toEqual({ groupId: 1, passageId: 1 });
      expect((await db.query('SELECT * FROM access_expected_group_sources')).rows).toHaveLength(3);
      expect((await db.query('SELECT * FROM access_exception_grants')).rows[0]).toMatchObject({
        user_id: 2,
        point_id: 7,
      });
      expect((await db.query('SELECT * FROM access_scan_points')).rows[0]).toMatchObject({
        expected_online_required: true,
      });
      expect((await db.query('SELECT * FROM access_passage_exceptions')).rows[0]).toMatchObject({
        participant_id: 13,
        refused_event_id: 20,
        accepted_event_id: 21,
      });
      expect((await db.query('SELECT * FROM access_expected_passages')).rows[0]).toMatchObject({
        service_key: 'qr-demo-groupe',
        timezone: 'Europe/Paris',
      });
    } finally {
      await db.close();
    }
  }, 20000);
});
