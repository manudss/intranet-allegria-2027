import { describe, expect, it } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { VolunteerTeamsService } from './volunteer-teams.service';

function build() {
  const teams = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const teamsRepo = {
    find: async (o: any) => {
      const ids = o?.where?.id?._value;
      return ids ? teams.filter((t) => ids.includes(t.id)) : teams;
    },
    findOne: async (o: any) => teams.find((t) => t.id === o.where.id) ?? null,
  };
  const volunteersRepo = { findOneBy: async (o: any) => ({ id: o.id }) };
  const membershipsRepo = { find: async () => [{ id: 1 }] };
  return new (VolunteerTeamsService as any)(teamsRepo, membershipsRepo, volunteersRepo, {}) as VolunteerTeamsService;
}

describe('équipes opérationnelles en lecture : portée « son équipe » / « soi »', () => {
  it('liste : seulement les équipes actives du compte, vide sans équipe, tout pour « tout »', async () => {
    const svc = build();
    expect((await svc.findAllTeams([2])).map((t) => t.id)).toEqual([2]);
    expect(await svc.findAllTeams([])).toEqual([]);
    expect(await svc.findAllTeams(null)).toHaveLength(3);
  });
  it('fiche : 404 hors de ses équipes', async () => {
    const svc = build();
    await expect(svc.findVisibleTeam(3, [2])).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.findVisibleTeam(2, [2])).resolves.toMatchObject({ id: 2 });
    await expect(svc.findVisibleTeam(3, null)).resolves.toMatchObject({ id: 3 });
  });
  it('rattachements : seulement les siens (jamais ceux d’un coéquipier)', async () => {
    const svc = build();
    await expect(svc.listVolunteerMemberships(9, [5])).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.listVolunteerMemberships(5, [5])).resolves.toHaveLength(1);
    await expect(svc.listVolunteerMemberships(9, null)).resolves.toHaveLength(1);
  });
});
