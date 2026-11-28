import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TuiButton, TuiInput } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';
import { FormsModule } from '@angular/forms';
import { PageLayoutComponent } from '../../shared/ui-components';
import { PlacesApiService } from './places.api';
import { PLACE_KINDS, PLACE_KIND_LABELS, PLACE_TRACK_LABELS, PlaceKind, PlaceListItem } from './places.models';
import { PlacesMapComponent } from './places-map.component';

/** Lieux du rassemblement : cartes + plan de Saint-Étienne (maquette B), filtres par type. */
@Component({
  selector: 'app-places-page',
  standalone: true,
  imports: [RouterLink, PageLayoutComponent, PlacesMapComponent, TuiButton, TuiChip, FormsModule, ...TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './places-page.html',
  styleUrls: ['./places-page.scss'],
})
export class PlacesPageComponent implements OnInit {
  private readonly api = inject(PlacesApiService);
  private readonly router = inject(Router);

  readonly kinds = PLACE_KINDS;
  readonly kindLabel = PLACE_KIND_LABELS;
  readonly trackLabel = PLACE_TRACK_LABELS;
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly places = signal<PlaceListItem[]>([]);
  readonly kindFilter = signal<PlaceKind | null>(null);
  readonly search = signal('');
  readonly selectedId = signal<number | null>(null);
  readonly mobileView = signal<'list' | 'map'>('list');

  readonly shown = computed(() => {
    const kind = this.kindFilter();
    const q = this.search().trim().toLowerCase();
    return this.places().filter(
      (p) =>
        (!kind || p.kind === kind) &&
        (!q || [p.name, p.address, p.city].some((v) => (v ?? '').toLowerCase().includes(q))),
    );
  });
  readonly selected = computed(() => this.places().find((p) => p.id === this.selectedId()) ?? null);
  readonly unlocated = computed(() => this.shown().filter((p) => p.latitude == null).length);

  ngOnInit(): void {
    this.api.list().subscribe({
      next: (rows) => {
        this.places.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  toggleKind(k: PlaceKind): void {
    this.kindFilter.set(this.kindFilter() === k ? null : k);
  }
  select(id: number): void {
    this.selectedId.set(id);
  }
  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('');
  }
  summary(p: PlaceListItem): string {
    const parts: string[] = [];
    if (p.counts?.events != null) parts.push(`${p.counts.events} évén.`);
    if (p.counts?.shifts != null) parts.push(`${p.counts.shifts} créneaux`);
    if (p.counts?.groups != null) parts.push(`${p.counts.groups} groupes`);
    if (p.rooms.length) parts.push(`${p.rooms.length} salles`);
    return parts.join(' · ') || (p.city ?? 'Aucun rattachement');
  }
  open(p: PlaceListItem): void {
    void this.router.navigate(['/lieux', p.id]);
  }
}
