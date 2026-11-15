import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Visibilité public/réservé sur les séquences (défaut INTERNAL : un créneau reste
 * interne tant qu'il n'est pas explicitement publié) et table des instantanés
 * publics régénérés par bouton, lus par l'appli non connectée.
 */
export class ProgramVisibilityAndPublicExport1790200000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TYPE program_sequence_visibility_enum AS ENUM ('PUBLIC', 'INTERNAL')`,
    );
    await q.query(
      `ALTER TABLE program_sequences ADD COLUMN visibility program_sequence_visibility_enum NOT NULL DEFAULT 'INTERNAL'`,
    );
    await q.query(`
      CREATE TABLE program_public_exports (
        event_date date PRIMARY KEY,
        sequences jsonb NOT NULL,
        generated_by_user_id int NULL,
        generated_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE program_public_exports');
    await q.query('ALTER TABLE program_sequences DROP COLUMN visibility');
    await q.query('DROP TYPE program_sequence_visibility_enum');
  }
}
