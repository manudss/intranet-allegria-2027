import { describe, expect, it, vi } from 'vitest';
import { PublicVolunteerApplicationsController } from './public-volunteer-applications.controller';
import { PublicRegistrationsService } from './public-registrations.service';
import { CreatePublicVolunteerApplicationDto } from './public-volunteer-application.dto';

describe('PublicVolunteerApplicationsController', () => {
  const basePayload: CreatePublicVolunteerApplicationDto = {
    firstName: 'Julien',
    lastName: 'Martin',
    email: 'julien.martin@example.fr',
    phone: '+33601020304',
  } as CreatePublicVolunteerApplicationDto;

  it('délègue au service quand le honeypot est vide', async () => {
    const service = {
      createVolunteerApplication: vi.fn().mockResolvedValue({ status: 'PENDING' }),
    } as unknown as PublicRegistrationsService;
    const controller = new PublicVolunteerApplicationsController(service);

    const result = await controller.create(basePayload);

    expect(service.createVolunteerApplication).toHaveBeenCalledWith(basePayload);
    expect(result).toEqual({ status: 'PENDING' });
  });

  it('ignore silencieusement la requête si le honeypot est rempli (bot)', async () => {
    const service = {
      createVolunteerApplication: vi.fn(),
    } as unknown as PublicRegistrationsService;
    const controller = new PublicVolunteerApplicationsController(service);
    const botPayload = { ...basePayload, honeypot: 'je suis un bot' };

    const result = await controller.create(botPayload);

    expect(service.createVolunteerApplication).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'PENDING' });
  });
});
