import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVolunteerTeams1787310000000 implements MigrationInterface {
  name = 'CreateVolunteerTeams1787310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "volunteer_teams" (
      "id" SERIAL NOT NULL,
      "name" character varying(150) NOT NULL,
      "code" character varying(80) NOT NULL,
      "description" text,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_teams_id" PRIMARY KEY ("id"),
      CONSTRAINT "uq_volunteer_teams_code" UNIQUE ("code")
    )`);

    await queryRunner.query(`CREATE TABLE "volunteer_team_memberships" (
      "id" SERIAL NOT NULL,
      "volunteer_id" integer NOT NULL,
      "volunteer_team_id" integer NOT NULL,
      "startAt" date,
      "endAt" date,
      "role" character varying(120),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_team_memberships_id" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_volunteer_team_memberships_period" CHECK (("startAt" IS NULL OR "endAt" IS NULL OR "endAt" > "startAt"))
    )`);

    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_volunteer_team_memberships_unique_scope"
      ON "volunteer_team_memberships" ("volunteer_id", "volunteer_team_id", (COALESCE("startAt", '0001-01-01'::date)))`);
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_team_memberships_volunteer" ON "volunteer_team_memberships" ("volunteer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_team_memberships_team" ON "volunteer_team_memberships" ("volunteer_team_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_volunteer_team_memberships_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_volunteer_team_memberships_team" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`INSERT INTO "roles" ("code", "label")
      SELECT 'VOLUNTEERS', 'Bénévoles'
      WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "code" = 'VOLUNTEERS')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "roles" WHERE "code" = 'VOLUNTEERS'`);
    await queryRunner.query(
      `ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_volunteer_team_memberships_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_volunteer_team_memberships_volunteer"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_team_memberships_team"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_team_memberships_volunteer"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_team_memberships_unique_scope"`);
    await queryRunner.query(`DROP TABLE "volunteer_team_memberships"`);
    await queryRunner.query(`DROP TABLE "volunteer_teams"`);
  }
}
