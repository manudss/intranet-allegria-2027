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
    month: 'long',
    day: 'numeric',
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
  imports: [...SHARED_IMPORTS],
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
      label: 'Groupe d\'âge MEJ',
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
      label: 'Contact d\'urgence',
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
  ageGroupFilter = signal<MejAgeGroup | null>(null);
  ageGroupFilterForm = form(this.ageGroupFilter);
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
