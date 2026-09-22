import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerShiftAssignmentStatus } from '../entities';
import { VolunteerShiftAssignmentsService } from './volunteer-shift-assignments.service';

describe('VolunteerShiftAssignmentsService', () => {
  const mission = {
    id: 10,
    title: 'Accueil',
    volunteerTeamId: null,
    responsibleVolunteerId: null,
    volunteerTeam: null,
  };

  const shift = {
    id: 5,
    missionId: mission.id,
    mission,
    startAt: new Date('2027-07-24T08:00:00.000Z'),
    endAt: new Date('2027-07-24T12:00:00.000Z'),
  };

  const buildService = (overrides?: {
    overlapRows?: Array<{
      id: number;
      status: VolunteerShiftAssignmentStatus;
      shiftId: number;
      missionId: number;
    }>;
  }) => {
    const overlapRows = overrides?.overlapRows ?? [];

    const assignmentsRepository = {
      findOneBy: vi.fn().mockResolvedValue(null),
      create: vi.fn((payload) => payload),
      save: vi.fn(async (payload) => ({ ...payload, id: 99 })),
      findOne: vi.fn(async ({ where }: { where: { id: number } }) =>
        where.id === 99
          ? {
              id: 99,
              volunteerId: 1,
              shiftId: shift.id,
              status: VolunteerShiftAssignmentStatus.PROVISIONAL,
              volunteer: { id: 1, firstName: 'Paul', lastName: 'Martin' },
              assignedByUser: { id: 1, email: 'admin@example.org' },
              shift,
            }
          : null,
      ),
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(() => ({
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(
          overlapRows.map((row) => ({
            ...row,
            shift: {
              id: row.shiftId,
              missionId: row.missionId,
              startAt: new Date('2027-07-24T09:00:00.000Z'),
              endAt: new Date('2027-07-24T11:00:00.000Z'),
              mission: { id: row.missionId, title: 'Conflit' },
            },
          })),
        ),
      })),
    };

    const shiftsRepository = {
      findOne: vi.fn().mockResolvedValue(shift),
    };

    const volunteersRepository = {
      findOneBy: vi.fn().mockResolvedValue({ id: 1, firstName: 'Paul', lastName: 'Martin' }),
      findOne: vi.fn().mockResolvedValue(null),
      createQueryBuilder: vi.fn(),
    };

    const membershipsRepository = {
      find: vi.fn().mockResolvedValue([]),
    };

    return new VolunteerShiftAssignmentsService(
      assignmentsRepository as never,
      shiftsRepository as never,
      volunteersRepository as never,
      membershipsRepository as never,
    );
  };

  it('bloque un chevauchement sans force', async () => {
    const service = buildService({
      overlapRows: [
        { id: 12, status: VolunteerShiftAssignmentStatus.CONFIRMED, shiftId: 77, missionId: 33 },
      ],
    });

    await expect(
      service.create(
        { id: 1, email: 'admin@example.org', roles: ['ADMIN'] },
        mission.id,
        shift.id,
        {
          volunteerId: 1,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('autorise un chevauchement force pour ADMIN', async () => {
    const service = buildService({
      overlapRows: [
        { id: 12, status: VolunteerShiftAssignmentStatus.CONFIRMED, shiftId: 77, missionId: 33 },
      ],
    });

    const created = await service.create(
      { id: 1, email: 'admin@example.org', roles: ['ADMIN'] },
      mission.id,
      shift.id,
      { volunteerId: 1, force: true },
    );

    expect(created.id).toBe(99);
  });

  it('interdit le force overlap hors ADMIN/COORDINATOR', async () => {
    const service = buildService({
      overlapRows: [
        { id: 12, status: VolunteerShiftAssignmentStatus.CONFIRMED, shiftId: 77, missionId: 33 },
      ],
    });

    await expect(
      service.create(
        { id: 2, email: 'ops@example.org', roles: ['ANIMATOR'] },
        mission.id,
        shift.id,
        { volunteerId: 1, force: true },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
