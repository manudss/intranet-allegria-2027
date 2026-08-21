import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerTeamsService } from './volunteer-teams.service';

describe('VolunteerTeamsService', () => {
  it('trim les champs d une equipe a la creation', async () => {
    const team = { id: 1, name: 'Equipe A', code: 'TEAM_A', description: 'Note', isActive: false };
    const teamsRepository = {
      create: vi.fn((payload) => payload),
      save: vi.fn().mockResolvedValue(team),
    };
    const service = new VolunteerTeamsService(teamsRepository as never, {} as never, {} as never);

    await expect(
      service.createTeam({
        name: '  Equipe A  ',
        code: '  TEAM_A  ',
        description: '  Note  ',
        isActive: false,
      }),
    ).resolves.toEqual(team);
    expect(teamsRepository.create).toHaveBeenCalledWith({
      name: 'Equipe A',
      code: 'TEAM_A',
      description: 'Note',
      isActive: false,
    });
  });

  it('refuse une periode de rattachement invalide', async () => {
    const membershipsRepository = {
      create: vi.fn(),
      save: vi.fn(),
    };
    const service = new VolunteerTeamsService({} as never, membershipsRepository as never, {} as never);
    vi.spyOn(service as never, 'findVolunteer').mockResolvedValue({ id: 12 } as never);
    vi.spyOn(service as never, 'findTeam').mockResolvedValue({ id: 4 } as never);

    await expect(
      service.createVolunteerMembership(12, {
        volunteerTeamId: 4,
        startAt: '2027-07-20',
        endAt: '2027-07-19',
        role: 'Coordination',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloque un rattachement duplique', async () => {
    const query = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({ id: 99 }),
    };
    const membershipsRepository = {
      createQueryBuilder: vi.fn(() => query),
      create: vi.fn(),
      save: vi.fn(),
      findOneOrFail: vi.fn(),
    };
    const service = new VolunteerTeamsService({} as never, membershipsRepository as never, {} as never);
    vi.spyOn(service as never, 'findVolunteer').mockResolvedValue({ id: 12 } as never);
    vi.spyOn(service as never, 'findTeam').mockResolvedValue({ id: 4 } as never);

    await expect(
      service.createVolunteerMembership(12, {
        volunteerTeamId: 4,
        startAt: '2027-07-20',
        endAt: '2027-07-21',
        role: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
