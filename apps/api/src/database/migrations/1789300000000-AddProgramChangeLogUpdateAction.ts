import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProgramChangeLogUpdateAction1789300000000 implements MigrationInterface {
  name = 'AddProgramChangeLogUpdateAction1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."program_change_log_action_enum" ADD VALUE IF NOT EXISTS 'UPDATE'`,
    );
  }

  public async down(): Promise<void> {
    // Une valeur d'enum PostgreSQL ne peut pas être retirée simplement : volontairement sans effet.
  }
}
