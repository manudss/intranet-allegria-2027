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
