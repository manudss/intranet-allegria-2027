import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TeamsService } from './teams.service';

// Données fictives : équipe 1 = membre délégation 5 ; équipe 2 = membre délégation 6 ;
// équipe 3 = mixte (5 et 6) ; équipe 4 = vide. Le champ historique group (ici groupe 6
// sur l'équipe 1) ne doit plus avoir aucun effet sur l'accès.
const member = (id: number, groupId: number | null) => ({
  participant: { id, firstName: 'P' + id, lastName: 'N' + id, group: groupId === null ? null : { id: groupId } },
});
const teamsFixture = [
  { id: 1, name: 'T1', maxSize: 10, group: { id: 6, name: 'G6' }, members: [member(1, 5)] },
  { id: 2, name: 'T2', maxSize: 10, group: null, members: [member(2, 6)] },
  { id: 3, name: 'T3', maxSize: 10, group: null, members: [member(3, 5), member(4, 6)] },
  { id: 4, name: 'T4', maxSize: 10, group: null, members: [] },
];

const scope5 = { all: false, groupIds: [5] };
const scopeAll = { all: true, groupIds: [] as number[] };

function build() {
  const participantsFind = vi.fn(async (opts: any) => {
    // Simule la base : les entrées where portent id (+ filtre groupe pour comptes limités).
    const all = teamsFixture.flatMap((t) => t.members.map((m) => m.participant));
    return (opts.where as any[])
      .map((w) => ({ w, p: all.find((p) => p.id === w.id) }))
      .filter(({ w, p }) => p && (!w.group || w.group.id._value.includes(p.group?.id ?? -1)))
      .map(({ p }) => p);
  });
  const teamsRepository = {
    find: vi.fn(async () => teamsFixture),
    findOne: async ({ where: { id } }: any) => teamsFixture.find((t) => t.id === id) ?? null,
    create: (payload: any) => payload,
    save: async (payload: any) => ({ id: 900, ...payload }),
  };
  const teamParticipantsRepository = {
    find: async ({ where: { team } }: any) =>
      teamsFixture.find((t) => t.id === team.id)?.members.map((m) => ({ team, ...m })) ?? [],
  };
  const service = new TeamsService(
    teamsRepository as never,
    { findOneBy: async () => null } as never,
    { findOneBy: async () => null } as never,
    { find: participantsFind } as never,
    teamParticipantsRepository as never,
  );
  return { service, participantsFind };
}

describe('teams : périmètre dérivé du rattachement des personnes', () => {
  it('liste : visibles si un membre est dans la portée, même avec un ancien groupe ailleurs', async () => {
    const { service } = build();
    const rows = await service.findAll(scope5);
    expect(rows.map((t) => t.id)).toEqual([1, 3]);
  });

  it('liste : portée « tout » voit aussi les équipes vides', async () => {
    const { service } = build();
    expect((await service.findAll(scopeAll)).map((t) => t.id)).toEqual([1, 2, 3, 4]);
  });

  it('négatif : fiche d’une équipe entièrement dans une autre délégation → introuvable', async () => {
    const { service } = build();
    await expect(service.findOne(2, scope5)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('négatif : équipe vide → introuvable pour un compte limité', async () => {
    const { service } = build();
    await expect(service.findOne(4, scope5)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('création sans délégation : autorisée (le lien n’est plus exigé), équipe ensuite remplie', async () => {
    const { service } = build();
    const created = await service.create({ name: 'Nouvelle', maxSize: 8 } as never, scope5);
    expect(created).toMatchObject({ id: 900, name: 'Nouvelle' });
  });

  it('membres d’une équipe mixte : seuls ceux de la portée sont renvoyés', async () => {
    const { service } = build();
    const members = await service.getParticipants(3, scope5);
    expect(members.map((p: any) => p.id)).toEqual([3]);
  });

  it('santé : la liste des membres ne charge jamais la relation santé', async () => {
    const { service, participantsFind } = build();
    await service.getParticipants(3, scopeAll);
    const calls = participantsFind.mock.calls.map(([opts]: any[]) => opts);
    for (const opts of calls) {
      expect(JSON.stringify(opts.relations ?? {})).not.toContain('health');
    }
    const members = await service.getParticipants(3, scopeAll);
    for (const p of members as any[]) {
      expect(p.health).toBeUndefined();
    }
  });
});
