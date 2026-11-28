import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiInput, TuiLabel } from '@taiga-ui/core';
import { TuiTabs } from '@taiga-ui/kit';
import { PageLayoutComponent } from '../../shared/ui-components';
import { PersonPickerComponent, PersonSummary } from '../../shared/person-picker.component';
import { PlacesApiService } from './places.api';
import { PLACE_KIND_LABELS, PLACE_TRACK_LABELS, PlaceFiche } from './places.models';
import { PlaceFormComponent } from './place-form.component';
import { PlacesMapComponent } from './places-map.component';

type TeamOption = { id: number; name: string };
type Tab = 'infos' | 'events' | 'shifts' | 'groups' | 'teams' | 'rooms';

/** Fiche lieu en pleine page (maquette A) : infos, carte, et un onglet par relation visible selon les droits. */
@Component({
  selector: 'app-place-fiche-page',
  standalone: true,
  imports: [RouterLink, FormsModule, PageLayoutComponent, PlaceFormComponent, PlacesMapComponent, PersonPickerComponent, TuiButton, TuiTabs, TuiLabel, ...TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './place-fiche-page.html',
  styleUrls: ['./place-fiche-page.scss'],
})
export class PlaceFichePageComponent implements OnInit {
  private readonly api = inject(PlacesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  readonly kindLabel = PLACE_KIND_LABELS;
  readonly trackLabel = PLACE_TRACK_LABELS;
  readonly fiche = signal<PlaceFiche | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly editing = signal(false);
  readonly tab = signal<Tab>('infos');
  readonly feedback = signal<{ text: string; error: boolean } | null>(null);
  readonly newRoom = signal('');
  readonly teamOptions = signal<TeamOption[] | null>(null);
  readonly teamIds = signal<number[]>([]);
  readonly editingTeams = signal(false);
  readonly renaming = signal<{ id: number; name: string } | null>(null);

  /** Onglets : une relation n'a d'onglet que si la personne a le droit sur son module (le compteur suit le même droit). */
  readonly tabs = computed<{ key: Tab; label: string }[]>(() => {
    const f = this.fiche();
    if (!f) return [];
    const r = f.relations;
    const out: { key: Tab; label: string }[] = [{ key: 'infos', label: 'Infos' }];
    if (r.events.visible) out.push({ key: 'events', label: `Événements ${r.events.count}` });
    if (r.shifts.visible) out.push({ key: 'shifts', label: `Créneaux bénévoles ${r.shifts.count}` });
    if (r.groups.visible) out.push({ key: 'groups', label: `Groupes ${r.groups.count}` });
    if (r.teams.visible) out.push({ key: 'teams', label: `Équipes ${r.teams.count}` });
    out.push({ key: 'rooms', label: `Salles ${f.rooms.length}` });
    return out;
  });
  readonly tabIndex = computed(() => Math.max(0, this.tabs().findIndex((t) => t.key === this.tab())));
  readonly hiddenSome = computed(() => {
    const r = this.fiche()?.relations;
    return !!r && (!r.events.visible || !r.shifts.visible || !r.groups.visible || !r.teams.visible);
  });
  readonly mapPlaces = computed(() => (this.fiche() ? [this.fiche()!] : []));
  readonly itinerary = computed(() => {
    const f = this.fiche();
    if (!f || f.latitude == null || f.longitude == null) return null;
    return `https://www.openstreetmap.org/?mlat=${f.latitude}&mlon=${f.longitude}#map=18/${f.latitude}/${f.longitude}`;
  });
  readonly fullAddress = computed(() => {
    const f = this.fiche();
    return f ? [f.address, [f.postalCode, f.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.fiche(id).subscribe({
      next: (f) => {
        this.fiche.set(f);
        this.teamIds.set(f.relations.teams.items?.map((t) => t.id) ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.status === 404 ? 'Lieu introuvable.' : 'Fiche indisponible (droits ou réseau).');
      },
    });
  }

  selectTab(i: number): void {
    const t = this.tabs()[i];
    if (t) this.tab.set(t.key);
  }

  onSaved(): void {
    this.editing.set(false);
    this.reload();
    this.say('Lieu enregistré.');
  }

  private say(text: string, error = false): void {
    this.feedback.set({ text, error });
  }
  private fail(e: { error?: { message?: string | string[] } }): void {
    const m = e?.error?.message;
    this.say(Array.isArray(m) ? m.join(', ') : (m ?? 'Action impossible.'), true);
  }

  setResponsible(p: PersonSummary | null): void {
    const f = this.fiche();
    if (!f) return;
    this.api.update(f.id, { responsibleVolunteerId: p?.id ?? null }).subscribe({ next: () => { this.reload(); this.say('Responsable enregistré.'); }, error: (e) => this.fail(e) });
  }

  addRoom(): void {
    const f = this.fiche();
    const name = this.newRoom().trim();
    if (!f || !name) return;
    this.api.addRoom(f.id, name).subscribe({ next: () => { this.newRoom.set(''); this.reload(); this.say('Salle ajoutée.'); }, error: (e) => this.fail(e) });
  }
  saveRename(): void {
    const f = this.fiche();
    const r = this.renaming();
    if (!f || !r || !r.name.trim()) return;
    this.api.renameRoom(f.id, r.id, r.name.trim()).subscribe({ next: () => { this.renaming.set(null); this.reload(); this.say('Salle renommée.'); }, error: (e) => this.fail(e) });
  }
  removeRoom(id: number): void {
    const f = this.fiche();
    if (!f) return;
    this.api.removeRoom(f.id, id).subscribe({ next: () => { this.reload(); this.say('Salle supprimée.'); }, error: (e) => this.fail(e) });
  }

  startTeams(): void {
    this.editingTeams.set(true);
    if (this.teamOptions() === null) {
      this.http.get<TeamOption[]>('/api/volunteer-teams').subscribe({ next: (t) => this.teamOptions.set(t), error: () => { this.teamOptions.set([]); this.say('Liste des équipes indisponible (droits).', true); } });
    }
  }
  toggleTeam(id: number): void {
    const cur = this.teamIds();
    this.teamIds.set(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }
  saveTeams(): void {
    const f = this.fiche();
    if (!f) return;
    this.api.setTeams(f.id, this.teamIds()).subscribe({ next: () => { this.editingTeams.set(false); this.reload(); this.say('Équipes du lieu enregistrées.'); }, error: (e) => this.fail(e) });
  }

  copyAddress(): void {
    void navigator.clipboard?.writeText(this.fullAddress());
    this.say('Adresse copiée.');
  }
  back(): void {
    void this.router.navigate(['/lieux']);
  }
}
