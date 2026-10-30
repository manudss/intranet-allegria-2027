import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiCheckbox, TuiInput } from '@taiga-ui/core';
import {
  TuiBadge,
  TuiChevron,
  TuiChip,
  TuiDataListWrapper,
  TuiDrawer,
  TuiSelect,
  TuiTabs,
} from '@taiga-ui/kit';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, startWith, switchMap } from 'rxjs';
import {
  AssignmentPayload,
  AssignmentStatus,
  HostFamily,
  HostFamilyStatus,
  Participant,
  ParticipantHostFamilyAssignment,
  PersonType,
} from '../../models/models';
import {
  AssignmentsApiService,
  HostFamiliesApiService,
  ParticipantsApiService,
} from '../../services/api.services';
import { DataTableColumn } from '../../shared/data-table';
import { ALLEGRIA_2027_EVENT_DATES } from '../../shared/event-date-selector/event-date.config';
import { EventDateSelectorComponent } from '../../shared/event-date-selector/event-date-selector.component';
import { GroupBulkBarComponent } from '../../shared/group-bulk-bar.component';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { HostingPlacementApiService } from '../hosting-placement/hosting-placement.api';
import { HostingGroupSummary } from '../hosting-placement/hosting-placement.models';

const STATUS_LABELS: Record<HostFamilyStatus, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validée',
  INACTIVE: 'Inactive',
};

const STATUS_APPEARANCE: Record<HostFamilyStatus, string> = {
  DRAFT: 'neutral',
  VALIDATED: 'success',
  INACTIVE: 'danger',
};

const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  [AssignmentStatus.PENDING]: 'En attente',
  [AssignmentStatus.CONFIRMED]: 'Confirmé',
  [AssignmentStatus.CANCELLED]: 'Annulé',
};

const ASSIGNMENT_STATUS_APPEARANCE: Record<AssignmentStatus, string> = {
  [AssignmentStatus.PENDING]: 'warning',
  [AssignmentStatus.CONFIRMED]: 'success',
  [AssignmentStatus.CANCELLED]: 'danger',
};

const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  JEUNE: 'Jeune',
  ANIMATEUR: 'Animateur',
  BENEVOLE: 'Bénévole',
};

const PERSON_TYPE_APPEARANCE: Record<PersonType, string> = {
  JEUNE: 'info',
  ANIMATEUR: 'primary',
  BENEVOLE: 'success',
};

@Component({
  selector: 'app-host-family-cards',
  imports: [TuiChip, TuiBadge, TuiCheckbox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="cards">
    @for (family of families(); track family.id) {
      <div class="card-wrap">
        <input
          tuiCheckbox
          type="checkbox"
          size="s"
          class="card-check"
          [attr.aria-label]="'Sélectionner ' + family.familyName"
          [attr.data-testid]="'card-check-' + family.id"
          [checked]="checkedIds().has(family.id)"
          (change)="toggle(family.id)"
        />
        <button class="family-card" type="button" (click)="selectFamily.emit(family)">
          <strong>{{ family.familyName }}</strong
          ><span>{{ family.city }} · {{ family.parish || 'Sans paroisse' }}</span>
          <span>Capacité : {{ family.maxCapacity }} places</span>
          <span class="group" data-testid="card-group-name">
            <span tuiBadge size="s" [appearance]="family.hostingGroupId ? 'info' : 'neutral'">{{
              groupName(family)
            }}</span>
          </span>
          <span class="chips">
            @for (tag of family.tags || []; track tag) {
              <span tuiChip>{{ tag }}</span>
            }
          </span>
        </button>
      </div>
    } @empty {
      <p>Aucune famille enregistrée.</p>
    }
  </div>`,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
      gap: 1rem;
    }
    .card-wrap {
      position: relative;
      display: grid;
    }
    .card-check {
      position: absolute;
      inset-block-start: 0.75rem;
      inset-inline-end: 0.75rem;
      z-index: 1;
    }
    .family-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      border: 1px solid var(--tui-border-normal);
      border-radius: 1rem;
      background: var(--tui-background-base);
      text-align: start;
      cursor: pointer;
    }
    .family-card:hover {
      box-shadow: var(--tui-shadow-small);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
  `,
})
export class HostFamilyCardsComponent {
  readonly families = input.required<readonly HostFamily[]>();
  readonly groupNames = input<ReadonlyMap<number, string>>(new Map());
  readonly checkedIds = input<ReadonlySet<number>>(new Set());
  readonly selectFamily = output<HostFamily>();
  readonly checkedChange = output<number[]>();

  groupName(family: HostFamily): string {
    const id = family.hostingGroupId;
    return id != null ? (this.groupNames().get(id) ?? 'Groupe') : 'Sans groupe';
  }

  toggle(id: number): void {
    const next = new Set(this.checkedIds());
    if (!next.delete(id)) next.add(id);
    this.checkedChange.emit([...next]);
  }
}

@Component({
  selector: 'app-host-family-assignments-selector',
  imports: [
    ReactiveFormsModule,
    EventDateSelectorComponent,
    TuiButton,
    TuiCheckbox,
    TuiDataListWrapper,
    TuiInput,
    TuiSelect,
    TuiChevron,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="selector">
    <h3>Ajouter des personnes</h3>
    <form [formGroup]="filters">
      <label
        ><input tuiCheckbox type="checkbox" formControlName="unassignedOnly" /> Non affectés
        uniquement</label
      >
      <tui-textfield tuiChevron
        ><label for="type-2" tuiLabel>Type</label
        ><input tuiSelect formControlName="type" id="type-2" /><tui-data-list-wrapper
          *tuiDropdown
          [items]="types"
      /></tui-textfield>
      <tui-textfield
        ><label for="equipe-2" tuiLabel>Équipe</label
        ><input tuiInput type="number" formControlName="teamId" id="equipe-2"
      /></tui-textfield>
      <tui-textfield
        ><label for="recherche-2" tuiLabel>Recherche</label
        ><input tuiInput formControlName="q" id="recherche-2"
      /></tui-textfield>
    </form>
    <div class="results">
      @for (participant of participants(); track participant.id) {
        <label
          ><input
            tuiCheckbox
            type="checkbox"
            [checked]="isSelected(participant.id)"
            (change)="toggle(participant.id)"
          />
          <span
            >{{ participant.lastName }} {{ participant.firstName }} · {{ participant.type }}</span
          ></label
        >
      } @empty {
        <p>Aucun participant disponible.</p>
      }
    </div>
    <div class="dates">
      <app-event-date-selector
        label="Arrivée"
        hint="Date d'arrivee dans la famille d'accueil."
        [config]="eventDateConfig"
        [formControl]="arrivalDate"
      />
      <app-event-date-selector
        label="Départ"
        hint="Date de depart de la famille d'accueil."
        [config]="eventDateConfig"
        [formControl]="departureDate"
      />
    </div>
    <button
      tuiButton
      type="button"
      [disabled]="!selectedIds().length || saving()"
      (click)="addSelected()"
    >
      Ajouter {{ selectedIds().length }} sélectionné(s)
    </button>
  </section>`,
  styles: `
    .selector {
      display: grid;
      gap: 1rem;
    }
    .selector form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }
    .results {
      display: grid;
      gap: 0.5rem;
      max-block-size: 15rem;
      overflow: auto;
    }
    .results label,
    .selector > form > label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .dates {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .dates label {
      display: grid;
      gap: 0.25rem;
    }
    @media (max-width: 40rem) {
      .selector form {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class HostFamilyAssignmentsSelectorComponent {
  private readonly participantsApi = inject(ParticipantsApiService);
  private readonly assignmentsApi = inject(AssignmentsApiService);
  readonly eventDateConfig = ALLEGRIA_2027_EVENT_DATES;
  readonly family = input.required<HostFamily>();
  readonly currentAssignments = input.required<readonly ParticipantHostFamilyAssignment[]>();
  readonly assign = output<{ participantIds: number[] }>();
  readonly changed = output<void>();
  readonly types: readonly (PersonType | null)[] = [null, 'JEUNE', 'ANIMATEUR', 'BENEVOLE'];
  readonly participants = signal<Participant[]>([]);
  readonly selectedIds = signal<number[]>([]);
  readonly saving = signal(false);
  readonly arrivalDate = new FormControl('2027-10-30', { nonNullable: true });
  readonly departureDate = new FormControl('2027-11-02', { nonNullable: true });
  readonly filters = new FormGroup({
    unassignedOnly: new FormControl(true, { nonNullable: true }),
    type: new FormControl<PersonType | null>(null),
    teamId: new FormControl<number | null>(null),
    q: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.filters.valueChanges
      .pipe(
        startWith(this.filters.getRawValue()),
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap((filters) => this.participantsApi.search(filters)),
      )
      .subscribe((result) => this.participants.set(result.items));
  }
  isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }
  toggle(id: number): void {
    this.selectedIds.update((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
  }
  addSelected(): void {
    const ids = this.selectedIds();
    const byId = new Map(this.participants().map((participant) => [participant.id, participant]));
    const payloads: AssignmentPayload[] = ids.map((participantId) => ({
      participantId,
      hostFamilyId: this.family().id,
      type: byId.get(participantId)?.type ?? 'JEUNE',
      groupId: byId.get(participantId)?.group?.id ?? null,
      roomLabel: null,
      arrivalDate: this.arrivalDate.value,
      departureDate: this.departureDate.value,
      status: AssignmentStatus.PENDING,
      notes: '',
    }));
    this.saving.set(true);
    forkJoin(payloads.map((payload) => this.assignmentsApi.create(payload)))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe(() => {
        this.assign.emit({ participantIds: ids });
        this.selectedIds.set([]);
        this.changed.emit();
      });
  }
}

@Component({
  selector: 'app-host-family-detail-drawer',
  imports: [
    TuiButton,
    TuiChip,
    TuiDrawer,
    TuiTabs,
    HostFamilyAssignmentsSelectorComponent,
    SelectFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (family(); as current) {
    <tui-drawer direction="end" [overlay]="true">
      <header>
        <h2>{{ current.familyName }}</h2>
        <p>
          {{ current.city }} · {{ current.parish || 'Sans paroisse' }} ·
          {{ assignments()?.length || 0 }}/{{ current.maxCapacity }}
        </p>
        <tui-tabs [(activeItemIndex)]="tab"
          ><button tuiTab type="button">Infos famille</button
          ><button tuiTab type="button">Personnes hébergées</button></tui-tabs
        >
      </header>
      @if (tab === 0) {
        <dl>
          <dt>Adresse</dt>
          <dd>{{ current.address }}, {{ current.postalCode }} {{ current.city }}</dd>
          <dt>Contact</dt>
          <dd>{{ current.phone }} · {{ current.email }}</dd>
          <dt>Capacités</dt>
          <dd>{{ current.maxUnder18 }} mineurs · {{ current.maxAnimators ?? 0 }} animateurs</dd>
          <dt>Groupe</dt>
          <dd>
            <app-select-field
              label="Groupe de l'hébergement"
              icon="@tui.users"
              testId="detail-group"
              [options]="groupOptions()"
              [value]="current.hostingGroupId ?? 0"
              (valueChange)="groupChange.emit($event || null)"
            />
          </dd>
        </dl>
        <div class="chips">
          @for (tag of current.tags || []; track tag) {
            <span tuiChip>{{ tag }}</span>
          }
          @for (constraint of current.constraints || []; track constraint) {
            <span tuiChip appearance="warning">{{ constraint }}</span>
          }
        </div>
      } @else {
        <div class="assignments">
          @for (assignment of assignments() || []; track assignment.id) {
            <article>
              <span
                ><strong
                  >{{ assignment.participant.lastName }}
                  {{ assignment.participant.firstName }}</strong
                ><small
                  >{{ assignment.type }} · {{ assignment.groupId || 'sans groupe' }}</small
                ></span
              ><span
                >{{ assignment.arrivalDate }} → {{ assignment.departureDate }} ·
                {{ assignment.status }}</span
              ><button
                tuiButton
                size="s"
                appearance="secondary-destructive"
                type="button"
                (click)="remove(assignment.id)"
              >
                Retirer
              </button>
            </article>
          }
          <app-host-family-assignments-selector
            [family]="current"
            [currentAssignments]="assignments() || []"
            (changed)="changed.emit()"
          />
        </div>
      }
      <footer>
        <button tuiButton appearance="flat" type="button" (click)="drawerClosed.emit()">
          Fermer
        </button>
      </footer>
    </tui-drawer>
  }`,
  styles: `
    :host tui-drawer {
      inline-size: min(42rem, 100vw);
    }
    header,
    footer {
      position: sticky;
      z-index: 1;
      background: var(--tui-background-base);
    }
    /* le bandeau de l'appli (56px) recouvre le haut du tiroir : le titre démarre en dessous */
    header {
      padding-block-start: 3.75rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .assignments {
      display: grid;
      gap: 1rem;
    }
    .assignments article {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      border-block-end: 1px solid var(--tui-border-normal);
      padding-block: 0.75rem;
    }
    .assignments article span:first-child {
      display: grid;
    }
    .assignments small {
      color: var(--tui-text-secondary);
    }
  `,
})
export class HostFamilyDetailDrawerComponent {
  private readonly assignmentsApi = inject(AssignmentsApiService);
  readonly family = input<HostFamily | null>(null);
  readonly assignments = input<ParticipantHostFamilyAssignment[] | null>(null);
  readonly groups = input<readonly HostingGroupSummary[]>([]);
  readonly drawerClosed = output<void>();
  readonly changed = output<void>();
  readonly groupChange = output<number | null>();
  readonly groupOptions = computed<SelectOption<number>[]>(() => [
    { value: 0, label: 'Aucun groupe' },
    ...this.groups().map((g) => ({ value: g.id, label: g.name })),
  ]);
  tab = 0;
  remove(id: number): void {
    this.assignmentsApi.delete(id).subscribe(() => this.changed.emit());
  }
}

@Component({
  selector: 'app-assignments',
  imports: [
    ...SHARED_IMPORTS,
    RouterLink,
    TuiTabs,
    HostFamilyCardsComponent,
    HostFamilyDetailDrawerComponent,
    GroupBulkBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignments.html',
})
export class AssignmentsPage implements OnInit {
  private readonly api = inject(HostFamiliesApiService);
  private readonly hostingApi = inject(HostingPlacementApiService);
  readonly groups = signal<HostingGroupSummary[]>([]);
  readonly groupNames = computed(() => new Map(this.groups().map((g) => [g.id, g.name])));
  readonly checkedIds = signal<ReadonlySet<number>>(new Set());
  readonly families = signal<HostFamily[]>([]);
  readonly selectedFamily = signal<HostFamily | null>(null);
  readonly selectedFamilyAssignments = signal<ParticipantHostFamilyAssignment[] | null>(null);
  readonly loading = signal(true);
  view = 0;
  readonly tableColumns: readonly DataTableColumn<HostFamily>[] = [
    {
      key: 'family',
      label: 'Famille',
      type: 'text',
      value: (family) => family.familyName,
      presentation: { type: 'icon', icon: () => '@tui.users' },
      size: 'large',
    },
    {
      key: 'status',
      label: 'Statut',
      type: 'list',
      value: (family) => STATUS_LABELS[family.status],
      filterValue: (family) => family.status,
      presentation: {
        type: 'chip',
        appearance: (family) => STATUS_APPEARANCE[family.status],
      },
      size: 'small',
    },
    {
      key: 'hostingGroup',
      label: 'Groupe',
      type: 'list',
      value: (family) =>
        family.hostingGroupId != null
          ? (this.groupNames().get(family.hostingGroupId) ?? 'Groupe')
          : 'Sans groupe',
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' },
      size: 'medium',
    },
    {
      key: 'city',
      label: 'Ville',
      type: 'list',
      value: (family) => family.city,
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.map-pin' },
      size: 'medium',
    },
    {
      key: 'address',
      label: 'Adresse',
      type: 'text',
      value: (family) => family.address || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.home' },
      size: 'xlarge',
    },
    {
      key: 'phone',
      label: 'Téléphone',
      type: 'text',
      value: (family) => family.phone || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.phone' },
      size: 'small',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      value: (family) => family.email || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.mail' },
      size: 'large',
    },
    {
      key: 'maxCapacity',
      label: 'Capacité max',
      type: 'number',
      value: (family) => family.maxCapacity,
      sorter: (a, b) => a.maxCapacity - b.maxCapacity,
      hidden: true,
      presentation: { type: 'number' },
      size: 'xsmall',
    },
    {
      key: 'maxUnder18',
      label: 'Max -18 ans',
      type: 'number',
      value: (family) => family.maxUnder18,
      sorter: (a, b) => a.maxUnder18 - b.maxUnder18,
      hidden: true,
      presentation: { type: 'number' },
      size: 'xsmall',
    },
    {
      key: 'maxAnimators',
      label: 'Max animateurs',
      type: 'number',
      value: (family) => family.maxAnimators ?? '—',
      sorter: (a, b) => (a.maxAnimators ?? 0) - (b.maxAnimators ?? 0),
      hidden: true,
      presentation: { type: 'number' },
      size: 'xsmall',
    },
    {
      key: 'parish',
      label: 'Paroisse',
      type: 'text',
      value: (family) => family.parish || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.map-pin' },
      size: 'medium',
    },
    {
      key: 'latitude',
      label: 'Latitude',
      type: 'number',
      value: (family) => family.latitude ?? '—',
      hidden: true,
      size: 'xsmall',
    },
    {
      key: 'longitude',
      label: 'Longitude',
      type: 'number',
      value: (family) => family.longitude ?? '—',
      hidden: true,
      size: 'xsmall',
    },
    {
      key: 'constraints',
      label: 'Contraintes',
      type: 'text',
      value: (family) => (family.constraints ? family.constraints.join(', ') : '—'),
      hidden: true,
      presentation: { type: 'chips', autoColor: true, values: (family) => family.constraints || [] },
      size: 'xlarge',
    },
    {
      key: 'tags',
      label: 'Tags',
      type: 'text',
      value: (family) => (family.tags ? family.tags.join(', ') : '—'),
      hidden: true,
      presentation: { type: 'chips', autoColor: true, values: (family) => family.tags || [] },
      size: 'xlarge',
    },
    {
      key: 'notes',
      label: 'Notes',
      type: 'text',
      value: (family) => family.notes || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.note' },
      size: 'xlarge',
    },
  ];
  readonly assignmentColumns: readonly DataTableColumn<ParticipantHostFamilyAssignment>[] = [
    {
      key: 'participant',
      label: 'Participant',
      type: 'text',
      value: (x) => `${x.participant.lastName} ${x.participant.firstName}`,
      presentation: { type: 'person', subtitle: (x) => x.participant.group?.name || '—' },
      size: 'large',
    },
    {
      key: 'status',
      label: 'Statut',
      type: 'list',
      value: (x) => ASSIGNMENT_STATUS_LABELS[x.status],
      filterValue: (x) => x.status,
      presentation: {
        type: 'chip',
        appearance: (x) => ASSIGNMENT_STATUS_APPEARANCE[x.status],
      },
      size: 'small',
    },
    {
      key: 'hostFamily',
      label: 'Famille d\'accueil',
      type: 'list',
      value: (x) => x.hostFamily?.familyName || '—',
      hidden: true,
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' },
      size: 'large',
    },
    {
      key: 'type',
      label: 'Type',
      type: 'list',
      value: (x) => PERSON_TYPE_LABELS[x.type],
      filterValue: (x) => x.type,
      hidden: true,
      presentation: {
        type: 'chip',
        appearance: (x) => PERSON_TYPE_APPEARANCE[x.type],
      },
      size: 'small',
    },
    {
      key: 'arrivalDate',
      label: 'Arrivée',
      type: 'date',
      value: (x) => {
        const d = new Date(x.arrivalDate);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
      },
      filterValue: (x) => x.arrivalDate,
      hidden: true,
      presentation: { type: 'date' },
      size: 'large',
    },
    {
      key: 'departureDate',
      label: 'Départ',
      type: 'date',
      value: (x) => {
        const d = new Date(x.departureDate);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
      },
      filterValue: (x) => x.departureDate,
      hidden: true,
      presentation: { type: 'date' },
      size: 'large',
    },
    {
      key: 'groupId',
      label: 'Groupe ID',
      type: 'number',
      value: (x) => x.groupId ?? '—',
      hidden: true,
      size: 'xsmall',
    },
    {
      key: 'roomLabel',
      label: 'Chambre',
      type: 'text',
      value: (x) => x.roomLabel || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.home' },
      size: 'small',
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
  ngOnInit(): void {
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((families) => this.families.set(families));
    this.reloadGroups();
  }
  private reloadGroups(): void {
    this.hostingApi.listGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        // la colonne Groupe dépend des noms de groupes : on redonne les lignes au tableau
        this.families.update((rows) => [...rows]);
      },
      error: () => undefined,
    });
  }
  setChecked(ids: number[]): void {
    this.checkedIds.set(new Set(ids));
  }
  clearChecked(): void {
    this.checkedIds.set(new Set());
  }
  /** Recharge familles et groupes après une affectation (en masse ou depuis le détail). */
  reloadFamilies(): void {
    this.clearChecked();
    this.reloadGroups();
    this.api.list().subscribe((families) => {
      this.families.set(families);
      const current = this.selectedFamily();
      if (current) this.selectedFamily.set(families.find((f) => f.id === current.id) ?? null);
    });
  }
  changeFamilyGroup(groupId: number | null): void {
    const family = this.selectedFamily();
    if (!family) return;
    this.hostingApi.setFamilyGroup(family.id, groupId).subscribe(() => this.reloadFamilies());
  }
  select(family: HostFamily): void {
    this.selectedFamily.set(family);
    this.reloadAssignments();
  }
  reloadAssignments(): void {
    const family = this.selectedFamily();
    if (family)
      this.api
        .getAssignments(family.id)
        .subscribe((assignments) => this.selectedFamilyAssignments.set(assignments));
  }
  closeDrawer(): void {
    this.selectedFamily.set(null);
    this.selectedFamilyAssignments.set(null);
  }
}
