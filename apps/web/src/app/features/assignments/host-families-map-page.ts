import {
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
  OnInit,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LeafletMarkerClusterModule } from '@bluehalo/ngx-leaflet-markercluster';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import * as L from 'leaflet';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, startWith } from 'rxjs';
import { TuiButton, TuiInput, TuiLabel } from '@taiga-ui/core';
import { TuiChip, TuiDataListWrapper, TuiDrawer, TuiSelect } from '@taiga-ui/kit';
import { HostFamily, HostFamilyStatus, ParticipantHostFamilyAssignment } from '../../models/models';
import { AssignmentsApiService, HostFamiliesApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { HostFamilyMapCardsComponent } from './host-family-map-cards';
import {
  CapacityState,
  DEFAULT_GATHERING_POINT,
  HostFamilyMapFilters,
  HostFamilyMapItem,
  Sector,
  buildHostFamilyMapItems,
  createHouseIcon,
  createMarkerClusterOptions,
  filterHostFamilyMapItems,
} from './host-families-map.utils';

@Component({
  selector: 'app-host-families-map-page',
  standalone: true,
  imports: [
    ...SHARED_IMPORTS,
    ReactiveFormsModule,
    RouterLink,
    LeafletModule,
    LeafletMarkerClusterModule,
    TuiButton,
    TuiChip,
    TuiDataListWrapper,
    TuiDrawer,
    TuiLabel,
    TuiSelect,
    ...TuiInput,
    HostFamilyMapCardsComponent,
  ],
  // Suppress the benign ResizeObserver notification error that Leaflet triggers in zoneless Angular
  providers: [
    {
      provide: ErrorHandler,
      useValue: {
        handleError(error: unknown): void {
          if (error instanceof ErrorEvent && error.message?.includes('ResizeObserver')) return;
          if (typeof error === 'string' && error.includes('ResizeObserver')) return;
          console.error(error);
        },
      },
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './host-families-map-page.html',
  styleUrls: ['./host-families-map-page.scss'],
})
export class HostFamiliesMapPageComponent implements OnInit {
  private readonly hostFamiliesApi = inject(HostFamiliesApiService);
  private readonly assignmentsApi = inject(AssignmentsApiService);
  private map: L.Map | null = null;
  private boundsFitted = false;
  private lastMarkers: L.Marker[] = [];
  private readonly markerByFamilyId = new Map<number, L.Marker>();

  readonly sectors: readonly Sector[] = ['Nord', 'Sud', 'Est', 'Ouest', 'Centre'];

  // String labels are used directly as select values so Taiga UI displays them without a stringify function
  readonly statusLabelOptions = ['Tous les statuts', 'Brouillon', 'Validee', 'Inactive'] as const;
  readonly capacityLabelOptions = [
    'Toutes capacites',
    'Disponible',
    'Sous-utilisee',
    'Pleine',
  ] as const;
  readonly animatorLabelOptions = [
    'Avec ou sans animateurs',
    'Avec animateurs',
    'Sans animateurs',
  ] as const;

  private labelToStatus(label: string): HostFamilyStatus | null {
    return (
      (
        { Brouillon: 'DRAFT', Validee: 'VALIDATED', Inactive: 'INACTIVE' } as Record<
          string,
          HostFamilyStatus
        >
      )[label] ?? null
    );
  }
  private labelToCapacity(label: string): CapacityState | null {
    return (
      (
        { Disponible: 'AVAILABLE', 'Sous-utilisee': 'UNDER_USED', Pleine: 'FULL' } as Record<
          string,
          CapacityState
        >
      )[label] ?? null
    );
  }
  private labelToAnimator(label: string): boolean | null {
    if (label === 'Avec animateurs') return true;
    if (label === 'Sans animateurs') return false;
    return null;
  }

  readonly referencePoint = DEFAULT_GATHERING_POINT;
  readonly filters = new FormGroup({
    sectors: new FormControl<Sector[]>([], { nonNullable: true }),
    statusLabel: new FormControl('Tous les statuts', { nonNullable: true }),
    capacityLabel: new FormControl('Toutes capacites', { nonNullable: true }),
    maxDistanceKm: new FormControl<number | null>(null),
    animatorLabel: new FormControl('Avec ou sans animateurs', { nonNullable: true }),
    search: new FormControl('', { nonNullable: true }),
  });
  readonly loading = signal(true);
  readonly mobileCardsOpened = signal(false);
  readonly selectedFamilyId = signal<number | null>(null);
  readonly families = signal<HostFamily[]>([]);
  readonly assignments = signal<ParticipantHostFamilyAssignment[]>([]);
  readonly markerClusterData = signal<L.Marker[]>([]);

  readonly mapOptions: L.MapOptions = {
    center: this.referencePoint,
    zoom: 9,
    layers: [
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }),
    ],
  };
  readonly markerClusterOptions = createMarkerClusterOptions();
  private readonly activeFilters = signal<HostFamilyMapFilters>({
    sectors: [],
    status: null,
    capacityState: null,
    maxDistanceKm: null,
    hasAnimators: null,
    search: '',
  });
  readonly allItems = computed<readonly HostFamilyMapItem[]>(() =>
    buildHostFamilyMapItems(this.families(), this.assignments(), this.referencePoint),
  );
  readonly filteredFamilies = computed<HostFamilyMapItem[]>(() =>
    filterHostFamilyMapItems(this.allItems(), this.activeFilters()),
  );
  readonly sectorSummary = computed(() => {
    const map = new Map<Sector, { families: number; available: number }>();
    for (const item of this.filteredFamilies()) {
      const current = map.get(item.sector) || { families: 0, available: 0 };
      current.families += 1;
      current.available += Math.max(0, item.family.maxCapacity - item.assignmentsCount);
      map.set(item.sector, current);
    }
    return this.sectors
      .map((sector) => ({
        sector,
        families: map.get(sector)?.families || 0,
        available: map.get(sector)?.available || 0,
      }))
      .filter((item) => item.families > 0);
  });

  constructor() {
    this.filters.valueChanges
      .pipe(
        startWith(this.filters.getRawValue()),
        debounceTime(250),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      )
      .subscribe((value) => {
        this.activeFilters.set({
          sectors: value.sectors || [],
          status: this.labelToStatus(value.statusLabel || ''),
          capacityState: this.labelToCapacity(value.capacityLabel || ''),
          maxDistanceKm: value.maxDistanceKm ?? null,
          hasAnimators: this.labelToAnimator(value.animatorLabel || ''),
          search: value.search || '',
        });
      });

    effect(() => {
      const selectedId = this.selectedFamilyId();
      const items = this.filteredFamilies();
      this.rebuildMarkers(items, selectedId);
    });

    // After the first DOM paint, ensure Leaflet has correct container dimensions
    afterNextRender(() => {
      requestAnimationFrame(() => this.map?.invalidateSize({ animate: false }));
    });
  }

  ngOnInit(): void {
    forkJoin({
      families: this.hostFamiliesApi.list(),
      assignments: this.assignmentsApi.list(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe(({ families, assignments }) => {
        this.families.set(families);
        this.assignments.set(assignments);
      });
  }

  isSectorSelected(sector: Sector): boolean {
    return this.filters.controls.sectors.value.includes(sector);
  }

  toggleSector(sector: Sector): void {
    const selected = this.filters.controls.sectors.value;
    this.filters.controls.sectors.setValue(
      selected.includes(sector)
        ? selected.filter((value) => value !== sector)
        : [...selected, sector],
    );
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    // Two nested rAF ensure the browser has completed layout before Leaflet reads container dimensions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        this.fitToMarkers();
      });
    });
  }

  onCardSelected(familyId: number): void {
    this.selectedFamilyId.set(familyId);
    this.panToFamily(familyId, true);
    this.scrollCardIntoView(familyId);
  }

  onMarkerSelected(familyId: number): void {
    this.selectedFamilyId.set(familyId);
    this.scrollCardIntoView(familyId);
  }

  private rebuildMarkers(
    items: readonly HostFamilyMapItem[],
    selectedFamilyId: number | null,
  ): void {
    this.markerByFamilyId.clear();
    const markers = items
      .filter((item) => item.family.latitude != null && item.family.longitude != null)
      .map((item) => {
        const latitude = item.family.latitude;
        const longitude = item.family.longitude;
        if (latitude === null || longitude === null) {
          throw new Error(`Missing coordinates for family #${item.family.id}`);
        }
        const marker = L.marker([latitude, longitude], {
          icon: createHouseIcon(item.capacityState, item.family.id === selectedFamilyId),
        });
        marker.on('click', () => this.onMarkerSelected(item.family.id));
        marker.bindPopup(
          `<strong>${item.family.familyName}</strong><br>${item.family.city}<br>${item.assignmentsCount}/${item.family.maxCapacity} places`,
        );
        this.markerByFamilyId.set(item.family.id, marker);
        return marker;
      });
    this.lastMarkers = markers;
    this.markerClusterData.set(markers);
    if (selectedFamilyId != null) {
      this.panToFamily(selectedFamilyId, false);
    } else {
      this.fitToMarkers(markers);
    }
  }

  /** Adjusts the viewport to the markers once, so families are visible without manual zooming. */
  private fitToMarkers(markers: readonly L.Marker[] = this.lastMarkers): void {
    const map = this.map;
    if (!map || this.boundsFitted || !markers.length) return;

    const container = map.getContainer?.();
    const size = map.getSize?.();
    if (!container || !size || size.x <= 0 || size.y <= 0) return;

    try {
      this.boundsFitted = true;
      map.fitBounds(L.latLngBounds(markers.map((marker) => marker.getLatLng())), {
        padding: [32, 32],
        maxZoom: 12,
        animate: false,
      });
    } catch {
      this.boundsFitted = false;
    }
  }

  private panToFamily(familyId: number, openPopup: boolean): void {
    const map = this.map;
    const marker = this.markerByFamilyId.get(familyId);
    if (!map || !marker) return;
    map.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
    if (openPopup) marker.openPopup();
  }

  private scrollCardIntoView(familyId: number): void {
    const card = document.getElementById(`family-card-${familyId}`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
