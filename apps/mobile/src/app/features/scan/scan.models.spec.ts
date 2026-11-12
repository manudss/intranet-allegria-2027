import { evaluateScan, ScanPointConfig, ScanTableRow } from './scan.models';

const point = (type: ScanPointConfig['type']): ScanPointConfig => ({
  id: 'p1',
  code: 'T1',
  label: 'Test',
  type,
  active: true,
  config: null,
});

const row = (over: Partial<ScanTableRow> = {}): ScanTableRow => ({
  qrCodeHash: 'h1',
  firstName: 'Ada',
  lastName: 'Martin',
  teamName: 'Lyon 2',
  participantType: 'Jeune',
  badgeStatus: 'ACTIVE',
  hasActivePass: true,
  checkedOutAt: null,
  servedMealCount: 0,
  ...over,
});

describe('evaluateScan', () => {
  it('badge inconnu → unknown', () => {
    expect(evaluateScan(undefined, 'ENTRY', point('ENTRY'), new Set()).kind).toBe('unknown');
  });

  it('entrée valide → ok', () => {
    const v = evaluateScan(row(), 'ENTRY', point('ENTRY'), new Set());
    expect(v.kind).toBe('ok');
    expect(v.detail).toContain('Ada Martin');
  });

  it('badge inactif ou pass révoqué → ko', () => {
    expect(evaluateScan(row({ badgeStatus: 'LOST' }), 'ENTRY', point('ENTRY'), new Set()).kind).toBe('ko');
    expect(evaluateScan(row({ hasActivePass: false }), 'ENTRY', point('ENTRY'), new Set()).kind).toBe('ko');
  });

  it('déjà sorti → ko', () => {
    expect(evaluateScan(row({ checkedOutAt: '2027-07-01T10:00:00Z' }), 'ENTRY', point('ENTRY'), new Set()).kind).toBe('ko');
  });

  it('doublon entrée → already', () => {
    const v = evaluateScan(row(), 'ENTRY', point('ENTRY'), new Set(['h1']));
    expect(v.kind).toBe('already');
  });

  it('repas : compteur de service incrémenté (direction C)', () => {
    const v = evaluateScan(row({ servedMealCount: 2 }), 'ENTRY', point('MEAL'), new Set());
    expect(v.kind).toBe('ok');
    expect(v.servedCount).toBe(3);
  });

  it('repas déjà servi → already avec compteur actuel', () => {
    const v = evaluateScan(row({ servedMealCount: 1 }), 'ENTRY', point('MEAL'), new Set(['h1']));
    expect(v.kind).toBe('already');
    expect(v.servedCount).toBe(1);
  });

  it('sortie → ok « Sortie enregistrée »', () => {
    const v = evaluateScan(row(), 'EXIT', point('EXIT'), new Set());
    expect(v.kind).toBe('ok');
    expect(v.title).toContain('Sortie');
  });
});
