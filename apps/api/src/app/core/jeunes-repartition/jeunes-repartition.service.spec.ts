import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MejAgeGroup, ParticipantSex, PersonType, TeamParticipantRole } from '../entities';
import { JeunesRepartitionService } from './jeunes-repartition.service';

const jeune = (id: number, firstName: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: PersonType.JEUNE,
  status: 'CONFIRMED',
  firstName,
  lastName: `NOM-${firstName}`,
  dateOfBirth: '2011-06-15',
  sex: ParticipantSex.FEMALE,
  mejAgeGroup: MejAgeGroup.TA,
  city: 'Roanne',
  diocese: null,
  group: { id: 1, name: 'MEJ Roanne', diocese: 'Lyon' },
  teamMemberships: [],
  ...overrides,
});

const animateur = (id: number, firstName: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: PersonType.ANIMATEUR,
  status: 'CONFIRMED',
  firstName,
  lastName: `Nom${id}`,
  dateOfBirth: '1998-03-10',
  sex: ParticipantSex.MALE,
  mejAgeGroup: null,
  city: 'Lyon',
  diocese: 'Lyon',
  group: { id: 2, name: 'MEJ Lyon', diocese: 'Lyon' },
  teamMemberships: [],
  ...overrides,
});

const team = (id: number, name: string, maxSize = 8, members: unknown[] = []) => ({
  id,
  name,
  maxSize,
  group: null,
  members,
});

const build = (data: { participants?: unknown[]; teams?: unknown[] } = {}) => {
  const manager = {
    find: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    save: vi.fn(async (_e: unknown, payload: unknown) => payload),
    create: vi.fn((_e: unknown, payload: unknown) => payload),
    count: vi.fn().mockResolvedValue(0),
  };
  const repos = {
    participants: {
      find: vi.fn().mockResolvedValue(data.participants ?? []),
      manager: { transaction: vi.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)) },
    },
    teams: {
      find: vi.fn().mockResolvedValue(data.teams ?? []),
      create: vi.fn((payload: unknown) => payload),
      save: vi.fn(async (payload: { name: string }) => ({ id: 900, ...payload })),
    },
    teamParticipants: {},
    groups: { find: vi.fn().mockResolvedValue([]) },
  };
  const service = new JeunesRepartitionService(
    repos.participants as never,
    repos.teams as never,
    repos.teamParticipants as never,
    repos.groups as never,
  );
  return { service, repos, manager };
};

describe('JeunesRepartitionService', () => {
  describe('searchParticipants', () => {
    it('masque le nom des jeunes mais garde celui des animateurs', async () => {
      const { service } = build({ participants: [jeune(1, 'Lina'), animateur(2, 'Marc')] });
      const result = await service.searchParticipants({});

      const lina = result.participants.find((p) => p.id === 1)!;
      const marc = result.participants.find((p) => p.id === 2)!;
      expect(lina.lastName).toBeNull();
      expect(marc.lastName).toBe('Nom2');
      expect(lina.type).toBe('JEUNE');
    });

    it('filtre par type, groupe et affectation', async () => {
      const assigned = jeune(1, 'Lina', { teamMemberships: [{ team: { id: 7, name: 'Équipe 1' } }] });
      const free = jeune(2, 'Zoé');
      const anim = animateur(3, 'Marc');
      const { service } = build({ participants: [assigned, free, anim] });

      const unassigned = await service.searchParticipants({ assignment: 'unassigned' });
      expect(unassigned.participants.map((p) => p.id).sort()).toEqual([2, 3]);

      const jeunesOnly = await service.searchParticipants({ type: 'JEUNE' });
      expect(jeunesOnly.participants.map((p) => p.id).sort()).toEqual([1, 2]);

      const byGroup = await service.searchParticipants({ groupId: 2 });
      expect(byGroup.participants.map((p) => p.id)).toEqual([3]);
    });

    it('recherche sur le prénom (et le nom pour les animateurs) et pagine', async () => {
      const { service } = build({
        participants: [jeune(1, 'Lina'), jeune(2, 'Zoé'), animateur(3, 'Marc')],
      });

      const found = await service.searchParticipants({ search: 'lin' });
      expect(found.participants.map((p) => p.id)).toEqual([1]);

      const byLastName = await service.searchParticipants({ search: 'nom3' });
      expect(byLastName.participants.map((p) => p.id)).toEqual([3]);

      const page = await service.searchParticipants({ limit: 2, offset: 2 });
      expect(page.total).toBe(3);
      expect(page.participants).toHaveLength(1);
    });
  });

  describe('repartitionFilters', () => {
    it('renvoie les listes distinctes triées', async () => {
      const { service } = build({ participants: [jeune(1, 'Lina'), animateur(2, 'Marc')] });
      const filters = await service.repartitionFilters();

      expect(filters.groups).toEqual([
        { id: 2, name: 'MEJ Lyon' },
        { id: 1, name: 'MEJ Roanne' },
      ]);
      expect(filters.cities).toEqual(['Lyon', 'Roanne']);
      expect(filters.dioceses).toEqual(['Lyon']);
      expect(filters.ageGroups).toEqual([MejAgeGroup.TA]);
    });
  });

  describe('searchTeams', () => {
    it('calcule le remplissage et filtre les équipes avec places libres', async () => {
      const full = team(1, 'Équipe 1', 2, [
        { participant: jeune(1, 'A') },
        { participant: animateur(2, 'B') },
      ]);
      const free = team(2, 'Équipe 2', 8, [{ participant: jeune(3, 'C') }]);
      const { service } = build({ teams: [full, free] });

      const all = await service.searchTeams({});
      expect(all[0]).toMatchObject({ id: 1, jeunesCount: 1, adultesCount: 1, totalCount: 2 });

      const withRoom = await service.searchTeams({ fill: 'free' });
      expect(withRoom.map((t) => t.id)).toEqual([2]);

      const fullTeams = await service.searchTeams({ fill: 'full' });
      expect(fullTeams.map((t) => t.id)).toEqual([1]);
    });
  });

  describe('bulkCreateTeams', () => {
    it('crée X équipes numérotées à la suite des existantes', async () => {
      const { service, repos } = build({ teams: [team(1, 'Équipe 1'), team(2, 'Équipe 3'), team(3, 'Autre')] });
      const result = await service.bulkCreateTeams({ count: 2, baseName: 'Équipe', maxSize: 7 });

      expect(result.created.map((t) => t.name)).toEqual(['Équipe 4', 'Équipe 5']);
      expect(repos.teams.save).toHaveBeenCalledTimes(2);
      expect(result.created[0].maxSize).toBe(7);
    });

    it('utilise « Équipe » et 12 par défaut', async () => {
      const { service } = build({});
      const result = await service.bulkCreateTeams({ count: 1 });
      expect(result.created[0].name).toBe('Équipe 1');
      expect(result.created[0].maxSize).toBe(12);
    });

    it('rejette un nombre hors limites', async () => {
      const { service } = build({});
      await expect(service.bulkCreateTeams({ count: 0 })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.bulkCreateTeams({ count: 101 })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('propose', () => {
    it('refuse sans participants ou sans équipes', async () => {
      const { service } = build({});
      await expect(service.propose({ participantIds: [], teamIds: [1] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.propose({ participantIds: [1], teamIds: [] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('propose une répartition avec les défauts 6 jeunes / 1 animateur', async () => {
      const pool = [
        animateur(101, 'Marc'),
        ...Array.from({ length: 12 }, (_, i) =>
          jeune(i + 1, `J${i + 1}`, { group: { id: 10 + i, name: `G${i}`, diocese: 'Lyon' } }),
        ),
      ];
      const teams = [team(1, 'Équipe 1'), team(2, 'Équipe 2')];
      const { service } = build({ participants: pool, teams });

      const result = await service.propose({
        participantIds: pool.map((p) => p.id),
        teamIds: [1, 2],
      });

      expect(result.unplaced).toEqual([]);
      expect(result.proposals).toHaveLength(13);
      const stats = new Map(result.teamStats.map((s) => [s.teamId, s]));
      expect(stats.get(1)!.jeunes).toBe(6);
      expect(stats.get(2)!.jeunes).toBe(6);
      expect(stats.get(1)!.adultes + stats.get(2)!.adultes).toBe(1);
    });

    it('ne déplace pas les jeunes déjà affectés par défaut et les compte dans leur équipe', async () => {
      const assigned = jeune(1, 'Lina', { teamMemberships: [{ team: { id: 1, name: 'Équipe 1' } }] });
      const free = jeune(2, 'Zoé', { group: { id: 9, name: 'Autre', diocese: 'Lyon' } });
      const { service } = build({ participants: [assigned, free], teams: [team(1, 'Équipe 1'), team(2, 'Équipe 2')] });

      const result = await service.propose({ participantIds: [1, 2], teamIds: [1, 2] });

      expect(result.proposals).toHaveLength(1);
      expect(result.proposals[0].participantId).toBe(2);
      const stats1 = result.teamStats.find((s) => s.teamId === 1)!;
      expect(stats1.jeunes).toBe(1); // Lina compte dans Équipe 1 sans proposition
    });

    it('déplace les jeunes affectés quand moveAssigned est vrai', async () => {
      const assigned = jeune(1, 'Lina', { teamMemberships: [{ team: { id: 1, name: 'Équipe 1' } }] });
      const { service } = build({ participants: [assigned], teams: [team(1, 'Équipe 1'), team(2, 'Équipe 2')] });

      const result = await service.propose({
        participantIds: [1],
        teamIds: [1, 2],
        params: { moveAssigned: true },
      });

      expect(result.proposals).toHaveLength(1);
      expect(result.teamStats.find((s) => s.teamId === 1)!.jeunes).toBe(0 + (result.proposals[0].teamId === 1 ? 1 : 0));
    });
  });

  describe('apply', () => {
    it('crée, déplace et retire des affectations en une transaction', async () => {
      const lina = { ...jeune(1, 'Lina'), teamMemberships: [] };
      const zoe = { ...jeune(2, 'Zoé'), teamMemberships: [{ id: 55, team: { id: 1 } }] };
      const marc = { ...animateur(3, 'Marc'), teamMemberships: [] };
      const { service, manager } = build({});
      manager.find
        .mockResolvedValueOnce([lina, zoe, marc]) // participants
        .mockResolvedValueOnce([team(2, 'Équipe 2')]); // équipe cible (seule référencée)
      manager.count.mockResolvedValue(0);

      const result = await service.apply({
        assignments: [
          { participantId: 1, teamId: 2 },
          { participantId: 2, teamId: 2 },
          { participantId: 3, teamId: null },
        ],
      });

      expect(result.applied).toBe(2);
      expect(manager.save).toHaveBeenCalledTimes(2);
      expect(manager.delete).toHaveBeenCalledTimes(1); // déplacement de Zoé ; Marc n avait rien à retirer
    });

    it('attribue le rôle MEMBER au premier animateur puis ASSISTANT', async () => {
      const anim1 = { ...animateur(1, 'Marc'), teamMemberships: [] };
      const anim2 = { ...animateur(2, 'Luc'), teamMemberships: [] };
      const { service, manager } = build({});
      manager.find
        .mockResolvedValueOnce([anim1, anim2])
        .mockResolvedValueOnce([team(1, 'Équipe 1')]);
      manager.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      await service.apply({
        assignments: [
          { participantId: 1, teamId: 1 },
          { participantId: 2, teamId: 1 },
        ],
      });

      const roles = manager.create.mock.calls.map((call) => call[1].role);
      expect(roles).toEqual([TeamParticipantRole.MEMBER, TeamParticipantRole.ASSISTANT]);
    });

    it('rejette des participants ou équipes inconnus', async () => {
      const { service, manager } = build({});
      manager.find.mockResolvedValue([]);
      await expect(
        service.apply({ assignments: [{ participantId: 99, teamId: 1 }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ne fait rien sans affectations', async () => {
      const { service } = build({});
      expect(await service.apply({ assignments: [] })).toEqual({ applied: 0 });
    });
  });
});
