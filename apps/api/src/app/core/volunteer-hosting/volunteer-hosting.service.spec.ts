import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerHostingType } from '../entities';
import { VolunteerHostingService } from './volunteer-hosting.service';

const build = (overrides: Record<string, unknown> = {}) => {
  const hostingRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((payload) => payload),
    save: vi.fn((payload) => Promise.resolve(payload)),
    remove: vi.fn(),
    ...overrides,
  };
  const service = new VolunteerHostingService(
    hostingRepository as never,
    { findOne: vi.fn().mockResolvedValue({ id: 12 }) } as never,
    { findOne: vi.fn().mockResolvedValue({ id: 34 }) } as never,
  );
  return { service, hostingRepository };
};

describe('VolunteerHostingService', () => {
  it('crée un hébergement en famille d accueil', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue(null) });

    const created = await service.create({
      volunteerId: 12,
      type: VolunteerHostingType.HOST_FAMILY,
      hostFamilyId: 34,
      startAt: '2027-10-31',
      endAt: '2027-11-03',
    });

    expect(created).toMatchObject({
      volunteerId: 12,
      hostFamilyId: 34,
      startAt: '2027-10-31',
      endAt: '2027-11-03',
    });
  });

  it('refuse un second hébergement pour le même bénévole', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue({ id: 1, volunteerId: 12 }) });

    await expect(
      service.create({ volunteerId: 12, type: VolunteerHostingType.ON_SITE }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('exige une famille d accueil pour le type HOST_FAMILY', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue(null) });

    await expect(
      service.create({ volunteerId: 12, type: VolunteerHostingType.HOST_FAMILY }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignore la famille pour un hébergement sur place et valide la période', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue(null) });

    await expect(
      service.create({
        volunteerId: 12,
        type: VolunteerHostingType.ON_SITE,
        hostFamilyId: 34,
        startAt: '2027-11-03',
        endAt: '2027-10-31',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renvoie null quand le bénévole n a pas d hébergement', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue(null) });

    await expect(service.findByVolunteerId(12)).resolves.toBeNull();
  });

  it('rejette une mise à jour sur un hébergement inconnu', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue(null) });

    await expect(service.update(99, { room: 'Dortoir C' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
