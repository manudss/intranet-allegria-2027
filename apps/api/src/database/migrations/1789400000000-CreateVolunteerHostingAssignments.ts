import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVolunteerHostingAssignments1789400000000 implements MigrationInterface {
  name = 'CreateVolunteerHostingAssignments1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."volunteer_hosting_type_enum" AS ENUM(
      'HOST_FAMILY',
      'ON_SITE',
      'OTHER'
    )`);

    await queryRunner.query(`CREATE TABLE "volunteer_hosting_assignments" (
      "id" SERIAL NOT NULL,
      "volunteer_id" integer NOT NULL,
      "type" "public"."volunteer_hosting_type_enum" NOT NULL DEFAULT 'OTHER',
      "host_family_id" integer,
      "location_name" character varying(200),
      "address" character varying(255),
      "room" character varying(120),
      "notes" text,
      "start_at" date,
      "end_at" date,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_hosting_assignments" PRIMARY KEY ("id"),
      CONSTRAINT "uq_volunteer_hosting_volunteer" UNIQUE ("volunteer_id"),
      CONSTRAINT "FK_vha_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT "FK_vha_host_family" FOREIGN KEY ("host_family_id") REFERENCES "host_families"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "volunteer_hosting_assignments"`);
    await queryRunner.query(`DROP TYPE "public"."volunteer_hosting_type_enum"`);
  }
}
