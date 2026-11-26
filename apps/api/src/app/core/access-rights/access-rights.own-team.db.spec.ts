import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { AccessRightsService } from './access-rights.service';

/** Données fictives : prouve les bornes de « Mon équipe » sur de vraies lignes (en cours, passée, future, équipe archivée, type archivé). */
describe('volunteerIdsForScopes OWN_TEAM sur données', () => {
  it('ne garde que équipes et types actifs, affectations en cours (fin incluse)', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE volunteers(id int PRIMARY KEY, user_id int);
        CREATE TABLE volunteer_team_types(id int PRIMARY KEY, code text, "isActive" bool);
        CREATE TABLE volunteer_teams(id int PRIMARY KEY, type_id int, "isActive" bool);
        CREATE TABLE volunteer_team_memberships(volunteer_id int, volunteer_team_id int, "startAt" date, "endAt" date);
        INSERT INTO volunteers VALUES (1,100),(2,NULL),(3,NULL),(4,NULL),(5,NULL),(6,NULL),(7,NULL),(8,NULL),(9,NULL);
        INSERT INTO volunteer_team_types VALUES (1,'A',true),(2,'B',false);
        INSERT INTO volunteer_teams VALUES (10,1,true),(11,1,false),(12,2,true);
        -- équipe 10 (active) : moi + coéquipiers
        INSERT INTO volunteer_team_memberships VALUES
          (1,10,NULL,NULL),
          (2,10,CURRENT_DATE - 5, CURRENT_DATE + 5),
          (3,10,CURRENT_DATE - 30, CURRENT_DATE - 1),
          (4,10,CURRENT_DATE + 1, CURRENT_DATE + 30),
          (5,10,CURRENT_DATE - 3, CURRENT_DATE),
          (6,10,CURRENT_DATE, NULL);
        -- équipe archivée 11 et équipe de type archivé 12 : moi dedans aussi
        INSERT INTO volunteer_team_memberships VALUES (1,11,NULL,NULL),(7,11,NULL,NULL),(1,12,NULL,NULL),(8,12,NULL,NULL);
        -- bénévole 9 : aucune équipe
      `);
      const svc = new (AccessRightsService as any)({
        query: async (q: string, params: unknown[] = []) => (await db.query(q, params as never[])).rows,
      }) as AccessRightsService;
      expect(await svc.volunteerIdsForScopes(100, ['SELF'])).toEqual([1]);
      expect(await svc.volunteerIdsForScopes(100, ['OWN_TEAM'])).toEqual([1, 2, 5, 6]);
      expect(await svc.volunteerIdsForScopes(999, ['OWN_TEAM'])).toEqual([]);
    } finally {
      await db.close();
    }
  });
});
