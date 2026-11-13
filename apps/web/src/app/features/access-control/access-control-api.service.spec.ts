import { deriveAssignModeForWeb, formatBadgeCode } from './badge-utils';

describe('badge-utils', () => {
  it('formate un code par blocs de 4', () => {
    expect(formatBadgeCode('ab12cd34ef56')).toBe('ab12 cd34 ef56');
    expect(formatBadgeCode('')).toBe('');
  });

  it('détecte le mode remplacement si un badge actif existe', () => {
    expect(deriveAssignModeForWeb([{ endsAt: null }])).toBe('replace');
    expect(deriveAssignModeForWeb([{ endsAt: '2027-07-02T10:00:00Z' }])).toBe('assign');
    expect(deriveAssignModeForWeb([])).toBe('assign');
  });
});
