import { SnapshotEntry, duplicateKeyOf, evaluateScan } from './scan.models';

const entry = (over: Partial<SnapshotEntry> = {}): SnapshotEntry => ({
  assignmentId: 1,
  code: 'abc123',
  firstName: 'Ada',
  lastName: 'Martin',
  personType: 'JEUNE',
  version: 1,
  ...over,
});

describe('evaluateScan', () => {
  it('code inconnu → unknown', () => {
    expect(evaluateScan(undefined, 'ALLOW', null, new Set(), 0).kind).toBe('unknown');
  });

  it('règle ALLOW (entrée) → ok répétable', () => {
    const seen = new Set(['abc123']);
    const v = evaluateScan(entry(), 'ALLOW', null, seen, 0);
    expect(v.kind).toBe('ok');
    expect(v.detail).toContain('Ada Martin');
  });

  it('UNIQUE_PER_DAY → doublon détecté', () => {
    const seen = new Set(['abc123']);
    expect(evaluateScan(entry(), 'UNIQUE_PER_DAY', null, seen, 0).kind).toBe('already');
  });

  it('UNIQUE_PER_SERVICE → compteur de service incrémenté (direction C)', () => {
    const v = evaluateScan(entry(), 'UNIQUE_PER_SERVICE', 'repas-midi', new Set(), 2);
    expect(v.kind).toBe('ok');
    expect(v.servedCount).toBe(3);
  });

  it('UNIQUE_PER_SERVICE → même personne deux fois sur le même service = doublon avec compteur', () => {
    const seen = new Set([duplicateKeyOf('abc123', 'UNIQUE_PER_SERVICE', 'repas-midi')]);
    const v = evaluateScan(entry(), 'UNIQUE_PER_SERVICE', 'repas-midi', seen, 1);
    expect(v.kind).toBe('already');
    expect(v.servedCount).toBe(1);
  });

  it('UNIQUE_PER_SERVICE → autre service = ok', () => {
    const seen = new Set([duplicateKeyOf('abc123', 'UNIQUE_PER_SERVICE', 'repas-midi')]);
    expect(evaluateScan(entry(), 'UNIQUE_PER_SERVICE', 'repas-soir', seen, 0).kind).toBe('ok');
  });
});
