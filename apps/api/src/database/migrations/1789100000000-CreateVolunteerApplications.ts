import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVolunteerApplications1789100000000 implements MigrationInterface {
  name = 'CreateVolunteerApplications1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."volunteer_application_status_enum" AS ENUM(
      'PENDING',
      'APPROVED',
      'REJECTED'
    )`);

    await queryRunner.query(`CREATE TABLE "volunteer_applications" (
      "id" SERIAL NOT NULL,
      "firstName" character varying(120) NOT NULL,
      "lastName" character varying(120) NOT NULL,
      "email" character varying(255) NOT NULL,
      "phone" character varying(40) NOT NULL,
      "missionsOfInterest" text array,
      "availability" text,
      "motivation" text,
      "status" "public"."volunteer_application_status_enum" NOT NULL DEFAULT 'PENDING',
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_applications_id" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_applications_status" ON "volunteer_applications" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_applications_createdAt" ON "volunteer_applications" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_applications_createdAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_applications_status"`);
    await queryRunner.query(`DROP TABLE "volunteer_applications"`);
    await queryRunner.query(`DROP TYPE "public"."volunteer_application_status_enum"`);
  }
}
