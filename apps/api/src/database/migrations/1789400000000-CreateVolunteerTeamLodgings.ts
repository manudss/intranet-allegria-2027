import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVolunteerTeamLodgings1789400000000 implements MigrationInterface {
  name = 'CreateVolunteerTeamLodgings1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "volunteer_team_lodgings" (
      "id" SERIAL NOT NULL,
      "volunteer_id" integer NOT NULL,
      "team_id" integer NOT NULL,
      "room" character varying(120),
      "notes" text,
      "start_at" date,
      "end_at" date,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_team_lodgings" PRIMARY KEY ("id"),
      CONSTRAINT "uq_volunteer_team_lodging_volunteer" UNIQUE ("volunteer_id"),
      CONSTRAINT "FK_vtl_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT "FK_vtl_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "volunteer_team_lodgings"`);
  }
}
