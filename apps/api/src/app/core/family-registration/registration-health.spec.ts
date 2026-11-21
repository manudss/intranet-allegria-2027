import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { seal, unseal, RegistrationHealthService } from './registration-health.service';
import { cateringSummary, EMPTY_HEALTH } from '@mej-allegria/shared';
describe('Confidential health and catering', () => {
  it('encrypts at rest with authenticated youth context and rejects tampering', () => {
    const key = randomBytes(32),
      data = { ...EMPTY_HEALTH, answers: { foodAllergy: 'fictitious' } };
    const s = seal(data, key, 'a:y');
    expect(s).not.toContain('fictitious');
    expect(unseal(s, key, 'a:y')).toEqual(data);
    expect(() => unseal(s, key, 'b:y')).toThrow();
    expect(() => unseal(s, randomBytes(32), 'a:y')).toThrow();
  });
  it('never exposes a small cohort, identity, exact count or free-text medical detail', () => {
    const data = Array.from({ length: 4 }, () => ({
      ...EMPTY_HEALTH,
      foodAllergens: ['MILK'],
      answers: { foodAllergy: 'private' },
    }));
    expect(cateringSummary(data)).toEqual([]);
    data.push({ ...EMPTY_HEALTH, foodAllergens: ['MILK'], answers: { foodAllergy: 'private' } });
    expect(cateringSummary(data)).toEqual([{ allergen: 'MILK', range: '5–9' }]);
    expect(JSON.stringify(cateringSummary(data))).not.toContain('private');
  });
  it('denies health access before all activation prerequisites, including when a family id is known', async () => {
    const s = new RegistrationHealthService(
      {} as never,
      { get: () => undefined } as never,
      {} as never,
    );
    await expect(s.get('known', 'known')).rejects.toThrow('non activée');
  });
});
