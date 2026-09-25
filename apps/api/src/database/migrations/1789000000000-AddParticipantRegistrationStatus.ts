import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParticipantRegistrationStatus1789000000000 implements MigrationInterface {
  name = 'AddParticipantRegistrationStatus1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."participant_registration_status_enum" AS ENUM(
      'PENDING',
      'CONFIRMED'
    )`);

    await queryRunner.query(`CREATE TYPE "public"."person_source_enum" AS ENUM(
      'PUBLIC_FORM',
      'STAFF'
    )`);

    await queryRunner.query(`ALTER TABLE "participants"
      ADD COLUMN "status" "public"."participant_registration_status_enum" NOT NULL DEFAULT 'CONFIRMED'`);

    await queryRunner.query(`ALTER TABLE "participants"
      ADD COLUMN "source" "public"."person_source_enum" NOT NULL DEFAULT 'STAFF'`);

    await queryRunner.query(
      `CREATE INDEX "IDX_participants_status" ON "participants" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_participants_status"`);
    await queryRunner.query(`ALTER TABLE "participants" DROP COLUMN "source"`);
    await queryRunner.query(`ALTER TABLE "participants" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."person_source_enum"`);
    await queryRunner.query(`DROP TYPE "public"."participant_registration_status_enum"`);
  }
}
