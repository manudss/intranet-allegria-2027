import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateAccessPassageExceptions1789900000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TYPE access_scan_verdict_enum ADD VALUE IF NOT EXISTS 'REJECTED_NOT_EXPECTED'`,
    );
    await q.query(`CREATE TABLE access_exception_grants(
   id serial PRIMARY KEY,user_id int NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
   point_id int NOT NULL REFERENCES access_scan_points(id) ON DELETE RESTRICT,
   created_by int NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
   starts_at timestamptz NOT NULL DEFAULT now(),ends_at timestamptz,
   CHECK(ends_at IS NULL OR ends_at>starts_at))`);
    await q.query(
      'CREATE INDEX access_exception_grants_user_point_idx ON access_exception_grants(user_id,point_id)',
    );
    await q.query(`CREATE TABLE access_passage_exceptions(
   id serial PRIMARY KEY,passage_id int NOT NULL REFERENCES access_expected_passages(id) ON DELETE RESTRICT,
   participant_id int NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
   authorized_by int NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
   session_id int NOT NULL REFERENCES access_scan_sessions(id) ON DELETE RESTRICT,
   reason varchar(300) NOT NULL CHECK(length(trim(reason))>=3),created_at timestamptz NOT NULL DEFAULT now(),
   refused_event_id int NOT NULL UNIQUE REFERENCES access_scan_events(id) ON DELETE RESTRICT,
   accepted_event_id int NOT NULL UNIQUE REFERENCES access_scan_events(id) ON DELETE RESTRICT,
   operation_id varchar(80) NOT NULL UNIQUE,
   UNIQUE(passage_id,participant_id))`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE access_passage_exceptions');
    await q.query('DROP TABLE access_exception_grants');
    // PostgreSQL enums cannot safely remove a used value. Events stay immutable.
  }
}
