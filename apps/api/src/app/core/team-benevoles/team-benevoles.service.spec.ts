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
    teams: { findOneBy: vi.fn().mockResolvedValue(team) },
    volunteers: { findOneBy: vi.fn().mockResolvedValue(volunteer) },
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
