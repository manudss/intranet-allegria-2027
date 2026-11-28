import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { SplitPersonNotesAccess1791200000000 } from '../../../database/migrations/1791200000000-SplitPersonNotesAccess';

/** Vraie base PostgreSQL (PGlite), données fictives : la migration copie les règles et exceptions réelles (portées et fins de validité comprises), est idempotente, et son retour ne supprime que ce qu'elle a créé. */
describe('migration SplitPersonNotesAccess sur base réelle', () => {
  it('copie, idempotence, retour arrière limité aux lignes créées', async () => {
    const db = new PGlite();
    try {
      const qr = {
        query: async (sql: string) => (await db.query(sql)).rows,
        hasTable: async (t: string) =>
          ((await db.query(`SELECT to_regclass('public.${t}') IS NOT NULL AS e`)).rows[0] as { e: boolean }).e,
      } as never;
      await db.exec(`
        CREATE TABLE users(id serial PRIMARY KEY);
        INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES;
        CREATE TABLE access_rules(id serial PRIMARY KEY, subject_kind varchar(20) NOT NULL, subject_key varchar(80) NOT NULL, module varchar(60) NOT NULL, level varchar(10) NOT NULL, scope varchar(20) NOT NULL DEFAULT 'ALL', CONSTRAINT uq UNIQUE(subject_kind, subject_key, module));
        CREATE TABLE access_overrides(id serial PRIMARY KEY, user_id int NOT NULL REFERENCES users(id), module varchar(60) NOT NULL, level varchar(10) NOT NULL, scope varchar(20) NOT NULL DEFAULT 'ALL', reason text NOT NULL, expires_at timestamptz, created_by int);
        INSERT INTO access_rules(subject_kind, subject_key, module, level, scope) VALUES
          ('ROLE','ADMIN','PARTICIPANTS','MANAGE','ALL'),
          ('ROLE','ANIMATOR','PARTICIPANTS','VIEW','OWN_TEAM'),
          ('TEAM_TYPE','ACCUEIL','PARTICIPANTS','EDIT','GROUPS'),
          ('ROLE','HEALTH','PARTICIPANTS','VIEW','SELF'),
          ('ROLE','ADMIN','TRANSPORT','MANAGE','ALL'),
          ('ROLE','HEALTH','PERSON_NOTES','MANAGE','ALL');
        INSERT INTO access_overrides(user_id, module, level, scope, reason, expires_at, created_by) VALUES
          (1,'PARTICIPANTS','VIEW','GROUPS','exception A','2027-01-01T00:00:00Z',2),
          (2,'PARTICIPANTS','EDIT','SELF','exception B',NULL,NULL),
          (2,'PERSON_NOTES','EDIT','SELF','exception B',NULL,NULL),
          (1,'TRANSPORT','EDIT','GROUPS','autre module',NULL,NULL);
      `);
      const snapshot = async () =>
        JSON.stringify([
          (await db.query(`SELECT * FROM access_rules ORDER BY id`)).rows,
          (await db.query(`SELECT * FROM access_overrides ORDER BY id`)).rows,
        ]);
      const before = await snapshot();
      const m = new SplitPersonNotesAccess1791200000000();

      await m.up(qr);
      const afterUp = await snapshot();
      await m.up(qr);
      expect(await snapshot()).toBe(afterUp); // idempotente

      // Portée, niveau et fin de validité recopiés tels quels ; la règle PERSON_NOTES préexistante est gardée.
      const notes = (await db.query(`SELECT subject_key, level, scope FROM access_rules WHERE module='PERSON_NOTES' ORDER BY subject_key`)).rows;
      expect(notes).toEqual([
        { subject_key: 'ACCUEIL', level: 'EDIT', scope: 'GROUPS' },
        { subject_key: 'ADMIN', level: 'MANAGE', scope: 'ALL' },
        { subject_key: 'ANIMATOR', level: 'VIEW', scope: 'OWN_TEAM' },
        { subject_key: 'HEALTH', level: 'MANAGE', scope: 'ALL' },
      ]);
      const ov = (await db.query(`SELECT user_id, level, scope, reason, expires_at IS NOT NULL AS has_end FROM access_overrides WHERE module='PERSON_NOTES' ORDER BY user_id`)).rows;
      expect(ov).toEqual([
        { user_id: 1, level: 'VIEW', scope: 'GROUPS', reason: 'exception A', has_end: true },
        { user_id: 2, level: 'EDIT', scope: 'SELF', reason: 'exception B', has_end: false },
      ]);

      await m.down(qr);
      expect(await snapshot()).toBe(before); // seules les lignes créées par up partent, la ligne préexistante reste
      expect((await db.query(`SELECT to_regclass('public.person_notes_split_log') AS t`)).rows[0]).toEqual({ t: null });
      await m.down(qr); // sans table de suivi : rien n'est supprimé
      expect(await snapshot()).toBe(before);
    } finally {
      await db.close();
    }
  });
});
