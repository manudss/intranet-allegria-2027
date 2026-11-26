import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { UsersService } from './users.service';

/** Données fictives : recherche de personne par texte, rôle, type d'équipe, équipe, groupe. */
describe('UsersService.search sur données', () => {
  it('filtre côté serveur, limite les résultats et ne renvoie jamais la liste complète', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE users(id int PRIMARY KEY, email text, "isActive" bool);
        CREATE TABLE roles(id int PRIMARY KEY, code text);
        CREATE TABLE user_roles(user_id int, role_id int);
        CREATE TABLE volunteers(id int PRIMARY KEY, user_id int, "firstName" text, "lastName" text);
        CREATE TABLE volunteer_team_types(id int PRIMARY KEY, code text, label text, "isActive" bool);
        CREATE TABLE volunteer_teams(id int PRIMARY KEY, name text, type_id int, "isActive" bool);
        CREATE TABLE volunteer_team_memberships(volunteer_id int, volunteer_team_id int, "startAt" date, "endAt" date);
        CREATE TABLE user_group_scopes(user_id int, group_id int);
        INSERT INTO users VALUES (1,'marie.dupont@exemple.test',true),(2,'martin.leroy@exemple.test',true),
          (3,'sans.fiche@exemple.test',true),(4,'p_c%@exemple.test',true);
        INSERT INTO roles VALUES (1,'ADMIN'),(2,'BADGE_MANAGER');
        INSERT INTO user_roles VALUES (1,1),(2,2),(2,1);
        INSERT INTO volunteers VALUES (10,1,'Marie','Dupont'),(11,2,'Martin','Leroy');
        INSERT INTO volunteer_team_types VALUES (1,'ANIM','Animation',true),(2,'SEC','Sécurité',false);
        INSERT INTO volunteer_teams VALUES (100,'Saint-Étienne 2',1,true),(101,'Accès nord',2,true);
        INSERT INTO volunteer_team_memberships VALUES (10,100,NULL,NULL),(11,101,NULL,NULL),
          (11,100,CURRENT_DATE + 3,NULL);
        INSERT INTO user_group_scopes VALUES (1,7);
      `);
      const svc = new (UsersService as any)({
        query: async (q: string, p: unknown[] = []) => (await db.query(q, p as never[])).rows,
      }) as UsersService;

      expect(await svc.search({})).toEqual({ items: [], total: 0, hasMore: false });
      expect((await svc.search({ q: 'm' })).items).toEqual([]);

      const byName = await svc.search({ q: 'mar' });
      expect(byName.items.map((i) => i.id)).toEqual([1, 2]);
      expect(byName.items[0]).toMatchObject({
        firstName: 'Marie',
        lastName: 'Dupont',
        teams: ['Saint-Étienne 2'],
        teamTypes: ['Animation'],
        roles: ['ADMIN'],
      });
      expect((await svc.search({ q: 'leroy marti' })).items.map((i) => i.id)).toEqual([2]);
      expect((await svc.search({ q: 'dupont marie' })).items.map((i) => i.id)).toEqual([1]);
      expect((await svc.search({ q: 'sans.fiche' })).items[0]).toMatchObject({
        id: 3,
        firstName: null,
        teams: [],
      });
      // % et _ sont littéraux
      expect((await svc.search({ q: '%' })).items).toEqual([]);
      expect((await svc.search({ q: 'p_c%' })).items.map((i) => i.id)).toEqual([4]);

      expect((await svc.search({ role: 'BADGE_MANAGER' })).items.map((i) => i.id)).toEqual([2]);
      expect((await svc.search({ teamType: 'ANIM' })).items.map((i) => i.id)).toEqual([1]);
      // type archivé et affectation future : exclus
      expect((await svc.search({ teamType: 'SEC' })).items).toEqual([]);
      expect((await svc.search({ teamId: 100 })).items.map((i) => i.id)).toEqual([1]);
      expect((await svc.search({ groupId: 7 })).items.map((i) => i.id)).toEqual([1]);
      expect(
        (await svc.search({ q: 'mar', role: 'ADMIN', teamId: 100 })).items.map((i) => i.id),
      ).toEqual([1]);

      const page = await svc.search({ q: 'exemple', limit: 2 });
      expect(page).toMatchObject({ total: 4, hasMore: true });
      expect(page.items).toHaveLength(2);
      expect((await svc.search({ q: 'exemple', limit: 2, offset: 2 })).hasMore).toBe(false);
      expect((await svc.search({ q: 'exemple', limit: 500 })).items.length).toBeLessThanOrEqual(20);
    } finally {
      await db.close();
    }
  });
});
