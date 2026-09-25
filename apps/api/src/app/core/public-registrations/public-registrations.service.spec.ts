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
