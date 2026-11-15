import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProgramSequenceTrack1790100000000 implements MigrationInterface {
  name = 'AddProgramSequenceTrack1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."program_sequence_track_enum" AS ENUM('TA', 'ES', 'COMMON')`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_sequences" ADD "track" "public"."program_sequence_track_enum" NOT NULL DEFAULT 'COMMON'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "program_sequences" DROP COLUMN "track"`);
    await queryRunner.query(`DROP TYPE "public"."program_sequence_track_enum"`);
  }
}
