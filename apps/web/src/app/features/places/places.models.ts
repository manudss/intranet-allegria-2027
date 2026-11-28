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

/** Point de départ de la carte : Saint-Étienne. */
export const SAINT_ETIENNE: [number, number] = [45.439695, 4.387178];

/** Fond de carte OpenStreetMap : URL officielle exigée par la politique des tuiles, attribution visible. */
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
