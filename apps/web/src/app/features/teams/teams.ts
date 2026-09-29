import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import { Group, Participant, Team, TeamPayload, Volunteer } from '../../models/models';
import {
  GroupsApiService,
  ParticipantsApiService,
  TeamParticipantsApiService,
  TeamsApiService,
  VolunteersApiService,
} from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';
const blank = (): TeamPayload => ({
  name: '',
  groupId: null,
  primaryAnimatorId: null,
  secondaryAnimatorId: null,
  maxSize: 10,
  notes: '',
});
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './teams.html',
  styleUrls: ['../../shared/crud.scss', './teams.scss'],
})
export class TeamsPage implements OnInit {
  protected readonly tableColumns: readonly DataTableColumn<Team>[] = [
    {
      key: 'team',
      label: 'Équipe',
      type: 'text',
      value: (x) => x.name,
      presentation: { type: 'icon', icon: () => '@tui.users' },
    },
    {
      key: 'group',
      label: 'Groupe',
      type: 'list',
      value: (x) => x.group?.name || '—',
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' },
    },
    {
      key: 'animator',
      label: 'Animateur',
      type: 'list',
      value: (x) =>
        x.primaryAnimator ? `${x.primaryAnimator.firstName} ${x.primaryAnimator.lastName}` : '—',
      presentation: { type: 'person', subtitle: (x) => x.primaryAnimator?.email },
    },
  ];
  private api = inject(TeamsApiService);
  private membersApi = inject(TeamParticipantsApiService);
  private groupsApi = inject(GroupsApiService);
  private volunteersApi = inject(VolunteersApiService);
  private participantsApi = inject(ParticipantsApiService);
  items = signal<Team[]>([]);
  groups = signal<Group[]>([]);
  volunteers = signal<Volunteer[]>([]);
  participants = signal<Participant[]>([]);
  groupIds = computed(() => this.groups().map(({ id }) => id));
  volunteerIds = computed(() => this.volunteers().map(({ id }) => id));
  members = signal<Participant[]>([]);
  query = signal('');
  groupFilter = signal<number | null>(null);
  groupFilterForm = form(this.groupFilter);
  candidateId = signal<number | null>(null);
  candidateForm = form(this.candidateId);
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit'>('detail');
  selected = signal<Team | null>(null);
  model = signal<TeamPayload>(blank());
  teamForm = form(this.model, (p) => {
    required(p.name);
    min(p.maxSize, 1);
  });
  filtered = computed(() => {
    const q = this.query().toLowerCase(),
      g = this.groupFilter();
    return this.items().filter(
      (x) =>
        (!g || x.group?.id === g) && `${x.name} ${x.group?.name ?? ''}`.toLowerCase().includes(q),
    );
  });
  availableParticipants = computed(() => {
    const ids = new Set(this.members().map((x) => x.id));
    return this.participants().filter((x) => !ids.has(x.id));
  });
  availableParticipantIds = computed(() => this.availableParticipants().map(({ id }) => id));
  stringifyGroup = (id: number) => this.groups().find((group) => group.id === id)?.name ?? '';
  stringifyVolunteer = (id: number) => {
    const volunteer = this.volunteers().find((item) => item.id === id);
    return volunteer ? `${volunteer.lastName} ${volunteer.firstName}` : '';
  };
  stringifyParticipant = (id: number) => {
    const participant = this.participants().find((item) => item.id === id);
    return participant ? `${participant.lastName} ${participant.firstName}` : '';
  };
  ngOnInit() {
    forkJoin({
      items: this.api.list(),
      groups: this.groupsApi.list(),
      volunteers: this.volunteersApi.list(),
      participants: this.participantsApi.list(),
    }).subscribe((x) => {
      this.items.set(x.items);
      this.groups.set(x.groups);
      this.volunteers.set(x.volunteers);
      this.participants.set(x.participants);
      this.loading.set(false);
    });
  }
  open(x: Team) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
    this.api.getParticipants(x.id).subscribe((v) => this.members.set(v));
  }
  create() {
    this.model.set(blank());
    this.mode.set('create');
    this.opened.set(true);
  }
  edit() {
    const x = this.requireSelectedTeam();
    this.model.set({
      name: x.name,
      groupId: x.group?.id ?? null,
      primaryAnimatorId: x.primaryAnimator?.id ?? null,
      secondaryAnimatorId: x.secondaryAnimator?.id ?? null,
      maxSize: x.maxSize,
      notes: x.notes ?? '',
    });
    this.mode.set('edit');
  }
  save() {
    submit(this.teamForm, async () => {
      const req =
        this.mode() === 'create'
          ? this.api.create(this.model())
          : this.api.update(this.requireSelectedTeam().id, this.model());
      req.subscribe((x) => {
        this.items.update((a) =>
          this.mode() === 'create' ? [...a, x] : a.map((i) => (i.id === x.id ? x : i)),
        );
        this.open(x);
      });
    });
  }
  remove() {
    const x = this.requireSelectedTeam();
    if (confirm(`Supprimer ${x.name} ?`))
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
  addMember() {
    const id = this.candidateId();
    const team = this.selected();
    if (id && team)
      this.membersApi.add(team.id, id).subscribe(() => {
        const p = this.participants().find((x) => x.id === id);
        if (p) this.members.update((a) => [...a, p]);
        this.candidateId.set(null);
      });
  }
  removeMember(id: number) {
    const team = this.selected();
    if (team)
      this.membersApi
        .remove(team.id, id)
        .subscribe(() => this.members.update((a) => a.filter((x) => x.id !== id)));
  }
  private requireSelectedTeam(): Team {
    const team = this.selected();
    if (!team) {
      throw new Error('No team selected');
    }
    return team;
  }
}
