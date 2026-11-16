import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renommage camelCase des colonnes de program_public_exports : la convention du
 * projet (program_sequences, program_change_logs) nomme les colonnes comme les
 * propriétés TypeORM (« eventDate », « generatedAt »...), le snake_case reste
 * réservé aux clés étrangères (generated_by_user_id, comme frozen_by_user_id).
 */
export class FixPublicExportColumnNames1790300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE program_public_exports RENAME COLUMN event_date TO "eventDate"`);
    await q.query(`ALTER TABLE program_public_exports RENAME COLUMN generated_at TO "generatedAt"`);
    await q.query(`ALTER TABLE program_public_exports RENAME COLUMN updated_at TO "updatedAt"`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE program_public_exports RENAME COLUMN "updatedAt" TO updated_at`);
    await q.query(`ALTER TABLE program_public_exports RENAME COLUMN "generatedAt" TO generated_at`);
    await q.query(`ALTER TABLE program_public_exports RENAME COLUMN "eventDate" TO event_date`);
  }
}
