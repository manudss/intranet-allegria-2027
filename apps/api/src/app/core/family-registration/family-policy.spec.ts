import { describe, it, expect } from 'vitest';
import {
  ageOn,
  newYouth,
  DIOCESES,
  DEFAULT_FAMILY_RULES,
  EMPTY_CONTACT,
  missingRequirements,
} from '@mej-allegria/shared';
describe('family registration policy', () => {
  it('has the complete sourced national directory with stable unique ids', () => {
    expect(DIOCESES).toHaveLength(108);
    expect(new Set(DIOCESES.map((d) => d.id)).size).toBe(108);
  });
  it('calculates age at the configured date and rejects invalid dates', () => {
    expect(ageOn('2012-03-03', '2027-03-02')).toBe(14);
    expect(ageOn('2012-03-03', '2027-03-03')).toBe(15);
    expect(ageOn('2012-02-31', '2027-03-03')).toBeNull();
  });
  it('never shares signatures or sensitive fields between siblings', () => {
    const a = newYouth('a'),
      b = newYouth('b');
    a.identity.firstName = 'Camille';
    expect(b.identity.firstName).toBe('');
    expect(b.signatures).not.toBe(a.signatures);
    expect(b.simulation).toBe('NOT_TESTED');
  });
  it('does not turn a complete dossier or simulated payment into acceptance', () => {
    const y = newYouth('x');
    y.simulation = 'SUCCESS';
    expect(y.state).toBe('DRAFT');
    expect(missingRequirements(y, EMPTY_CONTACT, DEFAULT_FAMILY_RULES)).toContain('Prénom');
  });
  it('requires the current document version per child', () => {
    const y = newYouth('x');
    y.signatures = [
      {
        templateId: 'participation',
        version: '1',
        digest: 'x',
        signerName: 'A',
        capacity: 'LEGAL',
        signedAt: '2026-11-20',
      },
    ];
    const r = {
      ...DEFAULT_FAMILY_RULES,
      templates: [
        {
          id: 'participation',
          title: 'Participation',
          version: '2',
          text: 'Texte validé',
          enabled: true,
          required: true,
        },
      ],
    };
    expect(missingRequirements(y, EMPTY_CONTACT, r)).toContain('Signature : Participation');
  });
});
