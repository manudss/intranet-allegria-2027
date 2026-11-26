import { describe, expect, it } from 'vitest';
import { AccessRightsService } from './access-rights.service';

function build(userRows: { id: number }[]) {
  const sql: string[] = [];
  const ds = {
    query: async (q: string) => {
      sql.push(q);
      if (q.includes('FROM volunteers WHERE user_id')) return userRows;
      if (q.includes('volunteer_team_memberships')) return [{ volunteer_id: 5 }, { volunteer_id: 9 }];
      return [];
    },
  };
  return { svc: new (AccessRightsService as any)(ds) as AccessRightsService, sql };
}

describe('volunteerIdsForScopes', () => {
  it('SELF : seulement sa fiche, sans requête équipe', async () => {
    const { svc, sql } = build([{ id: 5 }]);
    expect(await svc.volunteerIdsForScopes(1, ['SELF'])).toEqual([5]);
    expect(sql.some((q) => q.includes('volunteer_team_memberships'))).toBe(false);
  });
  it('OWN_TEAM : mêmes bornes que les droits par type d’équipe (équipe active, dates du jour, fiche et coéquipiers)', async () => {
    const { svc, sql } = build([{ id: 5 }]);
    expect(await svc.volunteerIdsForScopes(1, ['OWN_TEAM'])).toEqual([5, 9]);
    const q = sql.find((x) => x.includes('volunteer_team_memberships'))!;
    expect(q).toContain('vt."isActive" = true');
    for (const a of ['m1', 'm2']) {
      expect(q).toContain(`${a}."startAt" <= CURRENT_DATE`);
      expect(q).toContain(`${a}."endAt" >= CURRENT_DATE`);
    }
  });
  it('sans lien compte-bénévole : aucun bénévole visible, aucune requête équipe', async () => {
    const { svc, sql } = build([]);
    expect(await svc.volunteerIdsForScopes(1, ['SELF', 'OWN_TEAM'])).toEqual([]);
    expect(sql.some((q) => q.includes('volunteer_team_memberships'))).toBe(false);
  });
});
