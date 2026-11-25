import { MigrationInterface, QueryRunner } from 'typeorm';

/** Legacy missionIds remain the compatibility source for membership; this table adds phase only. */
export class ProgramMissionTiming1790500000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE program_mission_phases (
      sequence_id integer NOT NULL REFERENCES program_sequences(id) ON DELETE CASCADE,
      mission_id integer NOT NULL REFERENCES volunteer_missions(id) ON DELETE CASCADE,
      phase varchar(8) NOT NULL CHECK (phase IN ('BEFORE','DURING','AFTER')),
      PRIMARY KEY(sequence_id, mission_id))`);
    await q.query(`CREATE TABLE program_shift_bindings (
      shift_id integer PRIMARY KEY REFERENCES volunteer_shifts(id) ON DELETE CASCADE,
      sequence_id integer NOT NULL REFERENCES program_sequences(id) ON DELETE RESTRICT,
      start_anchor varchar(5) NOT NULL CHECK(start_anchor IN ('START','END')),
      end_anchor varchar(5) NOT NULL CHECK(end_anchor IN ('START','END')),
      start_offset integer NOT NULL CHECK(abs(start_offset) <= 525600),
      end_offset integer NOT NULL CHECK(abs(end_offset) <= 525600))`);
    await q.query(`CREATE INDEX ON program_shift_bindings(sequence_id)`);
    // All writers of scheduling inputs share a transaction-level mutex, including older APIs.
    await q.query(`CREATE FUNCTION program_timing_guard() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(71927, 2);
        IF TG_TABLE_NAME = 'volunteer_shifts' AND TG_OP = 'UPDATE' AND
          (NEW."startAt" IS DISTINCT FROM OLD."startAt" OR NEW."endAt" IS DISTINCT FROM OLD."endAt") AND
          EXISTS (SELECT 1 FROM program_shift_bindings WHERE shift_id = OLD.id) AND
          current_setting('allegria.program_timing', true) IS DISTINCT FROM 'apply' THEN
          RAISE EXCEPTION 'Créneau piloté par un événement : utiliser son aperçu des horaires.';
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END $$`);
    await q.query(
      `CREATE FUNCTION program_timing_lock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(71927, 2); RETURN NULL; END $$`,
    );
    for (const table of [
      'program_sequences',
      'program_mission_phases',
      'program_shift_bindings',
      'volunteer_shifts',
      'volunteer_shift_assignments',
    ]) {
      await q.query(
        `CREATE TRIGGER program_timing_mutex BEFORE INSERT OR UPDATE OR DELETE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION program_timing_lock()`,
      );
    }
    await q.query(
      `CREATE TRIGGER program_shift_timing_guard BEFORE UPDATE ON volunteer_shifts FOR EACH ROW EXECUTE FUNCTION program_timing_guard()`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER program_shift_timing_guard ON volunteer_shifts`);
    for (const table of [
      'program_sequences',
      'program_mission_phases',
      'program_shift_bindings',
      'volunteer_shifts',
      'volunteer_shift_assignments',
    ]) {
      await q.query(`DROP TRIGGER program_timing_mutex ON ${table}`);
    }
    await q.query(
      `DROP FUNCTION program_timing_guard(); DROP FUNCTION program_timing_lock(); DROP TABLE program_shift_bindings; DROP TABLE program_mission_phases`,
    );
  }
}
