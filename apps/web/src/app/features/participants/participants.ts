import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  Group,
  MejAgeGroup,
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
  mejAgeGroup: null,
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
          <label for="rechercher-un-participant" tuiLabel>Rechercher un participant</label
          ><input
            tuiInput
            placeholder="Nom, diocèse ou ville…"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            id="rechercher-un-participant"
          />
        </tui-textfield>
        <tui-textfield iconStart="@tui.filter" tuiChevron [stringify]="stringifyGroup">
          <label for="groupe-2" tuiLabel>Groupe</label
          ><select
            tuiSelect
            placeholder="Tous les groupes"
            [items]="groupIds()"
            [formField]="groupFilterForm"
            id="groupe-2"
          ></select>
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
            <dt>Tranche d'âge MEJ</dt>
            <dd>{{ selected()?.mejAgeGroup || '—' }}</dd>
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
              <label for="pathologies-2" tuiLabel>Pathologies</label
              ><textarea
                tuiTextarea
                [formField]="$any(healthForm.medicalConditions)"
                id="pathologies-2"
              ></textarea>
            </tui-textfield>
            <tui-textfield iconStart="@tui.triangle-alert" class="wide">
              <label for="allergies-2" tuiLabel>Allergies</label
              ><textarea
                tuiTextarea
                [formField]="$any(healthForm.allergies)"
                id="allergies-2"
              ></textarea>
            </tui-textfield>
            <tui-textfield iconStart="@tui.pill" class="wide">
              <label for="medicaments-2" tuiLabel>Médicaments</label
              ><textarea
                tuiTextarea
                [formField]="$any(healthForm.medications)"
                id="medicaments-2"
              ></textarea>
            </tui-textfield>
            <tui-textfield iconStart="@tui.star" class="wide">
              <label for="besoins-specifiques" tuiLabel>Besoins spécifiques</label
              ><textarea
                tuiTextarea
                [formField]="$any(healthForm.specialNeeds)"
                id="besoins-specifiques"
              ></textarea>
            </tui-textfield>
            <tui-textfield iconStart="@tui.utensils" class="wide">
              <label for="alimentation-2" tuiLabel>Alimentation</label
              ><textarea
                tuiTextarea
                [formField]="$any(healthForm.dietaryNotes)"
                id="alimentation-2"
              ></textarea>
            </tui-textfield>
            <tui-textfield iconStart="@tui.shield-alert" class="wide">
              <label for="consignes-d-urgence" tuiLabel>Consignes d'urgence</label
              ><textarea
                tuiTextarea
                [formField]="$any(healthForm.emergencyInstructions)"
                id="consignes-d-urgence"
              ></textarea>
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
              <label for="prenom-2" tuiLabel>Prénom</label
              ><input tuiInput [formField]="participantForm.firstName" id="prenom-2" />
            </tui-textfield>
            <tui-textfield iconStart="@tui.user">
              <label for="nom-2" tuiLabel>Nom</label
              ><input tuiInput [formField]="participantForm.lastName" id="nom-2" />
            </tui-textfield>
            <tui-textfield iconStart="@tui.calendar">
              <label for="date-de-naissance" tuiLabel>Date de naissance</label
              ><input
                tuiInput
                type="date"
                [formField]="participantForm.dateOfBirth"
                id="date-de-naissance"
              />
            </tui-textfield>
            <tui-textfield iconStart="@tui.user-round" tuiChevron>
              <label for="sexe-2" tuiLabel>Sexe</label
              ><select
                tuiSelect
                [items]="sexes"
                [formField]="participantForm.sex"
                id="sexe-2"
              ></select>
            </tui-textfield>
            <tui-textfield iconStart="@tui.users" tuiChevron>
              <label for="tranche-d-age-mej" tuiLabel>Tranche d'âge MEJ</label
              ><select
                tuiSelect
                [items]="mejAgeGroups"
                [formField]="participantForm.mejAgeGroup"
                id="tranche-d-age-mej"
              ></select>
            </tui-textfield>
            <tui-textfield iconStart="@tui.users" tuiChevron [stringify]="stringifyGroup">
              <label for="groupe-3" tuiLabel>Groupe</label
              ><select
                tuiSelect
                placeholder="Sans groupe"
                [items]="groupIds()"
                [formField]="participantForm.groupId"
                id="groupe-3"
              ></select>
            </tui-textfield>
            <tui-textfield iconStart="@tui.map-pin">
              <label for="diocese-2" tuiLabel>Diocèse</label
              ><input tuiInput [formField]="participantForm.diocese" id="diocese-2" />
            </tui-textfield>
            <tui-textfield iconStart="@tui.map-pin">
              <label for="ville-2" tuiLabel>Ville</label
              ><input tuiInput [formField]="participantForm.city" id="ville-2" />
            </tui-textfield>
            <tui-textfield iconStart="@tui.shield-alert">
              <label for="contact-urgence" tuiLabel>Contact urgence</label
              ><input
                tuiInput
                [formField]="participantForm.emergencyContactName"
                id="contact-urgence"
              />
            </tui-textfield>
            <tui-textfield iconStart="@tui.phone">
              <label for="telephone-urgence" tuiLabel>Téléphone urgence</label
              ><input
                tuiInput
                [formField]="participantForm.emergencyContactPhone"
                id="telephone-urgence"
              />
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
    {
      key: 'participant',
      label: 'Participant',
      type: 'text',
      value: (x) => `${x.lastName} ${x.firstName}`,
      presentation: { type: 'person', subtitle: (x) => x.city || x.diocese },
    },
    {
      key: 'group',
      label: 'Groupe',
      type: 'list',
      value: (x) => x.group?.name || 'Sans groupe',
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' },
    },
    {
      key: 'diocese',
      label: 'Diocèse',
      type: 'list',
      value: (x) => x.diocese || '—',
      presentation: { type: 'icon', icon: () => '@tui.map-pin' },
    },
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
    required(p.mejAgeGroup);
  });
  healthForm = form(this.healthModel);
  sexes = Object.values(ParticipantSex);
  mejAgeGroups = Object.values(MejAgeGroup);
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
      mejAgeGroup: x.mejAgeGroup,
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
