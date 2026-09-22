import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceAccommodation1785061000000 implements MigrationInterface {
  name = 'EnhanceAccommodation1785061000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."host_families_status_enum" AS ENUM('DRAFT', 'VALIDATED', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."person_type_enum" AS ENUM('JEUNE', 'ANIMATEUR', 'BENEVOLE')`,
    );
    await queryRunner.query(`ALTER TABLE "host_families" ADD "latitude" double precision`);
    await queryRunner.query(`ALTER TABLE "host_families" ADD "longitude" double precision`);
    await queryRunner.query(`ALTER TABLE "host_families" ADD "maxAnimators" integer`);
    await queryRunner.query(`ALTER TABLE "host_families" ADD "constraints" text array`);
    await queryRunner.query(`ALTER TABLE "host_families" ADD "tags" text array`);
    await queryRunner.query(
      `ALTER TABLE "host_families" ADD "status" "public"."host_families_status_enum" NOT NULL DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" ADD "type" "public"."person_type_enum" NOT NULL DEFAULT 'JEUNE'`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."participant_host_family_assignments_status_enum" RENAME TO "participant_host_family_assignments_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."participant_host_family_assignments_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" ALTER COLUMN "status" TYPE "public"."participant_host_family_assignments_status_enum" USING (CASE WHEN "status"::text = 'PLANNED' THEN 'PENDING' WHEN "status"::text = 'COMPLETED' THEN 'CONFIRMED' ELSE "status"::text END)::"public"."participant_host_family_assignments_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."participant_host_family_assignments_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" ADD "type" "public"."person_type_enum" NOT NULL DEFAULT 'JEUNE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" ADD "groupId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" ADD "roomLabel" character varying(120)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assignments_host_family" ON "participant_host_family_assignments" ("host_family_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assignments_participant_status" ON "participant_host_family_assignments" ("participant_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_assignments_participant_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_assignments_host_family"`);
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" DROP COLUMN "roomLabel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" DROP COLUMN "groupId"`,
    );
    await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" DROP COLUMN "type"`);
    await queryRunner.query(`ALTER TABLE "participants" DROP COLUMN "type"`);
    await queryRunner.query(`ALTER TABLE "host_families" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "host_families" DROP COLUMN "tags"`);
    await queryRunner.query(`ALTER TABLE "host_families" DROP COLUMN "constraints"`);
    await queryRunner.query(`ALTER TABLE "host_families" DROP COLUMN "maxAnimators"`);
    await queryRunner.query(`ALTER TABLE "host_families" DROP COLUMN "longitude"`);
    await queryRunner.query(`ALTER TABLE "host_families" DROP COLUMN "latitude"`);
    await queryRunner.query(`DROP TYPE "public"."person_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."host_families_status_enum"`);
  }
}
