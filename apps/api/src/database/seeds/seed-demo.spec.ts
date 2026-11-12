import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Le seed alimente des environnements de demo : ses comptes doivent etre
// connectables sans consulter le code, et les comptes benevoles doivent
// pouvoir ouvrir "Mon espace" (role VOLUNTEERS, sinon 403 sur /api/me/*).
describe('seed demo accounts', () => {
  const seed = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

  it('defines a single documented demo password', () => {
    expect(seed).toContain("const DEMO_PASSWORD = 'demo-only-not-a-secret';");
  });

  it('uses the shared demo password for every seeded account', () => {
    const otherPasswords = [...seed.matchAll(/hashPassword\(([^)]*)\)/g)]
      .map((m) => m[1])
      .filter((arg) => arg !== 'DEMO_PASSWORD');
    expect(otherPasswords).toEqual([]);
  });

  it('assigns the VOLUNTEERS role to volunteer accounts', () => {
    const animatorLoop =
      /for \(const animatorUser of animatorUsers\) \{([\s\S]*?)\n    \}/.exec(seed)?.[1] ?? '';
    expect(animatorLoop).toContain('ROLE_CODES.volunteers');
  });

  it('keeps group and pole dates on the event window (31 oct. - 3 nov. 2027)', () => {
    // Dates groupe/pole situees hors evenement avant la correction.
    // (refDate faker et maj des fiches sante restent volontairement anterieures
    // a l'evenement : dossiers remplis en amont.)
    expect(seed).not.toMatch(/2027-07-(15|19|27|30)/);
  });

  it('lists usable demo accounts in the seed logs', () => {
    expect(seed).toContain('Comptes de demo utilisables');
    expect(seed).toContain('animator.1@allegria.local');
  });
});
