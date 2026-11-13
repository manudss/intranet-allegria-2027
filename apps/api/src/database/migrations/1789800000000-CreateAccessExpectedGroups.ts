import { MigrationInterface, QueryRunner } from 'typeorm';

/** Expected populations foundation. This migration alone changes no scan decision. No collective scan. */
export class CreateAccessExpectedGroups1789800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE access_expected_groups (
      id serial PRIMARY KEY,
      name varchar(150) NOT NULL CHECK(length(trim(name)) > 0),
      archived_at timestamptz,
      version integer NOT NULL DEFAULT 1 CHECK(version > 0),
      created_by integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE access_expected_group_sources (
      id serial PRIMARY KEY,
      group_id integer NOT NULL REFERENCES access_expected_groups(id) ON DELETE CASCADE,
      team_id integer REFERENCES teams(id) ON DELETE RESTRICT,
      person_type person_type_enum,
      participant_id integer REFERENCES participants(id) ON DELETE RESTRICT,
      volunteer_id integer REFERENCES volunteers(id) ON DELETE RESTRICT,
      CHECK(num_nonnulls(team_id,person_type,participant_id,volunteer_id)=1)
    )`);
    for (const column of ['team_id', 'person_type', 'participant_id', 'volunteer_id']) {
      await q.query(
        `CREATE UNIQUE INDEX access_expected_group_${column}_uq ON access_expected_group_sources(group_id,${column}) WHERE ${column} IS NOT NULL`,
      );
    }
    await q.query(`CREATE TABLE access_expected_passages (
      id serial PRIMARY KEY,
      group_id integer NOT NULL REFERENCES access_expected_groups(id) ON DELETE RESTRICT,
      point_id integer NOT NULL REFERENCES access_scan_points(id) ON DELETE RESTRICT,
      scan_type_id integer NOT NULL REFERENCES access_scan_types(id) ON DELETE RESTRICT,
      service_key varchar(120),
      label varchar(150) NOT NULL CHECK(length(trim(label)) > 0),
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      timezone varchar(80) NOT NULL DEFAULT 'Europe/Paris',
      archived_at timestamptz,
      version integer NOT NULL DEFAULT 1 CHECK(version > 0),
      created_by integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK(ends_at > starts_at AND ends_at <= starts_at + interval '31 days'),
      CHECK(service_key IS NULL OR length(trim(service_key)) > 0)
    )`);
    await q.query(
      `CREATE INDEX access_expected_passages_point_window_idx ON access_expected_passages(point_id,starts_at,ends_at) WHERE archived_at IS NULL`,
    );
    await q.query(
      `CREATE INDEX access_expected_passages_group_idx ON access_expected_passages(group_id)`,
    );
    await q.query(
      `CREATE INDEX access_scan_events_person_time_idx ON access_scan_events(participant_id,(coalesce(occurred_at_local,received_at)) DESC,id DESC)`,
    );
    await q.query(
      `CREATE INDEX access_scan_events_point_service_time_idx ON access_scan_events(point_id,scan_type_id,service_key,(coalesce(occurred_at_local,received_at)))`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS access_scan_events_point_service_time_idx');
    await q.query('DROP INDEX IF EXISTS access_scan_events_person_time_idx');
    await q.query('DROP TABLE access_expected_passages');
    await q.query('DROP TABLE access_expected_group_sources');
    await q.query('DROP TABLE access_expected_groups');
  }
}
