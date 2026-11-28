import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterNextRender, effect, input, model, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import * as L from 'leaflet';
import { TuiButton, TuiInput, TuiLabel } from '@taiga-ui/core';
import { OSM_ATTRIBUTION, OSM_TILE_URL, PIN_ICON, SAINT_ETIENNE } from './map-config';

/** Position d'un objet : adresse (texte) et point exact (GPS). Tout est facultatif. */
export interface MapPosition {
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AddressCandidate {
  label: string;
  latitude: number;
  longitude: number;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
}

export const EMPTY_POSITION: MapPosition = { address: null, postalCode: null, city: null, country: null, latitude: null, longitude: null };

/**
 * Composant générique de positionnement : on saisit l'adresse précise, on lance la recherche
 * (un clic, jamais à la frappe), on choisit un résultat, puis on ajuste le point exact en
 * déplaçant le repère ou en cliquant sur la carte. Sans service de recherche (`search` absent
 * ou en panne), le point se place à la main : la carte reste utilisable seule.
 * Réutilisable par toute page qui doit situer quelque chose (lieux, points de rendez-vous…).
 */
@Component({
  selector: 'app-map-position-field',
  standalone: true,
  imports: [FormsModule, TuiButton, TuiLabel, ...TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-position-field.component.html',
  styleUrls: ['./map-position-field.component.scss'],
})
export class MapPositionFieldComponent implements OnDestroy {
  readonly value = model<MapPosition>(EMPTY_POSITION);
  /** Recherche d'adresse (appelée seulement sur clic). Absente : positionnement manuel seul. */
  readonly search = input<((query: string) => Observable<AddressCandidate[]>) | null>(null);
  readonly disabled = input(false);

  readonly query = signal('');
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly candidates = signal<AddressCandidate[]>([]);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;

  constructor() {
    afterNextRender(() => {
      const v = this.value();
      const has = v.latitude != null && v.longitude != null;
      const map = L.map(this.host().nativeElement, { center: has ? [v.latitude!, v.longitude!] : SAINT_ETIENNE, zoom: has ? 17 : 12 });
      L.tileLayer(OSM_TILE_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (!this.disabled()) this.setPoint(e.latlng.lat, e.latlng.lng);
      });
      this.map = map;
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        this.syncMarker(false);
      });
    });
    effect(() => {
      this.value();
      this.syncMarker(false);
    });
  }

  private syncMarker(pan: boolean): void {
    const map = this.map;
    if (!map) return;
    const v = this.value();
    if (v.latitude == null || v.longitude == null) {
      this.marker?.remove();
      this.marker = null;
      return;
    }
    const ll: L.LatLngTuple = [v.latitude, v.longitude];
    if (!this.marker) {
      this.marker = L.marker(ll, { draggable: !this.disabled(), keyboard: true, alt: 'Point exact du lieu', icon: PIN_ICON }).addTo(map);
      this.marker.on('dragend', () => {
        const p = this.marker!.getLatLng();
        this.setPoint(p.lat, p.lng);
      });
    } else {
      this.marker.setLatLng(ll);
    }
    if (pan) map.setView(ll, Math.max(map.getZoom(), 17));
  }

  private round(n: number): number {
    return Math.round(n * 1e6) / 1e6;
  }

  setPoint(lat: number, lon: number): void {
    this.value.set({ ...this.value(), latitude: this.round(lat), longitude: this.round(lon) });
    this.message.set(null);
  }

  patch(field: 'address' | 'postalCode' | 'city' | 'country', text: string): void {
    this.value.set({ ...this.value(), [field]: text.trim() ? text : null });
  }

  /** Coordonnées saisies à la main (alternative accessible au glisser du repère). */
  setCoordinate(field: 'latitude' | 'longitude', raw: string): void {
    const n = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
    const next = { ...this.value(), [field]: n != null && Number.isFinite(n) ? this.round(n) : null };
    const lat = next.latitude;
    const lon = next.longitude;
    if (lat != null && (lat < -90 || lat > 90)) return;
    if (lon != null && (lon < -180 || lon > 180)) return;
    this.value.set(next);
  }

  find(): void {
    const fn = this.search();
    const q = (this.query().trim() || this.fullAddress()).trim();
    if (!fn || q.length < 6 || this.busy()) {
      this.message.set(q.length < 6 ? 'Saisissez une adresse plus complète.' : null);
      return;
    }
    this.busy.set(true);
    this.message.set(null);
    this.candidates.set([]);
    fn(q).subscribe({
      next: (rows) => {
        this.busy.set(false);
        this.candidates.set(rows);
        if (!rows.length) this.message.set('Aucune adresse trouvée : précisez-la ou placez le point sur la carte.');
      },
      error: () => {
        this.busy.set(false);
        this.message.set('Recherche d\'adresse indisponible : placez le point sur la carte.');
      },
    });
  }

  private fullAddress(): string {
    const v = this.value();
    return [v.address, v.postalCode, v.city, v.country].filter(Boolean).join(' ');
  }

  choose(c: AddressCandidate): void {
    const v = this.value();
    this.value.set({
      address: c.address ?? v.address,
      postalCode: c.postalCode ?? v.postalCode,
      city: c.city ?? v.city,
      country: c.country ?? v.country,
      latitude: this.round(c.latitude),
      longitude: this.round(c.longitude),
    });
    this.candidates.set([]);
    this.syncMarker(true);
  }

  clearPoint(): void {
    this.value.set({ ...this.value(), latitude: null, longitude: null });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }
}
