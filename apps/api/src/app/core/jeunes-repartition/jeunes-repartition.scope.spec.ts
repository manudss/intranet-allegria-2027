import { describe, expect, it } from 'vitest';
import { JeunesRepartitionService } from './jeunes-repartition.service';

// Délégations dérivées des membres : équipe 1 avec un jeune du groupe 5, équipe 2 avec
// un jeune du groupe 6, équipe 3 mixte (5 et 6), équipe 4 vide. Le champ historique
// group sur l'équipe ne pilote plus l'accès.
const part = (id: number, groupId: number) => ({ id, group: { id: groupId } });
const team = (id: number, memberGroupIds: number[]) => ({
  id,
  name: 'T' + id,
  maxSize: 10,
  members: memberGroupIds.map((g, i) => ({ participant: { id: id * 100 + i, group: { id: g } } })),
});

function build(showGlobal = false) {
  const teams = [team(1, [5]), team(2, [6]), team(3, [5, 6]), team(4, [])];
  const parts = [part(1, 5), part(2, 6)];
  const pick = (rows: any[]) => ({
    find: async (o?: any) => {
      const ids = o?.where?.id?._value;
      return ids ? rows.filter((r) => ids.includes(r.id)) : rows;
    },
  });
  return new (JeunesRepartitionService as any)(
    pick(parts),
    pick(teams),
    pick([]),
    { find: async () => [{ id: 5, name: 'G5' }, { id: 6, name: 'G6' }] },
    { getOption: async () => showGlobal },
  ) as JeunesRepartitionService;
}

const scope5 = { all: false, groupIds: [5] };

describe('répartition jeunes : périmètre dérivé du rattachement des personnes', () => {
  it('équipes : visibles si un membre est dans la portée, équipe mixte incluse, vide exclue', async () => {
    const rows = await build().searchTeams({} as any, scope5);
    expect(rows.map((r) => r.id)).toEqual([1, 3]);
  });

  it('équipes : délégations dérivées exposées (mixte = deux délégations)', async () => {
    const rows = await build().searchTeams({} as any, { all: true, groupIds: [] });
    const mixed = rows.find((r) => r.id === 3)!;
    expect(mixed.delegationIds).toEqual([5, 6]);
    expect(mixed.delegationNames).toEqual(['G5', 'G6']);
    expect(mixed.groupName).toBe('G5, G6');
  });

  it('équipes : globales seulement avec l’option admin', async () => {
    const rows = await build(true).searchTeams({} as any, scope5);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  it('équipes : portée groupes vide, aucune', async () => {
    expect(await build().searchTeams({} as any, { all: false, groupIds: [] })).toEqual([]);
  });

  it('apply refuse un jeune ou une équipe hors portée', async () => {
    const svc = build();
    await expect(svc.apply({ assignments: [{ participantId: 2, teamId: 1 }] } as any, scope5)).rejects.toThrow();
    await expect(svc.apply({ assignments: [{ participantId: 1, teamId: 2 }] } as any, scope5)).rejects.toThrow();
  });

  it('propose refuse hors portée et sans portée', async () => {
    const svc = build();
    await expect(svc.propose({ participantIds: [2], teamIds: [1] } as any, scope5)).rejects.toThrow();
    await expect(
      svc.propose({ participantIds: [1], teamIds: [1] } as any, { all: false, groupIds: [] }),
    ).rejects.toThrow();
  });

  it('négatif : viser une équipe entièrement d’une autre délégation est refusé même avec un jeune à soi', async () => {
    const svc = build();
    await expect(svc.propose({ participantIds: [1], teamIds: [2] } as any, scope5)).rejects.toThrow();
  });
});
