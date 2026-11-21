import { describe, it, expect } from 'vitest';
import { buildFamilyDemo } from './family-demo-seed';
import { HEALTH_FIELDS, HEALTH_MODEL_ITEMS, missingRequirements } from '@mej-allegria/shared';
describe('Fictional family seed scenarios', () => {
  it('covers all seven dossier states, four payment simulation states, editable, submitted and withdrawn attestations', () => {
    const { family, rules } = buildFamilyDemo();
    expect(family.email).toBe('famille-demo@example.test');
    expect(new Set(family.youths.map((y) => y.state))).toEqual(
      new Set([
        'DRAFT',
        'SUBMITTED',
        'CORRECTION',
        'VALIDATED',
        'CONFIRMED',
        'REFUSED',
        'CANCELLED',
      ]),
    );
    expect(new Set(family.youths.map((y) => y.simulation))).toEqual(
      new Set(['NOT_TESTED', 'SUCCESS', 'FAILURE', 'CANCELLED']),
    );
    expect(family.youths.some((y) => y.signatures.some((s) => s.withdrawnAt))).toBe(true);
    expect(missingRequirements(family.youths[0], family.contact, rules as never)).toEqual([]);
    expect(
      missingRequirements(family.youths[1], family.contact, rules as never).length,
    ).toBeGreaterThan(0);
  });
  it('provides every health page and explicit yes/no/missing examples for read-only preview, without activating collection', () => {
    const { family, rules } = buildFamilyDemo(),
      first = rules.previewHealthSamples[family.youths[0].id],
      second = rules.previewHealthSamples[family.youths[1].id];
    expect(Object.keys(first.answers).sort()).toEqual([...HEALTH_FIELDS].sort());
    expect(Object.keys(first.presence)).toHaveLength(HEALTH_MODEL_ITEMS.length);
    expect(Object.values(first.presence)).toContain('YES');
    expect(Object.values(first.presence)).toContain('NO');
    expect(Object.keys(second.presence).length).toBeLessThan(HEALTH_MODEL_ITEMS.length);
    expect(rules.healthMode).toBe('PAPER');
    expect(rules.previewDemoSeed).toBe(true);
  });
});
