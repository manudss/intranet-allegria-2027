import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { finalize, forkJoin } from 'rxjs';
import { Group, GroupPayload, Participant, Team } from '../../models/models';
import { GroupsApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';

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
  template: `<app-page-layout
      title="Rassemblement"
      description="Groupes diocésains, arrivées et départs"
      ><button actions tuiButton appearance="primary" (click)="create()">Nouveau groupe</button>
      <tui-textfield iconStart="@tui.search">
        <label for="rechercher-un-groupe" tuiLabel>Rechercher un groupe</label><input tuiInput placeholder="Nom ou diocèse…" [value]="query()" (input)="query.set($any($event.target).value)" id="rechercher-un-groupe" />
      </tui-textfield>
      @if (loading()) {
        <tui-loader />
      } @else {
        <app-data-table [rows]="filtered()" [columns]="tableColumns" (rowSelected)="open($event)" />
      }
      @if (error()) {
        <p class="api-error">{{ error() }}</p>
      }
    </app-page-layout>
    @if (drawerOpen()) {
      <tui-drawer direction="end" [overlay]="true"
        ><header>
          <h2>{{ mode() === 'create' ? 'Nouveau groupe' : selected()?.name }}</h2>
        </header>
        @if (mode() === 'detail') {
          <dl>
            <dt>Diocèse</dt>
            <dd>{{ selected()?.diocese || '—' }}</dd>
            <dt>Participants</dt>
            <dd>{{ participants().length }}</dd>
            <dt>Équipes</dt>
            <dd>{{ teams().length }}</dd>
            <dt>Notes</dt>
            <dd>{{ selected()?.notes || '—' }}</dd>
          </dl>
         } @else {
           <form class="drawer-form" (submit)="save($event)">
             <tui-textfield iconStart="@tui.users">
               <label for="nom-du-groupe" tuiLabel>Nom du groupe</label><input tuiInput [formField]="groupForm.name" id="nom-du-groupe" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.map-pin">
               <label for="diocese-2" tuiLabel>Diocèse</label><input tuiInput [formField]="groupForm.diocese" id="diocese-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.calendar">
               <label for="arrivee-2" tuiLabel>Arrivée</label><input tuiInput type="datetime-local" [formField]="groupForm.arrivalDatetime" id="arrivee-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.calendar">
               <label for="depart-2" tuiLabel>Départ</label><input tuiInput type="datetime-local" [formField]="groupForm.departureDatetime" id="depart-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.file-text" class="wide">
               <label for="notes-2" tuiLabel>Notes</label><textarea tuiTextarea [formField]="$any(groupForm.notes)" id="notes-2"></textarea>
             </tui-textfield>
           </form>
         }
        <footer>
          <button tuiButton appearance="flat" (click)="close()">Fermer</button>
          @if (mode() === 'detail') {
            <button tuiButton (click)="edit()">Modifier</button
            ><button tuiButton appearance="secondary-destructive" (click)="remove()">
              Supprimer
            </button>
          } @else {
            <button tuiButton appearance="primary" [disabled]="saving()" (click)="save()">
              Enregistrer
            </button>
          }
        </footer></tui-drawer
      >
    }`,
  styleUrl: '../../shared/crud.scss',
})
export class GroupsPage implements OnInit {
  protected readonly tableColumns: readonly DataTableColumn<Group>[] = [
    { key: 'name', label: 'Nom', type: 'text', value: (x) => x.name, presentation: { type: 'icon', icon: () => '@tui.users' } },
    { key: 'diocese', label: 'Diocèse', type: 'list', value: (x) => x.diocese || '—', presentation: { type: 'chip', autoColor: true, icon: () => '@tui.map-pin' } },
    { key: 'arrival', label: 'Arrivée', type: 'date', value: (x) => x.arrivalDatetime ? new Date(x.arrivalDatetime).toLocaleString('fr-FR') : '—', filterValue: (x) => x.arrivalDatetime, presentation: { type: 'date' } },
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
