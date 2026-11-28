import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { CreatePlaces1791500000000 } from '../../../database/migrations/1791500000000-CreatePlaces';

/** Vraie base PostgreSQL (PGlite), données fictives : migration additive, salle forcée dans son lieu, droits copiés sans élargissement, retour arrière propre. */
describe('migration CreatePlaces sur base réelle', () => {
  it('conserve les données, impose salle dans son lieu, copie les droits AGENDA sans élargir, et son retour ne retire que ses lignes', async () => {
    const db = new PGlite();
    try {
      const qr = { query: async (sql: string) => (await db.query(sql)).rows } as never;
      await db.exec(`
        CREATE TYPE program_sequence_track_enum AS ENUM('TA','ES','COMMON');
        CREATE TABLE volunteers(id serial PRIMARY KEY);
        CREATE TABLE volunteer_teams(id serial PRIMARY KEY);
        CREATE TABLE program_sequences(id serial PRIMARY KEY, location varchar(150) NOT NULL);
        CREATE TABLE volunteer_missions(id serial PRIMARY KEY, location varchar(200));
        CREATE TABLE volunteer_shifts(id serial PRIMARY KEY, location varchar(200));
        CREATE TABLE gathering_groups(id serial PRIMARY KEY, location varchar(200));
        CREATE TABLE access_rules(id serial PRIMARY KEY, subject_kind varchar(20) NOT NULL, subject_key varchar(80) NOT NULL, module varchar(60) NOT NULL, level varchar(10) NOT NULL, scope varchar(20) NOT NULL DEFAULT 'ALL', CONSTRAINT uq UNIQUE(subject_kind, subject_key, module));
        INSERT INTO program_sequences(location) VALUES ('Salle libre A'),('Salle libre A');
        INSERT INTO volunteer_missions(location) VALUES ('Texte M');
        INSERT INTO access_rules(subject_kind, subject_key, module, level, scope) VALUES
          ('ROLE','ADMIN','AGENDA','MANAGE','ALL'),
          ('ROLE','ANIMATOR','AGENDA','VIEW','GROUPS'),
          ('ROLE','HEALTH','PLACES','EDIT','ALL'),
          ('ROLE','HEALTH','AGENDA','VIEW','ALL'),
          ('ROLE','CATERING','TRANSPORT','VIEW','ALL');
      `);
      const m = new CreatePlaces1791500000000();
      await m.up(qr);

      // Données existantes intactes, nouveaux liens nuls : aucun rapprochement automatique.
      expect((await db.query(`SELECT location, place_id, room_id FROM program_sequences ORDER BY id`)).rows).toEqual([
        { location: 'Salle libre A', place_id: null, room_id: null },
        { location: 'Salle libre A', place_id: null, room_id: null },
      ]);

      // Droits : copie exacte (niveau et portée), règle PLACES préexistante gardée, rien pour les autres modules.
      expect((await db.query(`SELECT subject_key, level, scope FROM access_rules WHERE module='PLACES' ORDER BY subject_key`)).rows).toEqual([
        { subject_key: 'ADMIN', level: 'MANAGE', scope: 'ALL' },
        { subject_key: 'ANIMATOR', level: 'VIEW', scope: 'GROUPS' },
        { subject_key: 'HEALTH', level: 'EDIT', scope: 'ALL' },
      ]);

      await db.exec(`
        INSERT INTO places(name) VALUES ('Lycée Fictif'),('Parc Fictif');
        INSERT INTO place_rooms(place_id,name) VALUES (1,'Salle 1'),(2,'Salle P');
      `);
      // Nom de lieu unique sans tenir compte de la casse, salle unique par lieu.
      await expect(db.exec(`INSERT INTO places(name) VALUES ('lycée fictif')`)).rejects.toThrow();
      await expect(db.exec(`INSERT INTO place_rooms(place_id,name) VALUES (1,'SALLE 1')`)).rejects.toThrow();
      // La salle doit appartenir au lieu (salle 2 est au lieu 2).
      await expect(db.exec(`UPDATE program_sequences SET place_id=1, room_id=2 WHERE id=1`)).rejects.toThrow();
      await db.exec(`UPDATE program_sequences SET place_id=1, room_id=1 WHERE id=1`);
      await db.exec(`UPDATE volunteer_missions SET place_id=2 WHERE id=1`); // lieu seul : autorisé
      // GPS hors bornes refusé.
      await expect(db.exec(`UPDATE places SET latitude=95, longitude=4 WHERE id=1`)).rejects.toThrow();

      // Retour arrière : rien d'autre que les lignes créées par up n'est supprimé (la règle PLACES préexistante reste).
      await db.exec(`UPDATE program_sequences SET place_id=NULL, room_id=NULL; UPDATE volunteer_missions SET place_id=NULL`);
      await m.down(qr);
      expect((await db.query(`SELECT subject_key FROM access_rules WHERE module='PLACES'`)).rows).toEqual([{ subject_key: 'HEALTH' }]);
      expect((await db.query(`SELECT count(*)::int AS n FROM program_sequences`)).rows).toEqual([{ n: 2 }]);
      expect((await db.query(`SELECT to_regclass('public.places') IS NULL AS gone`)).rows).toEqual([{ gone: true }]);
    } finally {
      await db.close();
    }
  });
});
