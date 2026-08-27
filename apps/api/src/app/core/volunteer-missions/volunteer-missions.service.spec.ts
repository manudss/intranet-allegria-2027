import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerMissionStatus, VolunteerShiftStatus } from '../entities';
import { VolunteerMissionsService } from './volunteer-missions.service';

describe('VolunteerMissionsService', () => {
  it('refuse un shift dont endAt <= startAt', async () => {
    const shiftsRepository = {
      create: vi.fn((payload) => payload),
      save: vi.fn(),
      findOne: vi.fn(),
      remove: vi.fn(),
      find: vi.fn(),
    };

    const service = new VolunteerMissionsService(
      { create: vi.fn(), save: vi.fn(), findOne: vi.fn() } as never,
      shiftsRepository as never,
      { findOneBy: vi.fn() } as never,
      { findOneBy: vi.fn(), findOne: vi.fn() } as never,
      { find: vi.fn() } as never,
    );

    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: VolunteerMissionStatus.TODO,
    } as never);

    await expect(
      service.createShift({ id: 1, email: 'x@y.z', roles: ['ADMIN'] }, 1, {
        startAt: '2027-07-24T12:00:00.000Z',
        endAt: '2027-07-24T10:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une capacite non positive', async () => {
    const service = new VolunteerMissionsService(
      { create: vi.fn(), save: vi.fn(), findOne: vi.fn() } as never,
      { create: vi.fn(), save: vi.fn(), findOne: vi.fn(), remove: vi.fn(), find: vi.fn() } as never,
      { findOneBy: vi.fn() } as never,
      { findOneBy: vi.fn(), findOne: vi.fn() } as never,
      { find: vi.fn() } as never,
    );

    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: VolunteerMissionStatus.TODO,
    } as never);

    await expect(
      service.createShift({ id: 1, email: 'x@y.z', roles: ['ADMIN'] }, 1, {
        startAt: '2027-07-24T08:00:00.000Z',
        endAt: '2027-07-24T10:00:00.000Z',
        capacity: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une transition de statut de shift invalide', async () => {
    const shiftsRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 10,
        missionId: 1,
        status: VolunteerShiftStatus.DONE,
        mission: { id: 1, volunteerTeamId: null, responsibleVolunteerId: null },
      }),
      save: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      find: vi.fn(),
    };

    const service = new VolunteerMissionsService(
      { create: vi.fn(), save: vi.fn(), findOne: vi.fn() } as never,
      shiftsRepository as never,
      { findOneBy: vi.fn() } as never,
      { findOneBy: vi.fn(), findOne: vi.fn() } as never,
      { find: vi.fn() } as never,
    );

    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: VolunteerMissionStatus.TODO,
    } as never);

    await expect(
      service.changeShiftStatus({ id: 1, email: 'x@y.z', roles: ['ADMIN'] }, 1, 10, {
        status: VolunteerShiftStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

