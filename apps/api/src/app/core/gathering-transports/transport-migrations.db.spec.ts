import { PGlite } from '@electric-sql/pglite';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GatheringCars1791300000000 } from '../../../database/migrations/1791300000000-GatheringCars';
import { EnsurePersonNotesSplitLog1791300000000 } from '../../../database/migrations/1791300000000-EnsurePersonNotesSplitLog';
import { TransportNeedFlags1791400000000 } from '../../../database/migrations/1791400000000-TransportNeedFlags';

const prerequisites = `
  CREATE TABLE hosting_groups(id SERIAL PRIMARY KEY, name text);
  CREATE TABLE host_families(id SERIAL PRIMARY KEY, "familyName" text);
  CREATE TABLE participants(id SERIAL PRIMARY KEY);
  INSERT INTO hosting_groups(name) VALUES ('Zone Nord');
  INSERT INTO host_families("familyName") VALUES ('Famille Exemple');`;

const runner = (pg: PGlite) => ({ query: (sql: string) => pg.exec(sql) }) as never;
const up = async (pg: PGlite, ...migrations: { up(q: never): Promise<void> }[]) => {
  for (const m of migrations) await m.up(runner(pg));
};
const tables = async (pg: PGlite) =>
  (await pg.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)).rows.map((r) => r.table_name);
const columns = async (pg: PGlite, table: string) =>
  (await pg.query<{ column_name: string; is_nullable: string; column_default: string | null }>(
    `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1`, [table],
  )).rows;

describe('migrations transports : horodatage partagé 1791300000000 et drapeaux de besoin', () => {
  it('les classes ont des noms distincts : TypeORM les distingue par nom (le contrôle d\'horodatage est inactif)', () => {
    const names = readdirSync(path.join(__dirname, '../../../database/migrations'))
      .filter((f) => f.startsWith('1791300000000'))
      .map((f) => f.replace(/\.ts$/, ''));
    expect(names).toHaveLength(2);
    expect(new GatheringCars1791300000000().name ?? GatheringCars1791300000000.name).not.toBe(
      new EnsurePersonNotesSplitLog1791300000000().name,
    );
  });

  it('base vierge : les trois migrations passent, dans les deux ordres, sans toucher aux données', async () => {
    for (const order of [
      [new GatheringCars1791300000000(), new EnsurePersonNotesSplitLog1791300000000(), new TransportNeedFlags1791400000000()],
      [new EnsurePersonNotesSplitLog1791300000000(), new GatheringCars1791300000000(), new TransportNeedFlags1791400000000()],
    ]) {
      const pg = new PGlite();
      try {
        await pg.exec(prerequisites);
        await up(pg, ...order);
        const t = await tables(pg);
        expect(t).toEqual(expect.arrayContaining(['gathering_cars', 'gathering_car_assignments', 'gathering_car_persons', 'gathering_car_stops', 'person_notes_split_log']));
        const need = (await columns(pg, 'hosting_groups')).find((c) => c.column_name === 'needs_transport');
        expect(need).toMatchObject({ is_nullable: 'YES', column_default: null });
        expect((await pg.query(`SELECT needs_transport FROM hosting_groups`)).rows).toEqual([{ needs_transport: null }]);
        expect((await pg.query(`SELECT count(*)::int AS n FROM hosting_groups`)).rows[0]).toEqual({ n: 1 });
      } finally {
        await pg.close();
      }
    }
  });

  it('base de preview existante : GatheringCars déjà appliquée (données présentes), seules les migrations en attente passent', async () => {
    const pg = new PGlite();
    try {
      await pg.exec(prerequisites);
      await up(pg, new GatheringCars1791300000000());
      await pg.exec(`INSERT INTO gathering_cars(name) VALUES ('Car A');
        INSERT INTO gathering_car_assignments(car_id, "targetType", hosting_group_id) VALUES (1, 'HOSTING_GROUP', 1)`);
      const before = (await pg.query(`SELECT count(*)::int AS n FROM gathering_cars`)).rows[0];
      expect(before).toEqual({ n: 1 });
      // Une seconde exécution de GatheringCars échouerait (types/tables existants) : un renommage la rejouerait donc.
      await expect(up(pg, new GatheringCars1791300000000())).rejects.toThrow();
      // En attente par nom : seules Ensure... et TransportNeedFlags s'exécutent.
      await up(pg, new EnsurePersonNotesSplitLog1791300000000(), new TransportNeedFlags1791400000000());
      await up(pg, new EnsurePersonNotesSplitLog1791300000000(), new TransportNeedFlags1791400000000()); // idempotentes
      expect((await pg.query(`SELECT count(*)::int AS n FROM gathering_cars`)).rows[0]).toEqual(before);
      expect((await pg.query(`SELECT count(*)::int AS n FROM gathering_car_assignments`)).rows[0]).toEqual({ n: 1 });
      expect(await tables(pg)).toContain('person_notes_split_log');
      expect((await columns(pg, 'host_families')).some((c) => c.column_name === 'needs_transport')).toBe(true);
    } finally {
      await pg.close();
    }
  });
});
