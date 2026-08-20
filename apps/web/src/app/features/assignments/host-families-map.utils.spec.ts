import * as L from 'leaflet';
import { describe, expect, it } from 'vitest';
import { HostFamily } from '../../models/models';
import {
  buildHostFamilyMapItems,
  computeCapacityState,
  createMarkerClusterOptions,
  filterHostFamilyMapItems,
} from './host-families-map.utils';

describe('host-families-map.utils', () => {
  it('calcule correctement les etats de capacite', () => {
    expect(computeCapacityState(0, 10)).toBe('UNDER_USED');
    expect(computeCapacityState(5, 10)).toBe('AVAILABLE');
    expect(computeCapacityState(10, 10)).toBe('FULL');
  });

  it('filtre les familles selon secteur et distance', () => {
    const families: HostFamily[] = [
      {
        id: 1,
        familyName: 'Nord',
        address: '',
        postalCode: '69001',
        city: 'Lyon',
        phone: null,
        email: null,
        maxCapacity: 4,
        maxUnder18: 2,
        parish: null,
        notes: null,
        latitude: 45.8,
        longitude: 4.84,
        maxAnimators: null,
        constraints: null,
        tags: null,
        status: 'VALIDATED',
      },
      {
        id: 2,
        familyName: 'Sud',
        address: '',
        postalCode: '69002',
        city: 'Lyon',
        phone: null,
        email: null,
        maxCapacity: 4,
        maxUnder18: 2,
        parish: null,
        notes: null,
        latitude: 45.6,
        longitude: 4.84,
        maxAnimators: null,
        constraints: null,
        tags: null,
        status: 'VALIDATED',
      },
    ];
    const items = buildHostFamilyMapItems(families, [], L.latLng(45.764, 4.8357));
    const filtered = filterHostFamilyMapItems(items, {
      sectors: ['Nord'],
      status: null,
      capacityState: null,
      maxDistanceKm: 10,
      hasAnimators: null,
      search: '',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].family.id).toBe(1);
  });

  it('fournit des options marker cluster avec iconCreateFunction', () => {
    const options = createMarkerClusterOptions();
    expect(options.iconCreateFunction).toBeTypeOf('function');
  });
});
