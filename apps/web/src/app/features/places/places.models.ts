export type PlaceKind = 'GATHERING' | 'SCHOOL' | 'RESTAURATION' | 'PARK' | 'MUSEUM' | 'PARISH' | 'LODGING' | 'OTHER';
export type PlaceTrack = 'TA' | 'ES' | 'COMMON';

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  GATHERING: 'Lieu du rassemblement',
  SCHOOL: 'Lycée / école',
  RESTAURATION: 'Restauration',
  PARK: 'Parc',
  MUSEUM: 'Musée',
  PARISH: 'Paroisse',
  LODGING: 'Hébergement',
  OTHER: 'Autre',
};
export const PLACE_KINDS = Object.keys(PLACE_KIND_LABELS) as PlaceKind[];
export const PLACE_TRACK_LABELS: Record<PlaceTrack, string> = { TA: 'TA', ES: 'ES', COMMON: 'Commun' };

export interface PlaceRoom {
  id: number;
  name: string;
  /** « Lieu · Salle » */
  displayName: string;
}

export interface PlaceListItem {
  id: number;
  name: string;
  kind: PlaceKind;
  track: PlaceTrack;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  rooms: PlaceRoom[];
  /** Présents seulement pour les modules que la personne a le droit de voir. */
  counts?: { events?: number; shifts?: number; groups?: number };
}

export interface PlacePayload {
  name: string;
  kind?: PlaceKind;
  track?: PlaceTrack;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  practicalInfo?: string | null;
  responsibleVolunteerId?: number | null;
  isActive?: boolean;
}

export { OSM_ATTRIBUTION, OSM_TILE_URL, SAINT_ETIENNE } from '../../shared/map-position/map-config';

export interface Relation<T> {
  visible: boolean;
  count?: number;
  items?: T[];
}
export interface PlaceFiche extends PlaceListItem {
  country: string | null;
  description: string | null;
  practicalInfo: string | null;
  /** Absent si la personne n'a pas le droit sur l'annuaire des bénévoles. */
  responsible?: { id: number; name: string } | null;
  relations: {
    events: Relation<{ id: number; title: string; eventDate: string; startTime: string; endTime: string; room: string | null }>;
    missions: Relation<{ id: number; title: string; room: string | null }>;
    shifts: Relation<{ id: number; missionId: number; missionTitle: string; startAt: string; endAt: string; room: string | null }>;
    groups: Relation<{ id: number; name: string; room: string | null }>;
    teams: Relation<{ id: number; name: string; code: string }>;
  };
}
