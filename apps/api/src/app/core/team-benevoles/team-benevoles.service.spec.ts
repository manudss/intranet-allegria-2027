import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AssignmentStatus,
  Participant,
  PersonType,
  Team,
  TeamParticipant,
  VolunteerTeamLodging,
} from '../entities';
import { TeamBenevolesService } from './team-benevoles.service';

const team = { id: 45, name: 'Équipe des Lynx', maxSize: 10 };
const volunteer = { id: 12, firstName: 'Camille', lastName: 'Perrot', team: 'Régie scène' };

const build = (overrides: { participantsFindOne?: unknown; lodgingsFindOne?: unknown; membersCount?: number } = {}) => {
  const repos = {
    teams: {
      findOneBy: vi.fn().mockResolvedValue(team),
      findOne: vi.fn().mockResolvedValue(team),
      find: vi.fn().mockResolvedValue([]),
    },
    volunteers: { findOneBy: vi.fn().mockResolvedValue(volunteer), find: vi.fn().mockResolvedValue([]) },
    participants: {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(overrides.participantsFindOne ?? null),
      create: vi.fn((payload) => ({ id: 501, ...payload })),
      save: vi.fn(async (payload) => payload),
      remove: vi.fn(async () => undefined),
    },
    memberships: {
      count: vi.fn().mockResolvedValue(overrides.membersCount ?? 4),
      create: vi.fn((payload) => payload),
      save: vi.fn(async (payload) => payload),
      remove: vi.fn(async () => undefined),
    },
    lodgings: {
      findOne: vi.fn().mockResolvedValue(overrides.lodgingsFindOne ?? null),
      create: vi.fn((payload) => payload),
      save: vi.fn(async (payload) => payload),
      remove: vi.fn(async () => undefined),
    },
    groups: { find: vi.fn().mockResolvedValue([]) },
    hostingGroups: { find: vi.fn().mockResolvedValue([]) },
    poles: { find: vi.fn().mockResolvedValue([]) },
    poleMemberships: {},
    tags: {
      createQueryBuilder: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
      })),
    },
  };
  const manager = {
    getRepository: (token: unknown) => {
      if (token === Team) return repos.teams;
      if (token === Participant) return repos.participants;
      if (token === TeamParticipant) return repos.memberships;
      if (token === VolunteerTeamLodging) return repos.lodgings;
      throw new Error('repo inconnu');
    },
  };
  const teamsRepository = {
    ...repos.teams,
    manager: { transaction: async (cb: (m: typeof manager) => unknown) => cb(manager) },
  };
  const service = new TeamBenevolesService(
    teamsRepository as never,
    repos.volunteers as never,
    repos.participants as never,
    repos.memberships as never,
    repos.lodgings as never,
    repos.groups as never,
    repos.hostingGroups as never,
    repos.poles as never,
    repos.poleMemberships as never,
    repos.tags as never,
  );
  return { service, repos };
};

describe('TeamBenevolesService.assign', () => {
  it('crée la fiche BENEVOLE adulte, l’adhésion à l’équipe et le logement synchronisé', async () => {
    const { service, repos } = build();
    const result = await service.assign(45, { volunteerId: 12 });

    expect(repos.participants.create).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Camille',
        lastName: 'Perrot',
        type: PersonType.BENEVOLE,
        dateOfBirth: null,
        sex: null,
        volunteer,
      }),
    );
    expect(repos.memberships.save).toHaveBeenCalledWith(
      expect.objectContaining({ team, participant: expect.objectContaining({ id: 501 }) }),
    );
    expect(repos.lodgings.save).toHaveBeenCalledWith(
      expect.objectContaining({ volunteerId: 12, teamId: 45 }),
    );
    expect(result).toMatchObject({
      volunteerId: 12,
      participantId: 501,
      teamId: 45,
      teamName: 'Équipe des Lynx',
      mission: 'Régie scène',
    });
  });

  it('met à jour le logement existant s’il pointe vers une autre équipe', async () => {
    const lodging = { id: 9, volunteerId: 12, teamId: 99 };
    const { service, repos } = build({ lodgingsFindOne: lodging });
    await service.assign(45, { volunteerId: 12 });
    expect(lodging.teamId).toBe(45);
    expect(repos.lodgings.save).toHaveBeenCalledWith(lodging);
  });

  it('refuse si le bénévole est déjà dans cette équipe', async () => {
    const fiche = { id: 501, teamMemberships: [{ team }] };
    const { service } = build({ participantsFindOne: fiche });
    await expect(service.assign(45, { volunteerId: 12 })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuse si le bénévole est déjà affecté à une autre équipe', async () => {
    const fiche = { id: 501, teamMemberships: [{ team: { id: 46, name: 'Renards 2' } }] };
    const { service } = build({ participantsFindOne: fiche });
    await expect(service.assign(45, { volunteerId: 12 })).rejects.toThrow(/Renards 2/);
  });

  it('refuse une équipe complète', async () => {
    const { service } = build({ membersCount: 10 });
    await expect(service.assign(45, { volunteerId: 12 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signale un bénévole inconnu', async () => {
    const { service, repos } = build();
    repos.volunteers.findOneBy.mockResolvedValue(null);
    await expect(service.assign(45, { volunteerId: 12 })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TeamBenevolesService.unassign', () => {
  const ficheWith = (assignments: { status: AssignmentStatus }[]) => ({
    id: 501,
    teamMemberships: [{ team }],
    hostFamilyAssignments: assignments,
  });

  it('retire l’adhésion, la fiche projection et le logement de l’équipe', async () => {
    const lodging = { id: 9, volunteerId: 12, teamId: 45 };
    const { service, repos } = build({
      participantsFindOne: ficheWith([]),
      lodgingsFindOne: lodging,
    });
    await service.unassign(45, 12);
    expect(repos.memberships.remove).toHaveBeenCalled();
    expect(repos.participants.remove).toHaveBeenCalled();
    expect(repos.lodgings.remove).toHaveBeenCalledWith(lodging);
  });

  it('conserve un logement qui pointerait vers une autre équipe', async () => {
    const { service, repos } = build({
      participantsFindOne: ficheWith([]),
      lodgingsFindOne: { id: 9, volunteerId: 12, teamId: 99 },
    });
    await service.unassign(45, 12);
    expect(repos.lodgings.remove).not.toHaveBeenCalled();
  });

  it('refuse tant que le bénévole est placé dans une famille', async () => {
    const { service, repos } = build({
      participantsFindOne: ficheWith([{ status: AssignmentStatus.CONFIRMED }]),
    });
    await expect(service.unassign(45, 12)).rejects.toBeInstanceOf(ConflictException);
    expect(repos.participants.remove).not.toHaveBeenCalled();
  });

  it('accepte quand seules des affectations annulées existent', async () => {
    const { service } = build({
      participantsFindOne: ficheWith([{ status: AssignmentStatus.CANCELLED }]),
    });
    await expect(service.unassign(45, 12)).resolves.toBeUndefined();
  });

  it('signale une affectation introuvable', async () => {
    const { service } = build();
    await expect(service.unassign(45, 12)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TeamBenevolesService.repartitionFilters', () => {
  it('agrège zones de logement, groupes, pôles, étiquettes et compétences', async () => {
    const { service, repos } = build();
    repos.hostingGroups.find.mockResolvedValue([{ id: 3, name: 'Centre' }]);
    repos.groups.find.mockResolvedValue([{ id: 8, name: 'Lyon Centre' }]);
    repos.poles.find.mockResolvedValue([{ id: 5, name: 'Régie scène' }]);
    await expect(service.repartitionFilters()).resolves.toEqual({
      hostingGroups: [{ id: 3, name: 'Centre' }],
      groups: [{ id: 8, name: 'Lyon Centre' }],
      poles: [{ id: 5, name: 'Régie scène' }],
      tags: [],
      skills: expect.arrayContaining(['ANIMATION', 'SECURITY']),
    });
  });
});

describe('TeamBenevolesService.searchRepartitionTeams', () => {
  const teamsFixture = [
    {
      id: 1,
      name: 'Équipe des Lynx',
      maxSize: 10,
      group: { id: 8, name: 'Lyon Centre' },
      hostingGroup: { id: 3, name: 'Centre' },
      members: [
        { participant: { type: PersonType.JEUNE } },
        { participant: { type: PersonType.JEUNE } },
        { participant: { type: PersonType.ANIMATEUR } },
        { participant: { type: PersonType.BENEVOLE } },
      ],
    },
    {
      id: 2,
      name: 'Renards 2',
      maxSize: 2,
      group: { id: 8, name: 'Lyon Centre' },
      hostingGroup: { id: 4, name: 'Est' },
      members: [
        { participant: { type: PersonType.JEUNE } },
        { participant: { type: PersonType.ANIMATEUR } },
      ],
    },
  ];

  it('compte jeunes, adultes (dont bénévoles) et places libres', async () => {
    const { service, repos } = build();
    repos.teams.find.mockResolvedValue(teamsFixture);
    const rows = await service.searchRepartitionTeams({});
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 1, jeunes: 2, adultes: 2, maxSize: 10, free: 6, hostingGroupId: 3, groupId: 8 });
    expect(rows[1]).toMatchObject({ id: 2, jeunes: 1, adultes: 1, free: 0 });
  });

  it('filtre par recherche, zone de logement, groupe et remplissage', async () => {
    const { service, repos } = build();
    repos.teams.find.mockResolvedValue(teamsFixture);
    expect((await service.searchRepartitionTeams({ search: 'renard' })).map((r) => r.id)).toEqual([2]);
    expect((await service.searchRepartitionTeams({ hostingGroupId: 3 })).map((r) => r.id)).toEqual([1]);
    expect((await service.searchRepartitionTeams({ groupId: 8 }))).toHaveLength(2);
    expect((await service.searchRepartitionTeams({ fill: 'free' })).map((r) => r.id)).toEqual([1]);
    expect((await service.searchRepartitionTeams({ fill: 'full' })).map((r) => r.id)).toEqual([2]);
  });
});

describe('TeamBenevolesService.searchRepartitionVolunteers', () => {
  const volunteersFixture = [
    {
      id: 12,
      firstName: 'Camille',
      lastName: 'Perrot',
      team: 'Régie scène',
      skills: [{ skill: 'ANIMATION' }],
      tags: [{ value: 'référent' }],
      teamMemberships: [{ volunteerTeam: { id: 5, name: 'Régie scène' } }],
    },
    {
      id: 13,
      firstName: 'Karim',
      lastName: 'Benali',
      team: null,
      skills: [{ skill: 'TRANSPORT' }],
      tags: [],
      teamMemberships: [{ volunteerTeam: { id: 6, name: 'Logistique' } }],
    },
  ];
  const fichesFixture = [
    {
      volunteer: { id: 12 },
      teamMemberships: [{ team: { id: 45, name: 'Équipe des Lynx' } }],
    },
  ];

  it('retourne pôles, compétences, étiquettes et équipe actuelle', async () => {
    const { service, repos } = build();
    repos.volunteers.find.mockResolvedValue(volunteersFixture);
    repos.participants.find.mockResolvedValue(fichesFixture);
    const result = await service.searchRepartitionVolunteers({});
    expect(result.total).toBe(2);
    expect(result.volunteers[0]).toMatchObject({
      id: 12,
      poles: ['Régie scène'],
      skills: ['ANIMATION'],
      tags: ['référent'],
      teamId: 45,
      teamName: 'Équipe des Lynx',
    });
    expect(result.volunteers[1]).toMatchObject({ id: 13, teamId: null, teamName: null });
  });

  it('filtre par recherche, compétence, pôle, étiquette et affectation', async () => {
    const { service, repos } = build();
    repos.volunteers.find.mockResolvedValue(volunteersFixture);
    repos.participants.find.mockResolvedValue(fichesFixture);
    const ids = async (q: Parameters<typeof service.searchRepartitionVolunteers>[0]) =>
      (await service.searchRepartitionVolunteers(q)).volunteers.map((v) => v.id);
    expect(await ids({ search: 'karim ben' })).toEqual([13]);
    expect(await ids({ skill: 'TRANSPORT' })).toEqual([13]);
    expect(await ids({ tag: 'référent' })).toEqual([12]);
    expect(await ids({ poleId: 6 })).toEqual([13]);
    expect(await ids({ assignment: 'unassigned' })).toEqual([13]);
    expect(await ids({ assignment: 'assigned' })).toEqual([12]);
  });

  it('pagine sans plafond silencieux : total complet et page demandée', async () => {
    const { service, repos } = build();
    const many = Array.from({ length: 250 }, (_, i) => ({
      id: i + 1,
      firstName: `Prenom${i}`,
      lastName: 'Nom',
      team: null,
      skills: [],
      tags: [],
      teamMemberships: [],
    }));
    repos.volunteers.find.mockResolvedValue(many);
    repos.participants.find.mockResolvedValue([]);

    const page1 = await service.searchRepartitionVolunteers({ limit: 100, offset: 0 });
    expect(page1.total).toBe(250);
    expect(page1.volunteers).toHaveLength(100);

    const page3 = await service.searchRepartitionVolunteers({ limit: 100, offset: 200 });
    expect(page3.total).toBe(250);
    expect(page3.volunteers).toHaveLength(50);

    // « Tout ajouter » : une seule page large suffit sous le max (1000).
    const all = await service.searchRepartitionVolunteers({ limit: 1000 });
    expect(all.volunteers).toHaveLength(250);
  });
});

describe('TeamBenevolesService.applyRepartition', () => {
  it('affecte un bénévole sans fiche : fiche, adhésion et logement créés', async () => {
    const { service, repos } = build();
    const result = await service.applyRepartition({ assignments: [{ volunteerId: 12, teamId: 45 }] });
    expect(result).toEqual({ applied: 1 });
    expect(repos.participants.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: PersonType.BENEVOLE, firstName: 'Camille' }),
    );
    expect(repos.memberships.save).toHaveBeenCalledWith(
      expect.objectContaining({ team: expect.objectContaining({ id: 45 }) }),
    );
    expect(repos.lodgings.save).toHaveBeenCalledWith(
      expect.objectContaining({ volunteerId: 12, teamId: 45 }),
    );
  });

  it('déplace un bénévole d’une équipe à une autre en conservant sa fiche', async () => {
    const fiche = {
      id: 501,
      teamMemberships: [{ team: { id: 46, name: 'Renards 2' } }],
      hostFamilyAssignments: [],
    };
    const { service, repos } = build({ participantsFindOne: fiche });
    const result = await service.applyRepartition({ assignments: [{ volunteerId: 12, teamId: 45 }] });
    expect(result).toEqual({ applied: 1 });
    expect(repos.memberships.remove).toHaveBeenCalled();
    expect(repos.participants.remove).not.toHaveBeenCalled();
    expect(repos.memberships.save).toHaveBeenCalledWith(
      expect.objectContaining({ team: expect.objectContaining({ id: 45 }) }),
    );
  });

  it('retire un bénévole (teamId null) : adhésion et fiche supprimées', async () => {
    const lodging = { id: 9, volunteerId: 12, teamId: 45 };
    const fiche = { id: 501, teamMemberships: [{ team }], hostFamilyAssignments: [] };
    const { service, repos } = build({ participantsFindOne: fiche, lodgingsFindOne: lodging });
    const result = await service.applyRepartition({ assignments: [{ volunteerId: 12, teamId: null }] });
    expect(result).toEqual({ applied: 1 });
    expect(repos.memberships.remove).toHaveBeenCalled();
    expect(repos.participants.remove).toHaveBeenCalledWith(fiche);
    expect(repos.lodgings.remove).toHaveBeenCalledWith(lodging);
  });

  it('refuse de retirer un bénévole placé dans une famille', async () => {
    const fiche = {
      id: 501,
      teamMemberships: [{ team }],
      hostFamilyAssignments: [{ status: AssignmentStatus.CONFIRMED }],
    };
    const { service, repos } = build({ participantsFindOne: fiche });
    await expect(
      service.applyRepartition({ assignments: [{ volunteerId: 12, teamId: null }] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repos.memberships.save).not.toHaveBeenCalled();
  });

  it('refuse quand l’équipe cible dépasserait sa taille max', async () => {
    const { service } = build({ membersCount: 10 });
    await expect(
      service.applyRepartition({ assignments: [{ volunteerId: 12, teamId: 45 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignore les affectations inchangées et accepte une liste vide', async () => {
    const fiche = { id: 501, teamMemberships: [{ team }], hostFamilyAssignments: [] };
    const { service, repos } = build({ participantsFindOne: fiche });
    await expect(
      service.applyRepartition({ assignments: [{ volunteerId: 12, teamId: 45 }] }),
    ).resolves.toEqual({ applied: 0 });
    expect(repos.memberships.save).not.toHaveBeenCalled();
    await expect(service.applyRepartition({ assignments: [] })).resolves.toEqual({ applied: 0 });
  });

  it('signale un bénévole inconnu', async () => {
    const { service, repos } = build();
    repos.volunteers.findOneBy.mockResolvedValue(null);
    await expect(
      service.applyRepartition({ assignments: [{ volunteerId: 12, teamId: 45 }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
