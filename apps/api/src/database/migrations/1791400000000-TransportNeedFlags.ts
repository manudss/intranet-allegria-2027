import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Besoin de transport du rassemblement sur les groupes d'hébergement et les familles :
 * booléen NULLABLE, sans défaut. NULL = pas encore renseigné (distinct de « pas besoin »).
 * Aucune donnée existante n'est modifiée ni masquée par cette migration.
 */
export class TransportNeedFlags1791400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hosting_groups" ADD COLUMN IF NOT EXISTS "needs_transport" boolean`);
    await queryRunner.query(`ALTER TABLE "host_families" ADD COLUMN IF NOT EXISTS "needs_transport" boolean`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "host_families" DROP COLUMN IF EXISTS "needs_transport"`);
    await queryRunner.query(`ALTER TABLE "hosting_groups" DROP COLUMN IF EXISTS "needs_transport"`);
  }
}
