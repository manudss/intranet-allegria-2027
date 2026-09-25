import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePublicVolunteerApplicationDto } from './public-volunteer-application.dto';

describe('CreatePublicVolunteerApplicationDto', () => {
  const validPayload = {
    firstName: 'Julien',
    lastName: 'Martin',
    email: 'julien.martin@example.fr',
    phone: '+33601020304',
    missionsOfInterest: ['accueil', 'logistique'],
    availability: 'Disponible les 4 jours',
    motivation: "Envie de rejoindre l'équipe",
  };

  it('accepte un payload valide', async () => {
    const dto = plainToInstance(CreatePublicVolunteerApplicationDto, validPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejette un e-mail invalide', async () => {
    const dto = plainToInstance(CreatePublicVolunteerApplicationDto, {
      ...validPayload,
      email: 'pas-un-email',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejette un payload sans téléphone', async () => {
    const { phone: _phone, ...withoutPhone } = validPayload;
    const dto = plainToInstance(CreatePublicVolunteerApplicationDto, withoutPhone);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
