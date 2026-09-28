import { describe, expect, it, vi } from 'vitest';
import { PublicRegistrationsService } from './public-registrations.service';
import { ParticipantRegistrationStatus, PersonSource } from '../entities';

describe('PublicRegistrationsService', () => {
  it('crée les participants en transaction avec statut PENDING et source PUBLIC_FORM', async () => {
    const created: Record<string, unknown>[] = [];
    const fakeRepository = {
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (entities: Record<string, unknown>[]) => {
        created.push(...entities);
        return entities;
      }),
    };
    const manager = { getRepository: vi.fn().mockReturnValue(fakeRepository) };
    const dataSource = {
      transaction: vi.fn(async (fn: (manager: unknown) => Promise<unknown>) => fn(manager)),
    };
    const volunteerApplicationsRepository = {};

    const service = new PublicRegistrationsService(
      dataSource as never,
      volunteerApplicationsRepository as never,
      {} as never,
    );

    const result = await service.createParticipantRegistration({
      parentContact: { name: 'Sophie Durand', phone: '+33601020304' },
      participants: [
        {
          firstName: 'Marie',
          lastName: 'Durand',
          dateOfBirth: '2011-03-19',
          sex: 'FEMALE',
          mejAgeGroup: 'TA',
        },
        {
          firstName: 'Paul',
          lastName: 'Durand',
          dateOfBirth: '2013-06-02',
          sex: 'MALE',
          mejAgeGroup: 'TA',
        },
      ],
    } as never);

    expect(result).toEqual({ createdCount: 2, status: 'PENDING' });
    expect(created).toHaveLength(2);
    for (const entry of created) {
      expect(entry['status']).toBe(ParticipantRegistrationStatus.PENDING);
      expect(entry['source']).toBe(PersonSource.PUBLIC_FORM);
      expect(entry['emergencyContactName']).toBe('Sophie Durand');
      expect(entry['emergencyContactPhone']).toBe('+33601020304');
    }
  });

  it('crée une candidature bénévole en attente de validation', async () => {
    const saved: Record<string, unknown>[] = [];
    const volunteerApplicationsRepository = {
      create: vi.fn((data: Record<string, unknown>) => data),
      save: vi.fn(async (entity: Record<string, unknown>) => {
        saved.push(entity);
        return entity;
      }),
    };
    const dataSource = { transaction: vi.fn() };

    const service = new PublicRegistrationsService(
      dataSource as never,
      volunteerApplicationsRepository as never,
      {} as never,
    );

    const result = await service.createVolunteerApplication({
      firstName: 'Julien',
      lastName: 'Martin',
      email: 'julien.martin@example.fr',
      phone: '+33601020304',
    } as never);

    expect(result).toEqual({ status: 'PENDING' });
    expect(saved).toHaveLength(1);
  });
});

describe('Proposition publique de famille d’accueil', () => {
  it('enregistre uniquement une famille DRAFT et conserve les informations utiles', async () => {
    const repository = {
      create: vi.fn((data) => data),
      save: vi.fn().mockResolvedValue({ id: 12 }),
    };
    const dataSource = { transaction: vi.fn() };
    const volunteerRepository = { save: vi.fn() };
    const service = new PublicRegistrationsService(
      dataSource as never,
      volunteerRepository as never,
      repository as never,
    );
    const payload = {
      familyName: 'Famille Bernard',
      address: '12 rue des Tilleuls',
      postalCode: '42000',
      city: 'Saint-Étienne',
      phone: '+33601020304',
      email: 'bernard@example.fr',
      maxCapacity: 4,
      maxUnder18: 3,
      maxAnimators: 0,
      parish: 'Saint-Pierre',
      constraints: ['Sans ascenseur'],
      notes: 'Deux chambres',
    };
    expect(await service.createHostFamilyRegistration(payload)).toEqual({ status: 'DRAFT' });
    expect(repository.save).toHaveBeenCalledExactlyOnceWith({
      ...payload,
      status: 'DRAFT',
      latitude: null,
      longitude: null,
      tags: null,
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(volunteerRepository.save).not.toHaveBeenCalled();
  });

  it('laisse les capacités facultatives non renseignées et propage les erreurs de persistance', async () => {
    const repository = {
      create: vi.fn((data) => data),
      save: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const service = new PublicRegistrationsService({} as never, {} as never, repository as never);
    await expect(
      service.createHostFamilyRegistration({
        familyName: 'Bernard',
        address: '12 rue des Tilleuls',
        postalCode: '42000',
        city: 'Saint-Étienne',
        phone: '+33601020304',
        email: 'bernard@example.fr',
        maxCapacity: 4,
        maxUnder18: 0,
      }),
    ).rejects.toThrow('database unavailable');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        maxAnimators: null,
        parish: null,
        constraints: null,
        notes: null,
      }),
    );
  });
});
