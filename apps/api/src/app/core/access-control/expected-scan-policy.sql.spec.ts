import { PGlite } from '@electric-sql/pglite';
import { describe, it, expect } from 'vitest';
import { CreateAccessPassageExceptions1789900000000 } from '../../../database/migrations/1789900000000-CreateAccessPassageExceptions';
describe('Exception persistence PostgreSQL', () => {
  it('migrates with strict references, immutable initial refusal and unique idempotence', async () => {
    const db = new PGlite();
    try {
      await db.exec(
        `CREATE TYPE access_scan_verdict_enum AS ENUM('ACCEPTED','DUPLICATE');CREATE TABLE users(id int PRIMARY KEY);INSERT INTO users VALUES(1);CREATE TABLE access_scan_points(id int PRIMARY KEY);INSERT INTO access_scan_points VALUES(3);CREATE TABLE participants(id int PRIMARY KEY);INSERT INTO participants VALUES(42);CREATE TABLE access_scan_sessions(id int PRIMARY KEY);INSERT INTO access_scan_sessions VALUES(11);CREATE TABLE access_expected_passages(id int PRIMARY KEY);INSERT INTO access_expected_passages VALUES(4);CREATE TABLE access_scan_events(id int PRIMARY KEY,verdict access_scan_verdict_enum);`,
      );
      const runner = { query: (sql: string) => db.exec(sql) };
      const migration = new CreateAccessPassageExceptions1789900000000();
      await migration.up(runner as never);
      await db.exec(
        `INSERT INTO access_scan_events VALUES(7,'REJECTED_NOT_EXPECTED'),(99,'ACCEPTED');INSERT INTO access_exception_grants(user_id,point_id,created_by) VALUES(1,3,1);INSERT INTO access_passage_exceptions(passage_id,participant_id,authorized_by,session_id,reason,refused_event_id,accepted_event_id,operation_id) VALUES(4,42,1,11,'Accompagne équipe',7,99,'operation-1');`,
      );
      expect(
        (
          await db.query<Record<string, unknown>>(
            'SELECT verdict FROM access_scan_events WHERE id=7',
          )
        ).rows[0].verdict,
      ).toBe('REJECTED_NOT_EXPECTED');
      await expect(
        db.exec(
          `INSERT INTO access_passage_exceptions(passage_id,participant_id,authorized_by,session_id,reason,refused_event_id,accepted_event_id,operation_id) VALUES(4,42,1,11,'Autre',7,99,'operation-1')`,
        ),
      ).rejects.toThrow();
      await expect(db.exec('DELETE FROM access_scan_events WHERE id=7')).rejects.toThrow();
      await migration.down(runner as never);
      expect(
        (
          await db.query<Record<string, unknown>>(
            'SELECT count(*)::int AS n FROM access_scan_events',
          )
        ).rows[0].n,
      ).toBe(2);
    } finally {
      await db.close();
    }
  }, 20000);
});
