import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePublicParticipantRegistrationDto } from './public-participant-registration.dto';

describe('CreatePublicParticipantRegistrationDto', () => {
  const validPayload = {
    parentContact: { name: 'Sophie Durand', phone: '+33601020304' },
    participants: [
      {
        firstName: 'Marie',
        lastName: 'Durand',
        dateOfBirth: '2011-03-19',
        sex: 'FEMALE',
        mejAgeGroup: 'TA',
        diocese: 'Lyon',
        city: 'Villeurbanne',
      },
    ],
  };

  it('accepte un payload valide', async () => {
    const dto = plainToInstance(CreatePublicParticipantRegistrationDto, validPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejette un payload sans participant', async () => {
    const dto = plainToInstance(CreatePublicParticipantRegistrationDto, {
      ...validPayload,
      participants: [],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejette une valeur de sexe invalide', async () => {
    const dto = plainToInstance(CreatePublicParticipantRegistrationDto, {
      participants: [{ ...validPayload.participants[0], sex: 'NOT_A_SEX' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejette une date de naissance invalide', async () => {
    const dto = plainToInstance(CreatePublicParticipantRegistrationDto, {
      participants: [{ ...validPayload.participants[0], dateOfBirth: 'pas-une-date' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepte plus de 10 participants comme invalide (limite anti-abus)', async () => {
    const dto = plainToInstance(CreatePublicParticipantRegistrationDto, {
      participants: Array.from({ length: 11 }, () => ({ ...validPayload.participants[0] })),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
