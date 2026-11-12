import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AssignmentStatus } from '../entities';
import { VolunteerHostingService } from './volunteer-hosting.service';

const build = (overrides: Record<string, unknown> = {}) => {
  const lodgingsRepository = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((payload) => payload),
    save: vi.fn((payload) => Promise.resolve(payload)),
    remove: vi.fn(),
    ...overrides,
  };
  const service = new VolunteerHostingService(
    lodgingsRepository as never,
    { findOne: vi.fn().mockResolvedValue({ id: 12 }) } as never,
    { findOne: vi.fn().mockResolvedValue({ id: 45, name: 'Équipe des Lynx' }) } as never,
  );
  return { service, lodgingsRepository };
};

const teamWithMembers = {
  id: 45,
  name: 'Équipe des Lynx',
  primaryAnimator: { id: 20, firstName: 'Sarah', lastName: 'Nguyen', phone: '+33645678901' },
  secondaryAnimator: { id: 21, firstName: 'Marc', lastName: 'Duret', phone: null },
  members: [
    {
      participant: {
        firstName: 'Zoé',
        lastName: 'Secret',
        hostFamilyAssignments: [
          {
            status: AssignmentStatus.CONFIRMED,
            hostFamily: {
              id: 34,
              familyName: 'Famille Bernard',
              address: '12 rue des Tilleuls',
              postalCode: '69003',
              city: 'Lyon',
              phone: '+33472727272',
            },
          },
        ],
      },
    },
    {
      participant: {
        firstName: 'Adam',
        lastName: 'Secret',
        hostFamilyAssignments: [
          {
            status: AssignmentStatus.CANCELLED,
            hostFamily: {
              id: 35,
              familyName: 'Famille Annulée',
              address: 'x',
              postalCode: '69000',
              city: 'Lyon',
              phone: null,
            },
          },
        ],
      },
    },
    {
      participant: { firstName: 'Léa', lastName: 'Secret', hostFamilyAssignments: [] },
    },
  ],
};

describe('VolunteerHostingService', () => {
  it('crée un logement rattaché à une équipe de jeunes', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue(null) });

    const created = await service.create({
      volunteerId: 12,
      teamId: 45,
      room: 'Dortoir B',
      startAt: '2027-10-31',
      endAt: '2027-11-03',
    });

    expect(created).toMatchObject({
      volunteerId: 12,
      teamId: 45,
      room: 'Dortoir B',
      startAt: '2027-10-31',
      endAt: '2027-11-03',
    });
  });

  it('refuse un second logement pour le même bénévole', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue({ id: 1 }) });

    await expect(service.create({ volunteerId: 12, teamId: 45 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejette une équipe inconnue', async () => {
    const lodgings = { findOne: vi.fn().mockResolvedValue(null) };
    const service = new VolunteerHostingService(
      lodgings as never,
      { findOne: vi.fn().mockResolvedValue({ id: 12 }) } as never,
      { findOne: vi.fn().mockResolvedValue(null) } as never,
    );

    await expect(service.create({ volunteerId: 12, teamId: 99 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('valide la période', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue(null) });

    await expect(
      service.create({ volunteerId: 12, teamId: 45, startAt: '2027-11-03', endAt: '2027-10-31' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('compose la vue /me : équipe, animateurs, prénoms des jeunes seulement, familles actives', async () => {
    const lodging = { id: 5, room: null, notes: null, startAt: '2027-10-31', endAt: '2027-11-03', team: teamWithMembers };
    const { service } = build({ findOne: vi.fn().mockResolvedValue(lodging) });

    const view = await service.findByVolunteerId(12);

    expect(view?.team).toEqual({ id: 45, name: 'Équipe des Lynx' });
    expect(view?.animators).toEqual([
      { id: 20, firstName: 'Sarah', lastName: 'Nguyen', role: 'PRIMARY', phone: '+33645678901' },
      { id: 21, firstName: 'Marc', lastName: 'Duret', role: 'SECONDARY', phone: null },
    ]);
    // jeunes : prénoms triés, aucune autre donnée exposée
    expect(view?.youths).toEqual([{ firstName: 'Adam' }, { firstName: 'Léa' }, { firstName: 'Zoé' }]);
    expect(JSON.stringify(view?.youths)).not.toContain('Secret');
    // famille annulée exclue
    expect(view?.hostFamilies).toEqual([
      {
        id: 34,
        familyName: 'Famille Bernard',
        address: '12 rue des Tilleuls',
        postalCode: '69003',
        city: 'Lyon',
        phone: '+33472727272',
      },
    ]);
  });

  it('renvoie null quand le bénévole n a pas de logement', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue(null) });

    await expect(service.findByVolunteerId(12)).resolves.toBeNull();
  });

  it('rejette une mise à jour sur un logement inconnu', async () => {
    const { service } = build({ findOne: vi.fn().mockResolvedValue(null) });

    await expect(service.update(99, { room: 'Dortoir C' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
