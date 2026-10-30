import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProgram1789200000000 implements MigrationInterface {
  name = 'CreateProgram1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."program_change_log_action_enum" AS ENUM('INSERT', 'RESIZE', 'MOVE', 'FREEZE', 'UNFREEZE', 'DELETE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "program_change_logs" ("id" SERIAL NOT NULL, "action" "public"."program_change_log_action_enum" NOT NULL, "author_user_id" integer NOT NULL, "eventDate" date NOT NULL, "affectedSequenceIds" jsonb NOT NULL DEFAULT '[]', "beforeSnapshot" jsonb, "afterSnapshot" jsonb, "comment" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b136945769f63f6b0394801525f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_program_change_logs_event_date" ON "program_change_logs" ("eventDate")`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."program_sequence_status_enum" AS ENUM('MOBILE', 'FROZEN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "program_sequences" ("id" SERIAL NOT NULL, "eventDate" date NOT NULL, "location" character varying(150) NOT NULL, "title" character varying(200) NOT NULL, "startTime" character varying(5) NOT NULL, "durationMinutes" integer NOT NULL, "endTime" character varying(5) NOT NULL, "status" "public"."program_sequence_status_enum" NOT NULL DEFAULT 'MOBILE', "minDurationMinutes" integer, "minMarginMinutes" integer, "previous_sequence_id" integer, "anchor_sequence_id" integer, "volunteer_team_id" integer, "missionIds" jsonb NOT NULL DEFAULT '[]', "documentLinks" jsonb NOT NULL DEFAULT '[]', "notes" text, "frozen_by_user_id" integer, "frozenAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2725cb87491bfddcfe35b82b4cd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_program_sequences_day_location" ON "program_sequences" ("eventDate", "location")`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_change_logs" ADD CONSTRAINT "FK_63f97603ac77fae163f5bb70ef4" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_sequences" ADD CONSTRAINT "FK_70a81d4b02149c7ebcdf24491f7" FOREIGN KEY ("previous_sequence_id") REFERENCES "program_sequences"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_sequences" ADD CONSTRAINT "FK_fc76f9314c0a0fc3296ef9efaf7" FOREIGN KEY ("anchor_sequence_id") REFERENCES "program_sequences"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_sequences" ADD CONSTRAINT "FK_244511b19ff67aaab4a6b33f26d" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_sequences" ADD CONSTRAINT "FK_2e1e3d3a2fc8ca87c130cbb9733" FOREIGN KEY ("frozen_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_sequences" DROP CONSTRAINT "FK_2e1e3d3a2fc8ca87c130cbb9733"`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_sequences" DROP CONSTRAINT "FK_244511b19ff67aaab4a6b33f26d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_sequences" DROP CONSTRAINT "FK_fc76f9314c0a0fc3296ef9efaf7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_sequences" DROP CONSTRAINT "FK_70a81d4b02149c7ebcdf24491f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_change_logs" DROP CONSTRAINT "FK_63f97603ac77fae163f5bb70ef4"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_program_sequences_day_location"`);
    await queryRunner.query(`DROP TABLE "program_sequences"`);
    await queryRunner.query(`DROP TYPE "public"."program_sequence_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_program_change_logs_event_date"`);
    await queryRunner.query(`DROP TABLE "program_change_logs"`);
    await queryRunner.query(`DROP TYPE "public"."program_change_log_action_enum"`);
  }
}
