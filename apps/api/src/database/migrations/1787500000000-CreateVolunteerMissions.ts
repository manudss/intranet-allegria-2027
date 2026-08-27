import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVolunteerMissions1787500000000 implements MigrationInterface {
  name = 'CreateVolunteerMissions1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."volunteer_mission_status_enum" AS ENUM(
      'DRAFT',
      'TODO',
      'IN_PROGRESS',
      'DONE',
      'CANCELLED',
      'NOT_DONE'
    )`);

    await queryRunner.query(`CREATE TYPE "public"."volunteer_shift_status_enum" AS ENUM(
      'TODO',
      'ASSIGNED',
      'IN_PROGRESS',
      'DONE',
      'CANCELLED',
      'NOT_DONE'
    )`);

    await queryRunner.query(`CREATE TABLE "volunteer_missions" (
      "id" SERIAL NOT NULL,
      "title" character varying(200) NOT NULL,
      "description" text,
      "volunteer_team_id" integer,
      "location" character varying(200),
      "responsible_volunteer_id" integer,
      "status" "public"."volunteer_mission_status_enum" NOT NULL DEFAULT 'DRAFT',
      "isOptional" boolean NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_missions_id" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(`CREATE INDEX "IDX_volunteer_missions_team" ON "volunteer_missions" ("volunteer_team_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_volunteer_missions_status" ON "volunteer_missions" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_volunteer_missions_location" ON "volunteer_missions" ("location")`);
    await queryRunner.query(`CREATE INDEX "IDX_volunteer_missions_responsible" ON "volunteer_missions" ("responsible_volunteer_id")`);

    await queryRunner.query(`ALTER TABLE "volunteer_missions"
      ADD CONSTRAINT "FK_volunteer_missions_team"
      FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    await queryRunner.query(`ALTER TABLE "volunteer_missions"
      ADD CONSTRAINT "FK_volunteer_missions_responsible"
      FOREIGN KEY ("responsible_volunteer_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

    await queryRunner.query(`CREATE TABLE "volunteer_shifts" (
      "id" SERIAL NOT NULL,
      "mission_id" integer NOT NULL,
      "startAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "endAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "location" character varying(200),
      "capacity" integer,
      "status" "public"."volunteer_shift_status_enum" NOT NULL DEFAULT 'TODO',
      "isOptional" boolean NOT NULL DEFAULT false,
      "notes" text,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_shifts_id" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_volunteer_shifts_period" CHECK ("endAt" > "startAt"),
      CONSTRAINT "CHK_volunteer_shifts_capacity" CHECK ("capacity" IS NULL OR "capacity" > 0)
    )`);

    await queryRunner.query(`CREATE INDEX "IDX_volunteer_shifts_mission" ON "volunteer_shifts" ("mission_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_volunteer_shifts_start_at" ON "volunteer_shifts" ("startAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_volunteer_shifts_status" ON "volunteer_shifts" ("status")`);

    await queryRunner.query(`ALTER TABLE "volunteer_shifts"
      ADD CONSTRAINT "FK_volunteer_shifts_mission"
      FOREIGN KEY ("mission_id") REFERENCES "volunteer_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "volunteer_shifts" DROP CONSTRAINT "FK_volunteer_shifts_mission"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shifts_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shifts_start_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shifts_mission"`);
    await queryRunner.query(`DROP TABLE "volunteer_shifts"`);

    await queryRunner.query(`ALTER TABLE "volunteer_missions" DROP CONSTRAINT "FK_volunteer_missions_responsible"`);
    await queryRunner.query(`ALTER TABLE "volunteer_missions" DROP CONSTRAINT "FK_volunteer_missions_team"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_missions_responsible"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_missions_location"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_missions_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_missions_team"`);
    await queryRunner.query(`DROP TABLE "volunteer_missions"`);

    await queryRunner.query(`DROP TYPE "public"."volunteer_shift_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."volunteer_mission_status_enum"`);
  }
}




