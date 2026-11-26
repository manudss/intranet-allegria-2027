import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { VolunteersService } from './volunteers.service';

describe('VolunteersService.search sur données', () => {
  it('cherche côté serveur, respecte les bénévoles visibles et ne renvoie jamais tout', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE volunteers(id int PRIMARY KEY, "firstName" text, "lastName" text, email text, team text);
        INSERT INTO volunteers VALUES (1,'Marie','Dupont','marie@exemple.test','Cuisine'),
          (2,'Martin','Leroy',NULL,NULL),(3,'Zoé','Marchand','zoe@exemple.test',NULL);
      `);
      const svc = new (VolunteersService as any)({
        query: async (q: string, p: unknown[] = []) => (await db.query(q, p as never[])).rows,
      }) as VolunteersService;
      expect(await svc.search({})).toEqual({ items: [], total: 0, hasMore: false });
      expect((await svc.search({ q: 'm' })).items).toEqual([]);
      expect((await svc.search({ q: 'mar' })).items.map((i) => i.id)).toEqual([1, 2, 3].sort());
      expect((await svc.search({ q: 'marie dupont' })).items.map((i) => i.id)).toEqual([1]);
      expect((await svc.search({ q: 'dupont marie' })).items.map((i) => i.id)).toEqual([1]);
      expect((await svc.search({ q: 'mar' }, [2])).items.map((i) => i.id)).toEqual([2]);
      expect((await svc.search({ q: 'mar' }, [])).items).toEqual([]);
      expect((await svc.search({ q: '%%' })).items).toEqual([]);
      const page = await svc.search({ q: 'mar', limit: 2 });
      expect(page).toMatchObject({ total: 3, hasMore: true });
      expect(page.items).toHaveLength(2);
      expect((await svc.search({ q: 'mar', limit: 2, offset: 2 })).hasMore).toBe(false);
    } finally {
      await db.close();
    }
  });
});
