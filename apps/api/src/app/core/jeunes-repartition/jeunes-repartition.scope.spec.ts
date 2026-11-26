import { describe, expect, it } from 'vitest';
import { JeunesRepartitionService } from './jeunes-repartition.service';

const team = (id: number, groupId: number) => ({ id, name: 'T' + id, maxSize: 10, group: { id: groupId, name: 'G' + groupId }, members: [] });
const part = (id: number, groupId: number) => ({ id, group: { id: groupId } });

function build(showGlobal = false) {
  const teams = [team(1, 5), team(2, 6)];
  const parts = [part(1, 5), part(2, 6)];
  const pick = (rows: any[]) => ({
    find: async (o?: any) => {
      const ids = o?.where?.id?._value;
      return ids ? rows.filter((r) => ids.includes(r.id)) : rows;
    },
  });
  return new (JeunesRepartitionService as any)(
    pick(parts), pick(teams), pick([]), pick([]), { getOption: async () => showGlobal },
  ) as JeunesRepartitionService;
}

describe('répartition jeunes par portée de groupe', () => {
  it('équipes : seules celles du périmètre par défaut', async () => {
    const rows = await build().searchTeams({} as any, { all: false, groupIds: [5] });
    expect(rows.map((r) => r.id)).toEqual([1]);
  });
  it('équipes : globales seulement avec l’option admin', async () => {
    const rows = await build(true).searchTeams({} as any, { all: false, groupIds: [5] });
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
  });
  it('équipes : portée groupes vide, aucune', async () => {
    expect(await build().searchTeams({} as any, { all: false, groupIds: [] })).toEqual([]);
  });
  it('apply refuse un jeune ou une équipe hors portée', async () => {
    const svc = build();
    await expect(svc.apply({ assignments: [{ participantId: 2, teamId: 1 }] } as any, { all: false, groupIds: [5] })).rejects.toThrow();
    await expect(svc.apply({ assignments: [{ participantId: 1, teamId: 2 }] } as any, { all: false, groupIds: [5] })).rejects.toThrow();
  });
  it('propose refuse hors portée et sans portée', async () => {
    const svc = build();
    await expect(svc.propose({ participantIds: [2], teamIds: [1] } as any, { all: false, groupIds: [5] })).rejects.toThrow();
    await expect(
      svc.propose({ participantIds: [1], teamIds: [1] } as any, { all: false, groupIds: [] }),
    ).rejects.toThrow();
  });
});
