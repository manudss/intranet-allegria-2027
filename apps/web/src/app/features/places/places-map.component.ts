import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterNextRender, effect, inject, input, output, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { OSM_ATTRIBUTION, OSM_TILE_URL, PlaceListItem, SAINT_ETIENNE } from './places.models';

/** Carte des lieux (liste B) : un repère par lieu localisé, clic = sélection. Les lieux sans point GPS n'y figurent pas. */
@Component({
  selector: 'app-places-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="places-map" role="application" aria-label="Carte des lieux"></div>`,
  styles: [
    `
      :host { display: block; }
      .places-map { height: 100%; min-height: 16rem; border-radius: 0.8rem; border: 1px solid var(--tui-border-normal); z-index: 0; }
    `,
  ],
})
export class PlacesMapComponent implements OnDestroy {
  readonly places = input.required<PlaceListItem[]>();
  readonly selectedId = input<number | null>(null);
  readonly selected = output<number>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private map: L.Map | null = null;
  private layer = L.layerGroup();
  private markers = new Map<number, L.CircleMarker>();
  private fitted = false;
  private readonly el = inject(ElementRef);

  constructor() {
    afterNextRender(() => {
      const map = L.map(this.host().nativeElement, { center: SAINT_ETIENNE, zoom: 12 });
      L.tileLayer(OSM_TILE_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
      this.layer.addTo(map);
      this.map = map;
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        this.redraw();
      });
    });
    effect(() => {
      this.places();
      this.selectedId();
      this.redraw();
    });
  }

  private redraw(): void {
    if (!this.map) return;
    this.layer.clearLayers();
    this.markers.clear();
    const selected = this.selectedId();
    const points: L.LatLngTuple[] = [];
    for (const p of this.places()) {
      if (p.latitude == null || p.longitude == null) continue;
      const pt: L.LatLngTuple = [p.latitude, p.longitude];
      points.push(pt);
      const on = p.id === selected;
      const m = L.circleMarker(pt, {
        radius: on ? 11 : 8,
        color: '#fff',
        weight: 2,
        fillColor: on ? '#1c3a6e' : '#d9363e',
        fillOpacity: 1,
      });
      m.bindTooltip(p.name);
      m.on('click', () => this.selected.emit(p.id));
      m.addTo(this.layer);
      this.markers.set(p.id, m);
    }
    if (!this.fitted && points.length) {
      this.map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
      this.fitted = true;
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
    void this.el;
  }
}
