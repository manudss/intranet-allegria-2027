import { ChangeDetectionStrategy, Component, OnChanges, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TuiButton, TuiInput, TuiLabel } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { AddressCandidate, EMPTY_POSITION, MapPosition, MapPositionFieldComponent } from '../../shared/map-position/map-position-field.component';
import { PLACE_KINDS, PLACE_KIND_LABELS, PLACE_TRACK_LABELS, PlaceKind, PlaceListItem, PlacePayload, PlaceTrack } from './places.models';
import { PlacesApiService } from './places.api';

/** Formulaire d'un lieu : identité, type, piste, infos, adresse précise et point exact (composant de position). */
@Component({
  selector: 'app-place-form',
  standalone: true,
  imports: [FormsModule, TuiButton, TuiLabel, TuiTextarea, ...TuiInput, SelectFieldComponent, MapPositionFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './place-form.component.html',
  styleUrls: ['./place-form.component.scss'],
})
export class PlaceFormComponent implements OnInit, OnChanges {
  private readonly api = inject(PlacesApiService);
  private readonly http = inject(HttpClient);

  /** Lieu à modifier ; absent = création. */
  readonly place = input<PlaceListItem | null>(null);
  readonly extra = input<{ description: string | null; practicalInfo: string | null } | null>(null);
  readonly saved = output<PlaceListItem>();
  readonly cancelled = output<void>();

  readonly kindOptions: SelectOption<PlaceKind>[] = PLACE_KINDS.map((k) => ({ value: k, label: PLACE_KIND_LABELS[k] }));
  readonly trackOptions: SelectOption<PlaceTrack>[] = (Object.keys(PLACE_TRACK_LABELS) as PlaceTrack[]).map((t) => ({ value: t, label: PLACE_TRACK_LABELS[t] }));

  readonly name = signal('');
  readonly kind = signal<PlaceKind>('OTHER');
  readonly track = signal<PlaceTrack>('COMMON');
  readonly description = signal('');
  readonly practicalInfo = signal('');
  readonly position = signal<MapPosition>(EMPTY_POSITION);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  private loaded = false;

  readonly valid = computed(() => this.name().trim().length > 0);

  /** Recherche d'adresse faite par le serveur (conditions Nominatim), sur clic uniquement. */
  readonly search = (q: string) => this.http.post<AddressCandidate[]>('/api/places/geocode', { query: q });

  ngOnInit(): void {
    this.load();
  }
  ngOnChanges(): void {
    this.load();
  }

  private load(): void {
    const p = this.place();
    if (!p || this.loaded) return;
    this.loaded = true;
    this.name.set(p.name);
    this.kind.set(p.kind);
    this.track.set(p.track);
    this.position.set({ address: p.address, postalCode: p.postalCode, city: p.city, country: null, latitude: p.latitude, longitude: p.longitude });
    const x = this.extra();
    this.description.set(x?.description ?? '');
    this.practicalInfo.set(x?.practicalInfo ?? '');
  }

  save(): void {
    if (!this.valid() || this.saving()) return;
    const pos = this.position();
    const payload: PlacePayload = {
      name: this.name().trim(),
      kind: this.kind(),
      track: this.track(),
      address: pos.address,
      postalCode: pos.postalCode,
      city: pos.city,
      country: pos.country,
      latitude: pos.latitude,
      longitude: pos.longitude,
      description: this.description().trim() || null,
      practicalInfo: this.practicalInfo().trim() || null,
    };
    this.saving.set(true);
    this.error.set(null);
    const id = this.place()?.id;
    (id ? this.api.update(id, payload) : this.api.create(payload)).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.saved.emit(p);
      },
      error: (e) => {
        this.saving.set(false);
        const m = e?.error?.message;
        this.error.set(Array.isArray(m) ? m.join(', ') : (m ?? 'Enregistrement impossible.'));
      },
    });
  }
}
