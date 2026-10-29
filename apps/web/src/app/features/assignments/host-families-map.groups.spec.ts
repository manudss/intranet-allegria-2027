import * as L from 'leaflet';
import { describe, expect, it } from 'vitest';
import { HostFamily } from '../../models/models';
import {
  NO_GROUP_COLOR,
  buildHostFamilyMapItems,
  createHouseIcon,
  filterHostFamilyMapItems,
  groupColor,
} from './host-families-map.utils';

const fam = (id: number, extra: Partial<HostFamily> = {}): HostFamily => ({
  id,
  familyName: `F${id}`,
  address: '',
  postalCode: '42000',
  city: 'Saint-Etienne',
  phone: null,
  email: null,
  maxCapacity: 4,
  maxUnder18: 4,
  parish: null,
  notes: null,
  latitude: 45.44,
  longitude: 4.39,
  maxAnimators: null,
  constraints: null,
  tags: null,
  status: 'VALIDATED',
  ...extra,
});
const base = { sectors: [], status: null, capacityState: null, maxDistanceKm: null, hasAnimators: null, search: '' };

describe('groupes d hebergement sur la carte', () => {
  const groups = [
    { id: 1, name: 'Nord', color: '#111111', kind: 'ZONE' },
    { id: 2, name: 'Paroisse X', color: null, kind: 'PARISH' },
  ];
  const items = buildHostFamilyMapItems(
    [fam(1, { hostingGroupId: 1 }), fam(2, { hostingGroupId: 2 }), fam(3), fam(4, { accommodationType: 'COLLECTIVE', hostingGroupId: 1, maxCapacity: 30 })],
    [],
    L.latLng(45.44, 4.39),
    groups,
  );

  it('rattache chaque lieu a son groupe et detecte le collectif', () => {
    expect(items.map((i) => i.group?.name ?? null)).toEqual(['Nord', 'Paroisse X', null, 'Nord']);
    expect(items.map((i) => i.collective)).toEqual([false, false, false, true]);
  });

  it('filtre par groupe, sans groupe (0) et type', () => {
    const ids = (f: object) => filterHostFamilyMapItems(items, { ...base, ...f }).map((i) => i.family.id);
    expect(ids({ groupIds: [1] })).toEqual([1, 4]);
    expect(ids({ groupIds: [0] })).toEqual([3]);
    expect(ids({ groupIds: [2, 0] })).toEqual([2, 3]);
    expect(ids({ accommodation: 'COLLECTIVE' })).toEqual([4]);
    expect(ids({ accommodation: 'FAMILY', groupIds: [1] })).toEqual([1]);
    expect(ids({})).toEqual([1, 2, 3, 4]);
  });

  it('couleur: configuree, stable par defaut, grise sans groupe', () => {
    expect(groupColor(groups[0])).toBe('#111111');
    expect(groupColor(groups[1])).toBe(groupColor(groups[1]));
    expect(groupColor(null)).toBe(NO_GROUP_COLOR);
  });

  it('marqueur: collectif distinct et coche visible', () => {
    const house = createHouseIcon('AVAILABLE', false, { groupColor: '#111111' }).options.html as string;
    const school = createHouseIcon('AVAILABLE', false, { groupColor: '#111111', collective: true, checked: true }).options.html as string;
    expect(house).toContain('🏠');
    expect(school).toContain('🏫');
    expect(school).toContain('host-family-marker__check');
    expect(house).toContain('border-color:#111111');
  });
});
