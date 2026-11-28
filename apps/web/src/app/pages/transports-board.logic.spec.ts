import { describe, expect, it } from 'vitest';
import {
  dragPayload,
  filterTargets,
  gaugeState,
  jaugePercent,
  selectionPersonCount,
  serviceDatesSummary,
  stopsSummary,
  targetKey,
} from './transports-board.logic';
import type { ServeTarget } from './transports-api.service';

const target = (id: number, name: string, personCount: number, carId: number | null = null): ServeTarget => ({
  key: `HOSTING_GROUP:${id}`,
  targetType: 'HOSTING_GROUP',
  id,
  name,
  detail: `${personCount} personnes`,
  personCount,
  assignmentId: carId ? 50 : null,
  carId,
  carName: carId ? 'Car A' : null,
  needsTransport: true,
});

describe('transports-board.logic', () => {
  it('filterTargets : recherche sur le nom et le détail, insensible à la casse', () => {
    const targets = [target(1, 'Zone Nord', 38), target(2, 'Paroisse Sud', 20)];
    expect(filterTargets(targets, '').length).toBe(2);
    expect(filterTargets(targets, 'nord')[0].id).toBe(1);
    expect(filterTargets(targets, 'PERSONNES').length).toBe(2);
    expect(filterTargets(targets, 'absent').length).toBe(0);
  });

  it('dragPayload : la sélection si la ligne en fait partie, sinon la ligne seule', () => {
    const t1 = target(1, 'A', 1);
    const t2 = target(2, 'B', 1);
    expect(dragPayload(new Set([t1.key, t2.key]), t2)).toEqual([t1.key, t2.key]);
    expect(dragPayload(new Set([t1.key]), t2)).toEqual([t2.key]);
  });

  it('gaugeState : sans jauge, sous la jauge, complète à égalité, dépassée au-delà', () => {
    expect(gaugeState({ occupancy: 5, capacity: null })).toBe('none');
    expect(gaugeState({ occupancy: 5, capacity: 10 })).toBe('ok');
    expect(gaugeState({ occupancy: 10, capacity: 10 })).toBe('full');
    expect(gaugeState({ occupancy: 11, capacity: 10 })).toBe('over');
    expect(jaugePercent({ occupancy: 15, capacity: 10 })).toBe(100);
    expect(jaugePercent({ occupancy: 1, capacity: 2 })).toBe(50);
  });

  it('selectionPersonCount : somme des effectifs des cibles cochées', () => {
    const targets = [target(1, 'A', 38), target(2, 'B', 20, 100), target(3, 'C', 0)];
    expect(selectionPersonCount(targets, new Set([targets[0].key, targets[2].key]))).toBe(38);
  });

  it('stopsSummary et serviceDatesSummary : rendus lisibles', () => {
    expect(
      stopsSummary([
        { id: 1, orderIndex: 1, label: 'Lieu du rassemblement', time: '08:15' },
        { id: 2, orderIndex: 0, label: 'Zone Nord', time: '07:30' },
        { id: 3, orderIndex: 2, label: 'Arrêt sans heure', time: null },
      ]),
    ).toBe('07:30 Zone Nord · 08:15 Lieu du rassemblement · Arrêt sans heure');
    expect(serviceDatesSummary(['2027-10-31', '2027-11-01'])).toBe('31/10 · 01/11');
    expect(serviceDatesSummary(null)).toBe('Jours non planifiés');
  });

  it('targetKey : stable par type et id', () => {
    expect(targetKey({ targetType: 'HOST_FAMILY', id: 13 })).toBe('HOST_FAMILY:13');
  });
});
