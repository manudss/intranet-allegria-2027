import { ACRONYM_HINTS } from '../../shared/help-content';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  Group,
  MejAgeGroup,
  PersonType,
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
import {
  DelegationSummary,
  DelegationTransport,
  DelegationsApiService,
  PersonJourneys,
  TransportDirection,
} from '../delegations/delegations-api.service';

const SEX_LABELS: Record<ParticipantSex, string> = {
  [ParticipantSex.FEMALE]: 'Femme',
  [ParticipantSex.MALE]: 'Homme',
  [ParticipantSex.OTHER]: 'Autre',
  [ParticipantSex.UNDISCLOSED]: 'Non communiqué',
};

const SEX_APPEARANCE: Record<ParticipantSex, string> = {
  [ParticipantSex.FEMALE]: 'info',
  [ParticipantSex.MALE]: 'primary',
  [ParticipantSex.OTHER]: 'warning',
  [ParticipantSex.UNDISCLOSED]: 'neutral',
};

const MEJ_AGE_LABELS: Record<MejAgeGroup, string> = {
  [MejAgeGroup.TA]: 'TA',
  [MejAgeGroup.ES]: 'ES',
};

const TYPE_LABELS: Record<PersonType, string> = {
  JEUNE: 'Jeune',
  ANIMATEUR: 'Animateur',
  BENEVOLE: 'Bénévole',
};

const TYPE_APPEARANCE: Record<PersonType, string> = {
  JEUNE: 'success',
  ANIMATEUR: 'primary',
  BENEVOLE: 'warning',
};

function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  if (isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
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
  imports: [RouterLink, ...SHARED_IMPORTS],
  templateUrl: './participants.html',
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
      size: 'large',
    },
    {
      key: 'group',
      label: 'Groupe',
      type: 'list',
      value: (x) => x.group?.name || 'Sans groupe',
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' },
      size: 'large',
    },
    {
      key: 'diocese',
      label: 'Diocèse',
      type: 'list',
      value: (x) => x.diocese || '—',
      presentation: { type: 'icon', icon: () => '@tui.map-pin' },
      size: 'medium',
    },
    {
      key: 'city',
      label: 'Ville',
      type: 'text',
      value: (x) => x.city || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.home' },
      size: 'medium',
    },
    {
      key: 'sex',
      label: 'Sexe',
      type: 'list',
      value: (x) => (x.sex ? SEX_LABELS[x.sex] : '—'),
      filterValue: (x) => x.sex ?? '',
      hidden: true,
      presentation: {
        type: 'chip',
        appearance: (x) => (x.sex ? SEX_APPEARANCE[x.sex] : ''),
      },
      size: 'xsmall',
    },
    {
      key: 'dateOfBirth',
      label: 'Date de naissance',
      type: 'date',
      value: (x) => {
        const age = calculateAge(x.dateOfBirth);
        const formatted = formatDateFull(x.dateOfBirth);
        if (age !== null) {
          return `${formatted} (${age} ans)`;
        }
        return formatted;
      },
      filterValue: (x) => x.dateOfBirth ?? '',
      hidden: true,
      size: 'large',
    },
    {
      key: 'mejAgeGroup',
      label: "Groupe d'âge MEJ",
      type: 'list',
      value: (x) => (x.mejAgeGroup ? MEJ_AGE_LABELS[x.mejAgeGroup] : '—'),
      filterValue: (x) => x.mejAgeGroup || '',
      hidden: true,
      presentation: {
        type: 'chip',
        autoColor: true,
      },
      size: 'medium',
    },
    {
      key: 'type',
      label: 'Type',
      type: 'list',
      value: (x) => TYPE_LABELS[x.type],
      filterValue: (x) => x.type,
      hidden: true,
      presentation: {
        type: 'chip',
        appearance: (x) => TYPE_APPEARANCE[x.type],
      },
      size: 'small',
    },
    {
      key: 'emergencyContactName',
      label: "Contact d'urgence",
      type: 'text',
      value: (x) => x.emergencyContactName || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.user' },
      size: 'large',
    },
    {
      key: 'emergencyContactPhone',
      label: 'Tél. urgence',
      type: 'text',
      value: (x) => x.emergencyContactPhone || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.phone' },
      size: 'small',
    },
  ];
  private route = inject(ActivatedRoute);
  protected canSeeAdministrative = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));
  protected canSeeFamilyHealth = computed(() => this.auth.hasRole('HEALTH'));
  private api = inject(ParticipantsApiService);
  private readonly delegationsApi = inject(DelegationsApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private groupsApi = inject(GroupsApiService);
  private healthApi = inject(HealthApiService);
  private auth = inject(AuthService);
  items = signal<Participant[]>([]);
  groups = signal<Group[]>([]);
  groupIds = computed(() => this.groups().map(({ id }) => id));
  stringifySex = (sex: ParticipantSex) => SEX_LABELS[sex] ?? '';
  stringifyAge = (age: MejAgeGroup) => MEJ_AGE_LABELS[age] ?? '';
  stringifyGroup = (id: number) => this.groups().find((group) => group.id === id)?.name ?? '';
  query = signal('');
  groupFilter = signal<number | null>(null);
  groupFilterForm = form(this.groupFilter);
  ageGroupFilter = signal<MejAgeGroup | null>(null);
  ageGroupFilterForm = form(this.ageGroupFilter);
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit' | 'health'>('detail');
  selected = signal<Participant | null>(null);
  health = signal<ParticipantHealth | null>(null);
  journeys = signal<PersonJourneys | null>(null);
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
  protected readonly acronymHints = ACRONYM_HINTS;
  readonly canSeeHealth = computed(() => this.auth.hasAnyRole(['ADMIN', 'HEALTH']));
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    const gid = this.groupFilter();
    const ageGroup = this.ageGroupFilter();
    return this.items().filter(
      (x) =>
        (!gid || x.group?.id === gid) &&
        (!ageGroup || x.mejAgeGroup === ageGroup) &&
        `${x.firstName} ${x.lastName} ${x.diocese ?? ''} ${x.city ?? ''}`.toLowerCase().includes(q),
    );
  });
  ngOnInit() {
    forkJoin({ items: this.api.getParticipants(), groups: this.groupsApi.list() }).subscribe(
      (x) => {
        this.items.set(x.items);
        this.groups.set(x.groups);
        this.loading.set(false);
        const id = Number(this.route.snapshot.queryParamMap.get('participant'));
        const selected = x.items.find((p) => p.id === id);
        if (selected) this.open(selected);
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
    this.journeys.set(null);
    this.journeyError.set('');
    this.journeyTransports.set({});
    this.delegationsApi.journeysForFiche(x.id).subscribe({
      next: (j) => {
        this.journeys.set(j);
        this.initJourneyEdits();
      },
      error: () => this.journeys.set(null),
    });
    if (!this.delegationOptions().length) {
      this.loadDelegationOptions();
    }
  }

  /** Charge la liste des délégations ; l'échec est visible et réessayable. */
  protected loadDelegationOptions() {
    this.delegationOptionsError.set('');
    this.delegationsApi.listSummaries().subscribe({
      next: (rows) => this.delegationOptions.set(rows),
      error: () =>
        this.delegationOptionsError.set(
          "La liste des délégations n'a pas pu être chargée. Vérifiez votre connexion puis réessayez.",
        ),
    });
  }

  // ------------------------------------------------------------ lot 6 : trajets modifiables
  /** Options de délégations pour la fiche personne (liste calculée serveur). */
  readonly delegationOptions = signal<DelegationSummary[]>([]);
  /** Brouillon d'édition par sens : délégation + sous-délégation choisies. */
  readonly journeyEdits = signal<
    Partial<Record<TransportDirection, { delegationId: number; transportId: number | null }>>
  >({});
  /** Sous-délégations chargées par sens pour la délégation choisie. */
  readonly journeyTransports = signal<Partial<Record<TransportDirection, DelegationTransport[]>>>(
    {},
  );
  readonly journeySaving = signal<TransportDirection | null>(null);
  readonly journeyError = signal('');
  /** Erreur de chargement de la liste des délégations (affichee, reessayable). */
  readonly delegationOptionsError = signal('');

  private initJourneyEdits() {
    const j = this.journeys();
    if (!j) return;
    const edits: Partial<
      Record<TransportDirection, { delegationId: number; transportId: number | null }>
    > = {};
    for (const journey of j.journeys) {
      edits[journey.direction] = {
        delegationId: journey.delegation.id,
        transportId: journey.transport?.id ?? null,
      };
      this.loadJourneyTransports(journey.direction, journey.delegation.id);
    }
    this.journeyEdits.set(edits);
  }

  protected journeyEdit(direction: TransportDirection) {
    return this.journeyEdits()[direction];
  }

  protected setJourneyDelegation(direction: TransportDirection, delegationId: number) {
    this.journeyEdits.update((m) => ({
      ...m,
      [direction]: { delegationId, transportId: null },
    }));
    this.loadJourneyTransports(direction, delegationId);
  }

  protected setJourneyTransport(direction: TransportDirection, transportId: number | null) {
    const current = this.journeyEdits()[direction];
    if (!current) return;
    this.journeyEdits.update((m) => ({ ...m, [direction]: { ...current, transportId } }));
  }

  private loadJourneyTransports(direction: TransportDirection, delegationId: number) {
    this.delegationsApi.listTransports(delegationId, direction).subscribe({
      next: (rows) => this.journeyTransports.update((m) => ({ ...m, [direction]: rows })),
      error: () => this.journeyTransports.update((m) => ({ ...m, [direction]: [] })),
    });
  }

  /**
   * Enregistre le sens : une affectation suit une seule ligne par personne et
   * par sens. Placer sur une sous-délégation (même d'une autre délégation) se
   * fait par affectation directe ; « à placer » d'une autre délégation passe
   * par une exception tracée ; « à placer » de sa propre délégation retire
   * l'affectation. Le serveur applique le périmètre.
   */
  protected saveJourney(direction: TransportDirection) {
    const j = this.journeys();
    const edit = this.journeyEdits()[direction];
    const journey = j?.journeys.find((x) => x.direction === direction);
    if (!j || !edit || !journey) return;
    // Pas d'enregistrement tant que la liste des délégations n'est pas chargée :
    // l'écran ne montre pas ce qui serait réellement enregistré.
    if (!this.delegationOptions().length) {
      this.journeyError.set(
        "La liste des délégations n'est pas chargée : enregistrement impossible pour l'instant.",
      );
      return;
    }
    this.journeySaving.set(direction);
    this.journeyError.set('');
    const done = {
      next: () => {
        this.journeySaving.set(null);
        const x = this.selected();
        if (x) this.open(x);
      },
      error: () => {
        this.journeySaving.set(null);
        this.journeyError.set(
          "Le changement n'a pas pu être enregistré (hors de votre périmètre ?).",
        );
      },
    };
    if (edit.transportId) {
      this.delegationsApi.assign(edit.transportId, j.personType, j.personId).subscribe(done);
      return;
    }
    if (!journey.transport && journey.delegation.id === edit.delegationId) {
      this.journeySaving.set(null);
      return;
    }
    const homeId = this.selected()?.group?.id;
    if (homeId && edit.delegationId === homeId) {
      this.delegationsApi.unassign(journey.assignmentId).subscribe(done);
      return;
    }
    if (!homeId) {
      this.journeySaving.set(null);
      this.journeyError.set('La délégation principale de la personne est introuvable.');
      return;
    }
    this.delegationsApi
      .createException(homeId, {
        personType: j.personType,
        personId: j.personId,
        direction,
        toDelegationId: edit.delegationId,
      })
      .subscribe(done);
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
    this.confirmDialog.askDelete(`${x.firstName} ${x.lastName}`).subscribe((ok) => {
      if (!ok) return;
      this.api.deleteParticipant(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
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
