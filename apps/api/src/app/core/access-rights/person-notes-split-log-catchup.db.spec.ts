import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { EnsurePersonNotesSplitLog1791300000000 } from '../../../database/migrations/1791300000000-EnsurePersonNotesSplitLog';
import { SplitPersonNotesAccess1791200000000 } from '../../../database/migrations/1791200000000-SplitPersonNotesAccess';

const exists = async (db: PGlite) =>
  ((await db.query(`SELECT to_regclass('public.person_notes_split_log') IS NOT NULL AS e`)).rows[0] as { e: boolean }).e;

const setup = async (db: PGlite) => {
  await db.exec(`
    CREATE TABLE users(id serial PRIMARY KEY);
    INSERT INTO users DEFAULT VALUES;
    CREATE TABLE access_rules(id serial PRIMARY KEY, subject_kind varchar(20) NOT NULL, subject_key varchar(80) NOT NULL, module varchar(60) NOT NULL, level varchar(10) NOT NULL, scope varchar(20) NOT NULL DEFAULT 'ALL', CONSTRAINT uq UNIQUE(subject_kind, subject_key, module));
    CREATE TABLE access_overrides(id serial PRIMARY KEY, user_id int NOT NULL REFERENCES users(id), module varchar(60) NOT NULL, level varchar(10) NOT NULL, scope varchar(20) NOT NULL DEFAULT 'ALL', reason text NOT NULL, expires_at timestamptz, created_by int);
    INSERT INTO access_rules(subject_kind, subject_key, module, level, scope) VALUES
      ('ROLE','ADMIN','PARTICIPANTS','MANAGE','ALL'),
      ('ROLE','ADMIN','PERSON_NOTES','MANAGE','ALL'),
      ('ROLE','ANIMATOR','PERSON_NOTES','VIEW','OWN_TEAM');
    INSERT INTO access_overrides(user_id, module, level, scope, reason) VALUES (1,'PERSON_NOTES','EDIT','SELF','copie de la v1');
  `);
};
const snapshot = async (db: PGlite) =>
  JSON.stringify([
    (await db.query(`SELECT * FROM access_rules ORDER BY id`)).rows,
    (await db.query(`SELECT * FROM access_overrides ORDER BY id`)).rows,
  ]);

describe('rattrapage de la table de suivi PERSON_NOTES', () => {
  it('base existante (v1 appliquée sans table): crée la table, ne touche aucune ligne, le TRUNCATE du seed passe, retour sans effet', async () => {
    const db = new PGlite();
    try {
      await setup(db); // état d'une preview où la v1 a tourné : lignes PERSON_NOTES copiées, pas de table de suivi
      expect(await exists(db)).toBe(false);
      await expect(db.query(`TRUNCATE TABLE "person_notes_split_log"`)).rejects.toThrow(/does not exist/); // l'échec réel du seed
      const before = await snapshot(db);
      const qr = { query: async (sql: string) => (await db.query(sql)).rows } as never;
      const m = new EnsurePersonNotesSplitLog1791300000000();
      await m.up(qr);
      expect(await exists(db)).toBe(true);
      expect(await snapshot(db)).toBe(before);
      await m.up(qr); // idempotente
      expect(await snapshot(db)).toBe(before);
      await db.query(`TRUNCATE TABLE "person_notes_split_log"`); // ce que fait le seed
      await m.down();
      expect(await exists(db)).toBe(true);
      expect(await snapshot(db)).toBe(before);
    } finally {
      await db.close();
    }
  });

  it('base neuve: 1791200000000 crée la table, le rattrapage ne change rien, le retour des deux migrations reste non destructif', async () => {
    const db = new PGlite();
    try {
      await setup(db);
      const qr = {
        query: async (sql: string) => (await db.query(sql)).rows,
        hasTable: async (t: string) =>
          ((await db.query(`SELECT to_regclass('public.${t}') IS NOT NULL AS e`)).rows[0] as { e: boolean }).e,
      } as never;
      const split = new SplitPersonNotesAccess1791200000000();
      const ensure = new EnsurePersonNotesSplitLog1791300000000();
      await split.up(qr);
      const afterSplit = await snapshot(db);
      const logBefore = JSON.stringify((await db.query(`SELECT * FROM person_notes_split_log ORDER BY 1,2`)).rows);
      await ensure.up(qr);
      expect(await snapshot(db)).toBe(afterSplit);
      expect(JSON.stringify((await db.query(`SELECT * FROM person_notes_split_log ORDER BY 1,2`)).rows)).toBe(logBefore);
      await ensure.down();
      await split.down(qr); // ordre inverse d'un revert TypeORM
      expect(await exists(db)).toBe(false);
      // les lignes PERSON_NOTES préexistantes sont conservées
      const kept = (await db.query(`SELECT subject_key FROM access_rules WHERE module='PERSON_NOTES' ORDER BY subject_key`)).rows;
      expect(kept).toEqual([{ subject_key: 'ADMIN' }, { subject_key: 'ANIMATOR' }]);
    } finally {
      await db.close();
    }
  });
});
