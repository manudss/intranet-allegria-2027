import { describe, expect, it } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { CreatePublicHostFamilyRegistrationDto } from './public-host-family-registration.dto';

export const hostFamilyPayload = {
  familyName: 'Famille Bernard',
  address: '12 rue des Tilleuls',
  postalCode: '42000',
  city: 'Saint-Étienne',
  phone: '+33601020304',
  email: 'bernard@example.fr',
  maxCapacity: 4,
  maxUnder18: 3,
};

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const parse = (payload: unknown) =>
  pipe.transform(payload, { type: 'body', metatype: CreatePublicHostFamilyRegistrationDto });

describe('CreatePublicHostFamilyRegistrationDto', () => {
  it('normalise les textes et accepte les capacités nulles au sens zéro', async () => {
    const dto = await parse({
      ...hostFamilyPayload,
      familyName: '  Famille Bernard  ',
      maxUnder18: 0,
      maxAnimators: 0,
      constraints: ['  Sans ascenseur  '],
    });
    expect(dto.familyName).toBe('Famille Bernard');
    expect(dto.constraints).toEqual(['Sans ascenseur']);
    expect(dto.maxAnimators).toBe(0);
  });

  it.each([
    'familyName',
    'address',
    'postalCode',
    'city',
    'phone',
    'email',
    'maxCapacity',
    'maxUnder18',
  ])('exige %s', async (key) => {
    const payload: Record<string, unknown> = { ...hostFamilyPayload };
    delete payload[key];
    await expect(parse(payload)).rejects.toThrow();
  });

  it.each([
    { familyName: '   ' },
    { phone: '  ' },
    { email: 'incorrect' },
    { address: ' ' },
    { maxCapacity: 0 },
    { maxCapacity: 2.5 },
    { maxCapacity: '4' },
    { maxCapacity: 2147483648 },
    { maxUnder18: -1 },
    { maxUnder18: 5 },
    { maxUnder18: 1.5 },
    { maxAnimators: -1 },
    { maxAnimators: 5 },
    { maxAnimators: 1.5 },
    { familyName: 'a'.repeat(161) },
    { postalCode: 'a'.repeat(21) },
    { notes: 'a'.repeat(2001) },
    { constraints: [' '] },
    { constraints: [42] },
    { constraints: Array(21).fill('contrainte') },
    { constraints: ['a'.repeat(256)] },
    { status: 'VALIDATED' },
    { latitude: 45 },
    { longitude: 4 },
    { tags: ['test'] },
    { assignments: [1] },
    { participants: [] },
    { parentContact: {} },
  ])('rejette les données invalides ou réservées : %j', async (changes) => {
    await expect(parse({ ...hostFamilyPayload, ...changes })).rejects.toThrow();
  });
});
