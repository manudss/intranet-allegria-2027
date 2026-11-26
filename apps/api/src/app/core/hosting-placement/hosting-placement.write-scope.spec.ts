import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { HostingPlacementService } from './hosting-placement.service';
import { JeunesRepartitionService } from '../jeunes-repartition/jeunes-repartition.service';
import { AccessRightsService } from '../access-rights/access-rights.service';

// Données fictives : jeunes 1 (groupe 5) et 2 (groupe 6) ; équipes 1 (groupe 5) et 2 (groupe 6), même groupe d'hébergement 10.
const people: Record<number, any> = {
  1: { id: 1, type: 'JEUNE', sex: 'M', dateOfBirth: null, group: { id: 5 } },
  2: { id: 2, type: 'JEUNE', sex: 'F', dateOfBirth: null, group: { id: 6 } },
};
const teams = [
  { id: 1, group: { id: 5 }, hostingGroup: { id: 10 } },
  { id: 2, group: { id: 6 }, hostingGroup: { id: 10 } },
];
const family = { id: 7, familyName: 'F', status: 'VALIDATED', hostingGroup: { id: 10 }, constraints: [], tags: [] };

function chain(result: unknown) {
  const q: any = new Proxy(() => q, {
    get: (_t, k) => (k === 'getOne' ? async () => result : k === 'getMany' || k === 'getRawMany' ? async () => [] : () => q),
  });
  return q;
}

function build() {
  const repoFor = (entity: { name: string }) => {
    switch (entity.name) {
      case 'Participant':
        return { findOne: async (o: any) => people[o.where.id] };
      case 'HostFamily':
        return { createQueryBuilder: () => chain(family), findOne: async () => family, find: async () => [] };
      case 'TeamParticipant':
        return {
          find: async (o: any) => {
            const w = o.where;
            if (w.participant) return [{ team: teams.find((t) => t.group.id === people[w.participant.id].group.id) }];
            return Object.values(people).map((p: any) => ({
              participant: p,
              team: teams.find((t) => t.group.id === p.group.id),
            }));
          },
        };
      case 'Team':
        return { find: async () => teams };
      default:
        return { find: async () => [], createQueryBuilder: () => chain(null) };
    }
  };
  const manager = { transaction: async (cb: any) => cb(manager), getRepository: repoFor };
  const accessRights = new (AccessRightsService as any)({
    query: async (_q: string, p: any[]) => {
      if (_q.includes('FROM participants WHERE id = $1')) return people[p[0]] ? [{ group_id: people[p[0]].group.id }] : [];
      return [];
    },
  });
  const teamsRepo = { manager };
  return new (HostingPlacementService as any)({ findOneBy: async () => ({ id: 10 }) }, teamsRepo, {}, {}, { find: async () => [] }, accessRights) as HostingPlacementService;
}

const scope5 = { all: false, groupIds: [5] };

describe('placement : écritures en portée groupes', () => {
  it('place refuse un jeune hors portée', async () => {
    await expect(build().place({ participantId: 2, hostFamilyId: 7 } as any, scope5)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('place : sans groupe dans la portée, refus même pour un jeune du groupe 5', async () => {
    await expect(build().place({ participantId: 1, hostFamilyId: 7 } as any, { all: false, groupIds: [] })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('place : jeune et équipe dans la portée passent le contrôle de portée', async () => {
    const r = build().place({ participantId: 1, hostFamilyId: 7 } as any, scope5);
    await expect(r).rejects.not.toThrow(/portée/);
  });
  it('unplace : jeune hors portée = introuvable', async () => {
    await expect(build().unplace(2, scope5)).rejects.toThrow(/introuvable/);
  });
  it('auto-place refuse si une équipe du groupe d’hébergement est hors portée', async () => {
    await expect(
      build().autoPlace(10, { arrivalDate: '2027-07-01', departureDate: '2027-07-10' } as any, scope5),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('auto-place : restreint aux équipes de la portée, le jeune hors portée n’est jamais traité', async () => {
    const r = build().autoPlace(10, { arrivalDate: '2027-07-01', departureDate: '2027-07-10', teamIds: [1] } as any, scope5);
    await expect(r).resolves.toMatchObject({ applied: false });
  });
  it('portée « tout » : aucun contrôle', async () => {
    await expect(build().unplace(2, { all: true })).rejects.not.toThrow(/introuvable/);
  });
});

describe('répartition jeunes : création en masse en portée groupes', () => {
  const saved: any[] = [];
  const svc = () =>
    new (JeunesRepartitionService as any)(
      { find: async () => [] },
      { find: async () => [], create: (x: any) => x, save: async (x: any) => ({ id: saved.push(x), ...x }) },
      { find: async () => [] },
      { find: async () => [], findOne: async ({ where }: any) => (where.id === 5 ? { id: 5 } : null) },
      { getOption: async () => false },
    ) as JeunesRepartitionService;
  it('refuse sans groupe ou avec un groupe hors portée', async () => {
    await expect(svc().bulkCreateTeams({ count: 2 } as any, scope5)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc().bulkCreateTeams({ count: 2, groupId: 6 } as any, scope5)).rejects.toBeInstanceOf(ForbiddenException);
    expect(saved).toHaveLength(0);
  });
  it('crée les équipes dans le groupe de la portée', async () => {
    const r = await svc().bulkCreateTeams({ count: 2, groupId: 5 } as any, scope5);
    expect(r.created).toHaveLength(2);
    expect(saved.every((t) => t.group?.id === 5)).toBe(true);
  });
  it('portée « tout » : comportement inchangé (sans groupe)', async () => {
    saved.length = 0;
    await svc().bulkCreateTeams({ count: 1 } as any, { all: true });
    expect(saved[0].group).toBeUndefined();
  });
});
