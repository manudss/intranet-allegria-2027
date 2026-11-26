import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerTeamsService } from './volunteer-teams.service';

describe('VolunteerTeamsService', () => {
  it('trim les champs d une equipe a la creation', async () => {
    const team = { id: 1, name: 'Equipe A', code: 'TEAM_A', description: 'Note', isActive: false };
    const teamsRepository = {
      create: vi.fn((payload) => payload),
      save: vi.fn().mockResolvedValue(team),
    };
    const service = new VolunteerTeamsService(
      teamsRepository as never,
      {} as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service, 'findTeam').mockResolvedValue(team as never);

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
      typeId: null,
    });
  });

  it('refuse une periode de rattachement invalide', async () => {
    const membershipsRepository = {
      create: vi.fn(),
      save: vi.fn(),
    };
    const service = new VolunteerTeamsService(
      {} as never,
      membershipsRepository as never,
      {} as never,
      {} as never,
    );
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
    const service = new VolunteerTeamsService(
      {} as never,
      membershipsRepository as never,
      {} as never,
      {} as never,
    );
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

  it('liste les équipiers en excluant le bénévole lui-même', async () => {
    const membershipsRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 5, volunteerId: 12, volunteerTeamId: 4 }),
      find: vi.fn().mockResolvedValue([
        { id: 5, volunteerId: 12, volunteer: { firstName: 'Ben', lastName: 'Martin' } },
        { id: 6, volunteerId: 13, volunteer: { firstName: 'Aline', lastName: 'Fabre' } },
      ]),
    };
    const service = new VolunteerTeamsService(
      {} as never,
      membershipsRepository as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service as never, 'findVolunteer').mockResolvedValue({ id: 12 } as never);

    const teammates = await service.listTeammates(12, 5);
    expect(teammates).toEqual([
      { id: 6, volunteerId: 13, volunteer: { firstName: 'Aline', lastName: 'Fabre' } },
    ]);
    expect(membershipsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { volunteerTeamId: 4 } }),
    );
  });

  it('refuse les équipiers d une appartenance qui appartient à un autre bénévole', async () => {
    const membershipsRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 5, volunteerId: 99, volunteerTeamId: 4 }),
      find: vi.fn(),
    };
    const service = new VolunteerTeamsService(
      {} as never,
      membershipsRepository as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service as never, 'findVolunteer').mockResolvedValue({ id: 12 } as never);

    await expect(service.listTeammates(12, 5)).rejects.toBeInstanceOf(NotFoundException);
    expect(membershipsRepository.find).not.toHaveBeenCalled();
  });

  describe('types d equipe', () => {
    it('refuse un type inexistant a la creation d une equipe', async () => {
      const service = new VolunteerTeamsService(
        { create: vi.fn() } as never,
        {} as never,
        {} as never,
        { existsBy: vi.fn().mockResolvedValue(false) } as never,
      );
      await expect(service.createTeam({ name: 'A', code: 'A', typeId: 99 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rattache un type existant et permet de le retirer', async () => {
      const team: Record<string, unknown> = { id: 1, name: 'A', code: 'A', typeId: null };
      const teamsRepository = { save: vi.fn().mockResolvedValue(team) };
      const typesRepository = { existsBy: vi.fn().mockResolvedValue(true) };
      const service = new VolunteerTeamsService(
        teamsRepository as never,
        {} as never,
        {} as never,
        typesRepository as never,
      );
      vi.spyOn(service, 'findTeam').mockResolvedValue(team as never);
      await service.updateTeam(1, { typeId: 3 });
      expect(team['typeId']).toBe(3);
      await service.updateTeam(1, { typeId: null });
      expect(team['typeId']).toBeNull();
    });

    it('ne touche pas au type quand typeId est absent de la mise a jour', async () => {
      const team: Record<string, unknown> = { id: 1, name: 'A', code: 'A', typeId: 5 };
      const service = new VolunteerTeamsService(
        { save: vi.fn() } as never,
        {} as never,
        {} as never,
        {} as never,
      );
      vi.spyOn(service, 'findTeam').mockResolvedValue(team as never);
      await service.updateTeam(1, { name: 'B' });
      expect(team['typeId']).toBe(5);
    });

    it('normalise le code d un type et refuse un doublon', async () => {
      const typesRepository = {
        existsBy: vi.fn().mockResolvedValue(false),
        create: vi.fn((p) => p),
        save: vi.fn((p) => Promise.resolve(p)),
      };
      const service = new VolunteerTeamsService(
        {} as never,
        {} as never,
        {} as never,
        typesRepository as never,
      );
      const created = await service.createTeamType({
        code: 'Sécurité civile',
        label: ' Sécurité ',
      });
      expect(created.code).toBe('SECURITE_CIVILE');
      expect(created.label).toBe('Sécurité');
      typesRepository.existsBy.mockResolvedValue(true);
      await expect(service.createTeamType({ code: 'secu', label: 'x' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('renomme un type sans changer son code ni son id', async () => {
      const type = { id: 4, code: 'SECURITE', label: 'Securite', sortOrder: 10, isActive: true };
      const typesRepository = {
        findOneBy: vi.fn().mockResolvedValue(type),
        save: vi.fn((t) => Promise.resolve(t)),
      };
      const service = new VolunteerTeamsService(
        {} as never,
        {} as never,
        {} as never,
        typesRepository as never,
      );
      const updated = await service.updateTeamType(4, { label: '  Sécurité  ' });
      expect(updated).toMatchObject({ id: 4, code: 'SECURITE', label: 'Sécurité' });
    });
  });
});
