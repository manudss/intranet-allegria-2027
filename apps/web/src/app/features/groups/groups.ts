import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { finalize, forkJoin } from 'rxjs';
import { Group, GroupPayload, Participant, Team } from '../../models/models';
import { GroupsApiService } from '../../services/api.services';
import { ALLEGRIA_2027_EVENT_DATES } from '../../shared/event-date-selector/event-date.config';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';

function formatDateTime(datetimeStr: string | null): string {
  if (!datetimeStr) return '—';
  const date = new Date(datetimeStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const emptyGroup = (): GroupPayload => ({
  name: '',
  diocese: '',
  arrivalDatetime: '',
  departureDatetime: '',
  notes: '',
});
@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './groups.html',
  styleUrl: '../../shared/crud.scss',
})
export class GroupsPage implements OnInit {
  protected readonly eventDateConfig = ALLEGRIA_2027_EVENT_DATES;
  protected readonly tableColumns: readonly DataTableColumn<Group>[] = [
    {
      key: 'name',
      label: 'Groupe',
      type: 'text',
      value: (x) => x.name,
      presentation: { type: 'icon', icon: () => '@tui.users' },
      size: 'large',
    },
    {
      key: 'diocese',
      label: 'Diocèse',
      type: 'list',
      value: (x) => x.diocese || '—',
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.map-pin' },
      size: 'medium',
    },
    {
      key: 'arrival',
      label: 'Arrivée',
      type: 'date',
      value: (x) => formatDateTime(x.arrivalDatetime),
      filterValue: (x) => x.arrivalDatetime,
      hidden: true,
      presentation: { type: 'date' },
      size: 'large',
    },
    {
      key: 'departure',
      label: 'Départ',
      type: 'date',
      value: (x) => formatDateTime(x.departureDatetime),
      filterValue: (x) => x.departureDatetime,
      hidden: true,
      presentation: { type: 'date' },
      size: 'large',
    },
    {
      key: 'notes',
      label: 'Notes',
      type: 'text',
      value: (x) => x.notes || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.note' },
      size: 'xlarge',
    },
  ];
  private readonly api = inject(GroupsApiService);
  readonly items = signal<Group[]>([]);
  readonly query = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly drawerOpen = signal(false);
  readonly mode = signal<'detail' | 'create' | 'edit'>('detail');
  readonly selected = signal<Group | null>(null);
  readonly participants = signal<Participant[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly model = signal<GroupPayload>(emptyGroup());
  readonly groupForm = form(this.model, (p) => required(p.name));
  readonly filtered = computed(() => {
    const q = this.query().toLowerCase();
    return this.items().filter((x) => `${x.name} ${x.diocese ?? ''}`.toLowerCase().includes(q));
  });
  ngOnInit() {
    this.reload();
  }
  reload() {
    this.loading.set(true);
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (x) => this.items.set(x),
        error: () => this.error.set('Impossible de charger les groupes'),
      });
  }
  open(x: Group) {
    this.selected.set(x);
    this.mode.set('detail');
    this.drawerOpen.set(true);
    forkJoin({
      participants: this.api.getParticipants(x.id),
      teams: this.api.getTeams(x.id),
    }).subscribe((v) => {
      this.participants.set(v.participants);
      this.teams.set(v.teams);
    });
  }
  create() {
    this.model.set(emptyGroup());
    this.selected.set(null);
    this.mode.set('create');
    this.drawerOpen.set(true);
  }
  edit() {
    const x = this.selected();
    if (x) {
      this.model.set({
        name: x.name,
        diocese: x.diocese ?? '',
        arrivalDatetime: x.arrivalDatetime ?? '',
        departureDatetime: x.departureDatetime ?? '',
        notes: x.notes ?? '',
      });
      this.mode.set('edit');
    }
  }
  close() {
    this.drawerOpen.set(false);
  }
  save(event?: Event) {
    event?.preventDefault();
    submit(this.groupForm, async () => {
      this.saving.set(true);
      const req =
        this.mode() === 'create'
          ? this.api.create(this.model())
          : this.api.update(this.requireSelectedGroup().id, this.model());
      req.pipe(finalize(() => this.saving.set(false))).subscribe((x) => {
        this.items.update((all) =>
          this.mode() === 'create' ? [...all, x] : all.map((i) => (i.id === x.id ? x : i)),
        );
        this.open(x);
      });
    });
  }
  remove() {
    const x = this.selected();
    if (x && confirm(`Supprimer ${x.name} ?`))
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.close();
      });
  }
  private requireSelectedGroup(): Group {
    const group = this.selected();
    if (!group) {
      throw new Error('No group selected');
    }
    return group;
  }
}
