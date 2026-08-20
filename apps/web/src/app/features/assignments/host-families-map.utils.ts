import * as L from 'leaflet';
import 'leaflet.markercluster';
import { HostFamily, HostFamilyStatus, ParticipantHostFamilyAssignment } from '../../models/models';

export type Sector = 'Nord' | 'Sud' | 'Est' | 'Ouest' | 'Centre';
export type CapacityState = 'AVAILABLE' | 'FULL' | 'UNDER_USED';

export interface HostFamilyMapItem {
  readonly family: HostFamily;
  readonly assignmentsCount: number;
  readonly under18Count: number;
  readonly animatorsCount: number;
  readonly capacityState: CapacityState;
  readonly sector: Sector;
  readonly distanceKm: number | null;
  readonly capacityRatio: number;
}

export interface HostFamilyMapFilters {
  readonly sectors: readonly Sector[];
  readonly status: HostFamilyStatus | null;
  readonly capacityState: CapacityState | null;
  readonly maxDistanceKm: number | null;
  readonly hasAnimators: boolean | null;
  readonly search: string;
}

/** Point de rassemblement 2027 : Saint-Etienne (45° 26′ 05″ N, 4° 23′ 25″ E). */
export const DEFAULT_GATHERING_POINT = L.latLng(45.439695, 4.387178);

const COLOR_BY_CAPACITY: Record<CapacityState, string> = {
  AVAILABLE: '#16a34a',
  UNDER_USED: '#0891b2',
  FULL: '#dc2626',
};

export function computeCapacityState(assignmentsCount: number, maxCapacity: number): CapacityState {
  if (maxCapacity <= 0) return 'FULL';
  const ratio = assignmentsCount / maxCapacity;
  if (ratio >= 1) return 'FULL';
  if (ratio < 0.4) return 'UNDER_USED';
  return 'AVAILABLE';
}

export function haversineKm(from: L.LatLngExpression, to: L.LatLngExpression): number {
  const fromLatLng = L.latLng(from);
  const toLatLng = L.latLng(to);
  const radiusKm = 6371;
  const dLat = ((toLatLng.lat - fromLatLng.lat) * Math.PI) / 180;
  const dLng = ((toLatLng.lng - fromLatLng.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((fromLatLng.lat * Math.PI) / 180) *
      Math.cos((toLatLng.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function inferSector(family: HostFamily, referencePoint: L.LatLngExpression): Sector {
  if (family.latitude != null && family.longitude != null) {
    const familyLatLng = L.latLng(family.latitude, family.longitude);
    const ref = L.latLng(referencePoint);
    const distance = haversineKm(ref, familyLatLng);
    if (distance < 4) return 'Centre';
    const latDelta = familyLatLng.lat - ref.lat;
    const lngDelta = familyLatLng.lng - ref.lng;
    if (Math.abs(latDelta) >= Math.abs(lngDelta)) return latDelta > 0 ? 'Nord' : 'Sud';
    return lngDelta > 0 ? 'Est' : 'Ouest';
  }
  const normalized = `${family.city} ${family.parish || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (normalized.includes('nord')) return 'Nord';
  if (normalized.includes('sud')) return 'Sud';
  if (normalized.includes('est')) return 'Est';
  if (normalized.includes('ouest')) return 'Ouest';
  return 'Centre';
}

export function buildHostFamilyMapItems(
  families: readonly HostFamily[],
  assignments: readonly ParticipantHostFamilyAssignment[],
  referencePoint: L.LatLngExpression,
): HostFamilyMapItem[] {
  const byFamily = assignments.reduce<Map<number, ParticipantHostFamilyAssignment[]>>((acc, assignment) => {
    const familyId = assignment.hostFamily.id;
    const existing = acc.get(familyId);
    if (existing) {
      existing.push(assignment);
    } else {
      acc.set(familyId, [assignment]);
    }
    return acc;
  }, new Map<number, ParticipantHostFamilyAssignment[]>());

  return families.map((family) => {
    const relatedAssignments = (byFamily.get(family.id) || []).filter(
      (assignment) => assignment.status !== 'CANCELLED',
    );
    const assignmentsCount = relatedAssignments.length;
    const under18Count = relatedAssignments.filter((assignment) => assignment.type === 'JEUNE').length;
    const animatorsCount = relatedAssignments.filter((assignment) => assignment.type === 'ANIMATEUR').length;
    const capacityRatio = family.maxCapacity > 0 ? assignmentsCount / family.maxCapacity : 1;
    return {
      family,
      assignmentsCount,
      under18Count,
      animatorsCount,
      capacityRatio,
      capacityState: computeCapacityState(assignmentsCount, family.maxCapacity),
      sector: inferSector(family, referencePoint),
      distanceKm:
        family.latitude != null && family.longitude != null
          ? haversineKm(referencePoint, [family.latitude, family.longitude])
          : null,
    };
  });
}

export function filterHostFamilyMapItems(
  items: readonly HostFamilyMapItem[],
  filters: HostFamilyMapFilters,
): HostFamilyMapItem[] {
  const search = filters.search
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return items.filter((item) => {
    if (filters.sectors.length && !filters.sectors.includes(item.sector)) return false;
    if (filters.status && item.family.status !== filters.status) return false;
    if (filters.capacityState && item.capacityState !== filters.capacityState) return false;
    if (filters.maxDistanceKm != null) {
      if (item.distanceKm == null || item.distanceKm > filters.maxDistanceKm) return false;
    }
    if (filters.hasAnimators != null && (item.animatorsCount > 0) !== filters.hasAnimators) return false;
    if (!search) return true;
    const haystack = [
      item.family.familyName,
      item.family.city,
      item.family.parish || '',
      ...(item.family.tags || []),
      ...(item.family.constraints || []),
    ]
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return haystack.includes(search);
  });
}

export function createHouseIcon(capacityState: CapacityState, isSelected: boolean): L.DivIcon {
  const tone = COLOR_BY_CAPACITY[capacityState];
  return L.divIcon({
    className: 'host-family-marker',
    html: `<div class="host-family-marker__dot${isSelected ? ' host-family-marker__dot--selected' : ''}" style="background:${tone}"><span aria-hidden="true">🏠</span></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 36],
    popupAnchor: [0, -30],
  });
}

export function createMarkerClusterOptions(): L.MarkerClusterGroupOptions {
  return {
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (cluster: { getChildCount(): number }) => {
      const count = cluster.getChildCount();
      const tone = count >= 25 ? '#dc2626' : count >= 10 ? '#ea580c' : '#16a34a';
      return L.divIcon({
        className: 'host-family-cluster',
        html: `<div class="host-family-cluster__bubble" style="background:${tone}"><strong>${count}</strong></div>`,
        iconSize: [42, 42],
      });
    },
  };
}
