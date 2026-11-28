import * as L from 'leaflet';

/** Point de départ des cartes : Saint-Étienne. */
export const SAINT_ETIENNE: [number, number] = [45.439695, 4.387178];

/** Fond de carte OpenStreetMap : URL officielle exigée par la politique des tuiles, attribution visible. */
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

/** Repère de la carte (sans image externe : les icônes par défaut de Leaflet ne sont pas servies par la build). */
export const PIN_ICON = L.divIcon({
  className: '',
  html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#d9363e;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></span>',
  iconSize: [22, 22],
  iconAnchor: [4, 22],
});
