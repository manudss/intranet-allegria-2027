import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { CreateDocumentLibrary1790500000000 } from '../../../database/migrations/1790500000000-CreateDocumentLibrary';

const runMigration = async (pg: PGlite): Promise<void> => {
  const migration = new CreateDocumentLibrary1790500000000();
  const runner = { query: (sql: string) => pg.exec(sql) };
  await migration.up(runner as never);
};

describe('Migration CreateDocumentLibrary', () => {
  it('crée les tables, les enums, les contraintes et les catégories initiales', async () => {
    const pg = new PGlite();
    try {
      // Prérequis minimaux des FK : users et volunteer_teams existent déjà en base.
      await pg.exec(`CREATE TABLE users(id SERIAL PRIMARY KEY, email text);
        CREATE TABLE volunteer_teams(id SERIAL PRIMARY KEY, name text, code text, "isActive" boolean DEFAULT true);`);
      await runMigration(pg);

      const categories = await pg.query<{ code: string; sortOrder: number }>(
        `SELECT code, "sortOrder" FROM document_categories ORDER BY "sortOrder"`,
      );
      expect(categories.rows.map((row) => row.code)).toEqual([
        'MUSIQUE',
        'ANIMATION',
        'ANIMATION_SPIRITUELLE',
        'LOGISTIQUE',
        'LIEN_EXTERNE',
        'COMMUNICATION',
        'FINANCES',
        'TA',
        'ES',
        'ANIMATEURS',
        'BENEVOLES',
      ]);

      // Insertion d'une fiche avec défauts enum.
      const inserted = await pg.query<{ id: number; fileType: string; visibility: string }>(
        `INSERT INTO document_links(title, url) VALUES ('Guide ES', 'https://mej.sharepoint.com/x')
         RETURNING id, "fileType", visibility`,
      );
      expect(inserted.rows[0].fileType).toBe('OTHER');
      expect(inserted.rows[0].visibility).toBe('ALL');
      const linkId = inserted.rows[0].id;

      // Restriction d'audience + unicité (link, team).
      await pg.exec(`INSERT INTO volunteer_teams(name, code) VALUES ('Cuisine', 'CUS-001')`);
      await pg.exec(
        `INSERT INTO document_link_teams(document_link_id, volunteer_team_id) VALUES (${linkId}, 1)`,
      );
      await expect(
        pg.exec(
          `INSERT INTO document_link_teams(document_link_id, volunteer_team_id) VALUES (${linkId}, 1)`,
        ),
      ).rejects.toThrow();

      // Unicité du code catégorie.
      await expect(
        pg.exec(`INSERT INTO document_categories(code, label) VALUES ('TA', 'Doublon')`),
      ).rejects.toThrow();

      // Suppression d'une fiche => restrictions en CASCADE.
      await pg.exec(`DELETE FROM document_links WHERE id = ${linkId}`);
      const restrictions = await pg.query(`SELECT * FROM document_link_teams`);
      expect(restrictions.rows).toHaveLength(0);

      // Suppression d'une catégorie => category_id NULL sur les fiches.
      const link2 = await pg.query<{ id: number }>(
        `INSERT INTO document_links(title, url, category_id)
         VALUES ('Doc catégorisé', 'https://mej.sharepoint.com/y',
           (SELECT id FROM document_categories WHERE code = 'TA')) RETURNING id`,
      );
      await pg.exec(`DELETE FROM document_categories WHERE code = 'TA'`);
      const orphan = await pg.query<{ category_id: number | null }>(
        `SELECT category_id FROM document_links WHERE id = ${link2.rows[0].id}`,
      );
      expect(orphan.rows[0].category_id).toBeNull();
    } finally {
      await pg.close();
    }
  }, 20000);
});
