import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  Group,
  Participant,
  ParticipantHealth,
  ParticipantHealthPayload,
  ParticipantPayload,
  ParticipantSex,
} from '../../models/models';
import {
  GroupsApiService,
  HealthApiService,
  ParticipantsApiService,
} from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';
const blank = (): ParticipantPayload => ({
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  sex: ParticipantSex.UNDISCLOSED,
  emergencyContactName: '',
  emergencyContactPhone: '',
  diocese: '',
  city: '',
  groupId: null,
});
const blankHealth = (): ParticipantHealthPayload => ({
  medicalConditions: '',
  allergies: '',
  medications: '',
  specialNeeds: '',
  dietaryNotes: '',
  emergencyInstructions: '',
});
@Component({
  selector: 'app-participants',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `<app-page-layout
      title="Participants"
      description="Inscriptions, groupes et informations individuelles"
      ><button actions tuiButton (click)="create()">Nouveau participant</button>
      <div class="filters">
        <tui-textfield iconStart="@tui.search">
          <label tuiLabel>Rechercher un participant</label>
          <input tuiInput placeholder="Nom, diocèse ou ville…" [value]="query()" (input)="query.set($any($event.target).value)" />
        </tui-textfield>
        <tui-textfield iconStart="@tui.filter" tuiChevron [stringify]="stringifyGroup">
          <label tuiLabel>Groupe</label>
          <select tuiSelect placeholder="Tous les groupes" [items]="groupIds()" [formField]="groupFilterForm"></select>
        </tui-textfield>
      </div>
      @if (loading()) {
        <tui-loader />
      } @else {
        <app-data-table [rows]="filtered()" [columns]="tableColumns" (rowSelected)="open($event)" />
      }
    </app-page-layout>
    @if (opened()) {
      <tui-drawer direction="end"
        ><header>
          <h2>
            {{
              mode() === 'create'
                ? 'Nouveau participant'
                : selected()?.firstName + ' ' + selected()?.lastName
            }}
          </h2>
        </header>
        @if (mode() === 'detail') {
          <dl>
            <dt>Naissance</dt>
            <dd>{{ selected()?.dateOfBirth | date }}</dd>
            <dt>Sexe</dt>
            <dd>{{ selected()?.sex }}</dd>
            <dt>Groupe</dt>
            <dd>{{ selected()?.group?.name || '—' }}</dd>
            <dt>Ville</dt>
            <dd>{{ selected()?.city || '—' }}</dd>
            <dt>Contact urgence</dt>
            <dd>
              {{ selected()?.emergencyContactName || '—' }} ·
              {{ selected()?.emergencyContactPhone || '—' }}
            </dd>
          </dl>
         } @else if (mode() === 'health') {
           <form class="drawer-form">
             <tui-textfield iconStart="@tui.heart-pulse" class="wide">
               <label tuiLabel>Pathologies</label>
               <textarea tuiTextarea [formField]="$any(healthForm.medicalConditions)"></textarea>
             </tui-textfield>
             <tui-textfield iconStart="@tui.triangle-alert" class="wide">
               <label tuiLabel>Allergies</label>
               <textarea tuiTextarea [formField]="$any(healthForm.allergies)"></textarea>
             </tui-textfield>
             <tui-textfield iconStart="@tui.pill" class="wide">
               <label tuiLabel>Médicaments</label>
               <textarea tuiTextarea [formField]="$any(healthForm.medications)"></textarea>
             </tui-textfield>
             <tui-textfield iconStart="@tui.star" class="wide">
               <label tuiLabel>Besoins spécifiques</label>
               <textarea tuiTextarea [formField]="$any(healthForm.specialNeeds)"></textarea>
             </tui-textfield>
             <tui-textfield iconStart="@tui.utensils" class="wide">
               <label tuiLabel>Alimentation</label>
               <textarea tuiTextarea [formField]="$any(healthForm.dietaryNotes)"></textarea>
             </tui-textfield>
             <tui-textfield iconStart="@tui.shield-alert" class="wide">
               <label tuiLabel>Consignes d'urgence</label>
               <textarea tuiTextarea [formField]="$any(healthForm.emergencyInstructions)"></textarea>
             </tui-textfield>
           </form>
           @if (health()) {
             <p>
               Dernière modification : {{ health()?.lastUpdatedAt | date: 'short' }} par
               {{ health()?.lastUpdatedBy?.email || 'inconnu' }}
             </p>
           }
         } @else {
           <form class="drawer-form">
             <tui-textfield iconStart="@tui.user">
               <label tuiLabel>Prénom</label>
               <input tuiInput [formField]="participantForm.firstName" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.user">
               <label tuiLabel>Nom</label>
               <input tuiInput [formField]="participantForm.lastName" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.calendar">
               <label tuiLabel>Date de naissance</label>
               <input tuiInput type="date" [formField]="participantForm.dateOfBirth" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.user-round" tuiChevron>
               <label tuiLabel>Sexe</label>
               <select tuiSelect [items]="sexes" [formField]="participantForm.sex"></select>
             </tui-textfield>
             <tui-textfield iconStart="@tui.users" tuiChevron [stringify]="stringifyGroup">
               <label tuiLabel>Groupe</label>
               <select tuiSelect placeholder="Sans groupe" [items]="groupIds()" [formField]="participantForm.groupId"></select>
             </tui-textfield>
             <tui-textfield iconStart="@tui.map-pin">
               <label tuiLabel>Diocèse</label>
               <input tuiInput [formField]="participantForm.diocese" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.map-pin">
               <label tuiLabel>Ville</label>
               <input tuiInput [formField]="participantForm.city" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.shield-alert">
               <label tuiLabel>Contact urgence</label>
               <input tuiInput [formField]="participantForm.emergencyContactName" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.phone">
               <label tuiLabel>Téléphone urgence</label>
               <input tuiInput [formField]="participantForm.emergencyContactPhone" />
             </tui-textfield>
           </form>
         }
        <footer>
          <button tuiButton appearance="flat" (click)="opened.set(false)">Fermer</button>
          @if (mode() === 'detail') {
            @if (canSeeHealth()) {
              <button tuiButton appearance="secondary" (click)="openHealth()">Santé</button>
            }
            <button tuiButton (click)="edit()">Modifier</button
            ><button tuiButton appearance="secondary-destructive" (click)="remove()">
              Supprimer
            </button>
          } @else {
            <button tuiButton (click)="save()">Enregistrer</button>
          }
        </footer></tui-drawer
      >
    }`,
  styleUrls: ['../../shared/crud.scss', './participants.scss'],
})
export class ParticipantsPage implements OnInit {
  protected readonly tableColumns: readonly DataTableColumn<Participant>[] = [
    { key: 'participant', label: 'Participant', type: 'text', value: (x) => `${x.lastName} ${x.firstName}` },
    { key: 'group', label: 'Groupe', type: 'list', value: (x) => x.group?.name || 'Sans groupe' },
    { key: 'diocese', label: 'Diocèse', type: 'list', value: (x) => x.diocese || '—' },
  ];
  private api = inject(ParticipantsApiService);
  private groupsApi = inject(GroupsApiService);
  private healthApi = inject(HealthApiService);
  private auth = inject(AuthService);
  items = signal<Participant[]>([]);
  groups = signal<Group[]>([]);
  groupIds = computed(() => this.groups().map(({ id }) => id));
  stringifyGroup = (id: number) => this.groups().find((group) => group.id === id)?.name ?? '';
  query = signal('');
  groupFilter = signal<number | null>(null);
  groupFilterForm = form(this.groupFilter);
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit' | 'health'>('detail');
  selected = signal<Participant | null>(null);
  health = signal<ParticipantHealth | null>(null);
  model = signal<ParticipantPayload>(blank());
  healthModel = signal<ParticipantHealthPayload>(blankHealth());
  participantForm = form(this.model, (p) => {
    required(p.firstName);
    required(p.lastName);
    required(p.dateOfBirth);
    required(p.sex);
  });
  healthForm = form(this.healthModel);
  sexes = Object.values(ParticipantSex);
  readonly canSeeHealth = computed(() => this.auth.hasAnyRole(['ADMIN', 'HEALTH']));
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    const gid = this.groupFilter();
    return this.items().filter(
      (x) =>
        (!gid || x.group?.id === gid) &&
        `${x.firstName} ${x.lastName} ${x.diocese ?? ''} ${x.city ?? ''}`.toLowerCase().includes(q),
    );
  });
  ngOnInit() {
    forkJoin({ items: this.api.getParticipants(), groups: this.groupsApi.list() }).subscribe(
      (x) => {
        this.items.set(x.items);
        this.groups.set(x.groups);
        this.loading.set(false);
      },
    );
  }
  setGroupFilter(v: string) {
    this.groupFilter.set(v ? Number(v) : null);
  }
  open(x: Participant) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
  }
  create() {
    this.model.set(blank());
    this.mode.set('create');
    this.opened.set(true);
  }
  edit() {
    const x = this.requireSelectedParticipant();
    this.model.set({
      firstName: x.firstName,
      lastName: x.lastName,
      dateOfBirth: x.dateOfBirth,
      sex: x.sex,
      emergencyContactName: x.emergencyContactName ?? '',
      emergencyContactPhone: x.emergencyContactPhone ?? '',
      diocese: x.diocese ?? '',
      city: x.city ?? '',
      groupId: x.group?.id ?? null,
    });
    this.mode.set('edit');
  }
  openHealth() {
    this.healthApi.getParticipantHealth(this.requireSelectedParticipant().id).subscribe((x) => {
      this.health.set(x);
      this.healthModel.set(
        x
          ? {
              medicalConditions: x.medicalConditions ?? '',
              allergies: x.allergies ?? '',
              medications: x.medications ?? '',
              specialNeeds: x.specialNeeds ?? '',
              dietaryNotes: x.dietaryNotes ?? '',
              emergencyInstructions: x.emergencyInstructions ?? '',
            }
          : blankHealth(),
      );
      this.mode.set('health');
    });
  }
  save() {
    if (this.mode() === 'health') {
      submit(this.healthForm, async () => {
        this.healthApi
          .updateParticipantHealth(this.requireSelectedParticipant().id, this.healthModel())
          .subscribe((x) => {
            this.health.set(x);
            this.mode.set('detail');
          });
      });
      return;
    }
    submit(this.participantForm, async () => {
      const req =
        this.mode() === 'create'
          ? this.api.createParticipant(this.model())
          : this.api.updateParticipant(this.requireSelectedParticipant().id, this.model());
      req.subscribe((x) => {
        this.items.update((a) =>
          this.mode() === 'create' ? [...a, x] : a.map((i) => (i.id === x.id ? x : i)),
        );
        this.open(x);
      });
    });
  }
  remove() {
    const x = this.requireSelectedParticipant();
    if (confirm(`Supprimer ${x.firstName} ${x.lastName} ?`))
      this.api.deleteParticipant(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
  private requireSelectedParticipant(): Participant {
    const participant = this.selected();
    if (!participant) {
      throw new Error('No participant selected');
    }
    return participant;
  }
}
