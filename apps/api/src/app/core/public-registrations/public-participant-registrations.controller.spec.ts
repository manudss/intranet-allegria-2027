import { describe, expect, it, vi } from 'vitest';
import { PublicParticipantRegistrationsController } from './public-participant-registrations.controller';
import { PublicRegistrationsService } from './public-registrations.service';
import { CreatePublicParticipantRegistrationDto } from './public-participant-registration.dto';

describe('PublicParticipantRegistrationsController', () => {
  const basePayload: CreatePublicParticipantRegistrationDto = {
    participants: [
      {
        firstName: 'Marie',
        lastName: 'Durand',
        dateOfBirth: '2011-03-19',
        sex: 'FEMALE',
        mejAgeGroup: 'TA',
      },
    ],
  } as CreatePublicParticipantRegistrationDto;

  it('délègue au service quand le honeypot est vide', async () => {
    const service = {
      createParticipantRegistration: vi.fn().mockResolvedValue({ createdCount: 1, status: 'PENDING' }),
    } as unknown as PublicRegistrationsService;
    const controller = new PublicParticipantRegistrationsController(service);

    const result = await controller.create(basePayload);

    expect(service.createParticipantRegistration).toHaveBeenCalledWith(basePayload);
    expect(result).toEqual({ createdCount: 1, status: 'PENDING' });
  });

  it('ignore silencieusement la requête si le honeypot est rempli (bot)', async () => {
    const service = {
      createParticipantRegistration: vi.fn(),
    } as unknown as PublicRegistrationsService;
    const controller = new PublicParticipantRegistrationsController(service);
    const botPayload = { ...basePayload, honeypot: 'je suis un bot' };

    const result = await controller.create(botPayload);

    expect(service.createParticipantRegistration).not.toHaveBeenCalled();
    expect(result).toEqual({ createdCount: 1, status: 'PENDING' });
  });
});
