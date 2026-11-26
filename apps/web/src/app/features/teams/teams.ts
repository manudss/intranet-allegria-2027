import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  BenevoleAssignment,
  Group,
  Participant,
  ProgramSequenceTrack,
  Team,
  TeamPayload,
  Volunteer,
} from '../../models/models';
import { TRACK_COLORS, TRACK_LABELS } from '../gathering-groups/gathering-groups.models';
import {
  GroupsApiService,
  TeamBenevolesApiService,
  TeamParticipantsApiService,
  TeamsApiService,
} from '../../services/api.services';
import { PersonPickerComponent, PersonSummary } from '../../shared/person-picker.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';

function volunteerName(v: Volunteer | null): string {
  return v ? `${v.lastName} ${v.firstName}` : '—';
}
const toPick = (v: Volunteer | null): PersonSummary | null =>
  v
    ? {
        id: v.id,
        email: v.email ?? '',
        firstName: v.firstName,
        lastName: v.lastName,
        isActive: true,
        roles: [],
        teams: [],
        teamTypes: [],
      }
    : null;
const blank = (): TeamPayload => ({
  name: '',
  groupId: null,
  primaryAnimatorId: null,
  secondaryAnimatorId: null,
  maxSize: 10,
  notes: '',
  track: ProgramSequenceTrack.COMMON,
});
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [...SHARED_IMPORTS, PersonPickerComponent],
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
      size: 'large',
    },
    {
      key: 'group',
      label: 'Groupe',
      type: 'list',
      value: (x) => x.group?.name || '—',
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' },
      size: 'large',
    },
    {
      key: 'animator',
      label: 'Animateur principal',
      type: 'list',
      value: (x) => volunteerName(x.primaryAnimator),
      presentation: { type: 'person', subtitle: (x) => x.primaryAnimator?.email || '—' },
      size: 'large',
    },
    {
      key: 'secondaryAnimator',
      label: 'Animateur secondaire',
      type: 'list',
      value: (x) => volunteerName(x.secondaryAnimator),
      hidden: true,
      presentation: { type: 'person', subtitle: (x) => x.secondaryAnimator?.email || '—' },
      size: 'large',
    },
    {
      key: 'track',
      label: 'Piste',
      type: 'list',
      value: (x) => TRACK_LABELS[x.track],
      presentation: {
        type: 'icon',
        icon: () => '@tui.flag',
        iconColor: (x) => TRACK_COLORS[x.track],
      },
      size: 'xsmall',
    },
    {
      key: 'maxSize',
      label: 'Taille max',
      type: 'number',
      value: (x) => x.maxSize,
      sorter: (a, b) => a.maxSize - b.maxSize,
      hidden: true,
      presentation: { type: 'number' },
      size: 'xsmall',
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
  private api = inject(TeamsApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private membersApi = inject(TeamParticipantsApiService);
  private benevolesApi = inject(TeamBenevolesApiService);
  private groupsApi = inject(GroupsApiService);
  items = signal<Team[]>([]);
  groups = signal<Group[]>([]);
  groupIds = computed(() => this.groups().map(({ id }) => id));
  members = signal<Participant[]>([]);
  benevoles = signal<BenevoleAssignment[]>([]);
  /** Bénévoles déjà affectés à une équipe (toutes équipes) : exclus du sélecteur. */
  assignedVolunteerIds = signal<ReadonlySet<number>>(new Set());
  query = signal('');
  groupFilter = signal<number | null>(null);
  groupFilterForm = form(this.groupFilter);
  /** Personnes choisies dans les sélecteurs à recherche serveur (rien n'est chargé à l'ouverture). */
  candidate = signal<PersonSummary | null>(null);
  benevoleCandidate = signal<PersonSummary | null>(null);
  primaryAnimator = signal<PersonSummary | null>(null);
  secondaryAnimator = signal<PersonSummary | null>(null);
  /** Les fiches BENEVOLE sont gérées dans le bloc dédié, jamais ici ; on masque les membres actuels. */
  excludeParticipant = (p: PersonSummary) =>
    p.type === 'BENEVOLE' || this.members().some((m) => m.id === p.id);
  excludeBenevole = (p: PersonSummary) => this.assignedVolunteerIds().has(p.id);
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
  jeunesCount = computed(() => this.members().filter((x) => x.type === 'JEUNE').length);
  adultesCount = computed(() => this.members().length - this.jeunesCount());
  stringifyGroup = (id: number) => this.groups().find((group) => group.id === id)?.name ?? '';
  protected readonly trackValues = [
    ProgramSequenceTrack.COMMON,
    ProgramSequenceTrack.TA,
    ProgramSequenceTrack.ES,
  ];
  protected readonly trackLabels = TRACK_LABELS;
  stringifyTrack = (track: ProgramSequenceTrack) => TRACK_LABELS[track];
  ngOnInit() {
    forkJoin({
      items: this.api.list(),
      groups: this.groupsApi.list(),
    }).subscribe((x) => {
      this.items.set(x.items);
      this.groups.set(x.groups);
      this.loading.set(false);
    });
  }
  open(x: Team) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
    this.api.getParticipants(x.id).subscribe((v) => this.members.set(v));
    this.refreshBenevoles(x.id);
  }
  private refreshBenevoles(teamId: number) {
    this.benevolesApi
      .listForTeam(teamId)
      .pipe(catchError(() => of([] as BenevoleAssignment[])))
      .subscribe((v) => this.benevoles.set(v));
    this.benevolesApi
      .listAssignments()
      .pipe(catchError(() => of([] as BenevoleAssignment[])))
      .subscribe((v) => this.assignedVolunteerIds.set(new Set(v.map((a) => a.volunteerId))));
  }
  create() {
    this.model.set(blank());
    this.primaryAnimator.set(null);
    this.secondaryAnimator.set(null);
    this.mode.set('create');
    this.opened.set(true);
  }
  edit() {
    const x = this.requireSelectedTeam();
    this.primaryAnimator.set(toPick(x.primaryAnimator));
    this.secondaryAnimator.set(toPick(x.secondaryAnimator));
    this.model.set({
      name: x.name,
      groupId: x.group?.id ?? null,
      primaryAnimatorId: x.primaryAnimator?.id ?? null,
      secondaryAnimatorId: x.secondaryAnimator?.id ?? null,
      maxSize: x.maxSize,
      notes: x.notes ?? '',
      track: x.track,
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
    this.confirmDialog.askDelete(x.name).subscribe((ok) => {
      if (!ok) return;
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
    });
  }
  addMember() {
    const id = this.candidate()?.id;
    const team = this.selected();
    if (id && team)
      this.membersApi.add(team.id, id).subscribe(() => {
        this.candidate.set(null);
        this.api.getParticipants(team.id).subscribe((v) => this.members.set(v));
      });
  }
  removeMember(id: number) {
    const team = this.selected();
    if (team)
      this.membersApi
        .remove(team.id, id)
        .subscribe(() => this.members.update((a) => a.filter((x) => x.id !== id)));
  }
  addBenevole() {
    const id = this.benevoleCandidate()?.id;
    const team = this.selected();
    if (!id || !team) return;
    this.benevolesApi.assign(team.id, id).subscribe({
      next: () => {
        this.benevoleCandidate.set(null);
        this.refreshBenevoles(team.id);
        this.api.getParticipants(team.id).subscribe((v) => this.members.set(v));
      },
      error: (e) => alert(e?.error?.message ?? "L'ajout du bénévole a échoué."),
    });
  }
  removeBenevole(volunteerId: number) {
    const team = this.selected();
    if (!team) return;
    this.benevolesApi.unassign(team.id, volunteerId).subscribe({
      next: () => {
        this.refreshBenevoles(team.id);
        this.api.getParticipants(team.id).subscribe((v) => this.members.set(v));
      },
      error: (e) => alert(e?.error?.message ?? 'Le retrait du bénévole a échoué.'),
    });
  }
  setAnimator(
    key: 'primaryAnimatorId' | 'secondaryAnimatorId',
    holder: { set(v: PersonSummary | null): void },
    p: PersonSummary | null,
  ) {
    holder.set(p);
    this.model.update((m) => ({ ...m, [key]: p?.id ?? null }));
  }
  private requireSelectedTeam(): Team {
    const team = this.selected();
    if (!team) {
      throw new Error('No team selected');
    }
    return team;
  }
}
