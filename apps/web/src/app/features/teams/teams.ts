import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  BenevoleAssignment,
  Participant,
  ProgramSequenceTrack,
  Team,
  TeamPayload,
  Volunteer,
} from '../../models/models';
import { GatheringGroupsApiService } from '../gathering-groups/gathering-groups.api';
import {
  CATEGORY_LABELS,
  GatheringCategory,
  GatheringRepartition,
  TRACK_COLORS,
  TRACK_LABELS,
} from '../gathering-groups/gathering-groups.models';
import {
  TeamBenevolesApiService,
  TeamParticipantsApiService,
  TeamsApiService,
} from '../../services/api.services';
import { PersonPickerComponent, PersonSummary } from '../../shared/person-picker.component';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MyAccessService } from '../../core/my-access.service';
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
  primaryAnimatorId: null,
  secondaryAnimatorId: null,
  maxSize: 10,
  notes: '',
  track: ProgramSequenceTrack.COMMON,
});

/** Appartenance d'une équipe à un groupe de rassemblement (une répartition donnée). */
interface GatheringMembership {
  id: number;
  label: string;
  name: string;
  category: GatheringCategory;
  repartitionId: number;
  repartitionName: string;
}
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [...SHARED_IMPORTS, PersonPickerComponent, RouterLink],
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
      key: 'gatheringGroups',
      label: 'Groupes de rassemblement',
      type: 'list',
      value: (x) => this.membershipsOf(x.id).map((m) => m.label).join(', ') || '—',
      presentation: {
        type: 'chips',
        autoColor: true,
        values: (x) => this.membershipsOf(x.id).map((m) => m.label),
      },
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
  private readonly route = inject(ActivatedRoute);
  protected readonly myAccess = inject(MyAccessService);
  private membersApi = inject(TeamParticipantsApiService);
  private benevolesApi = inject(TeamBenevolesApiService);
  private gatheringApi = inject(GatheringGroupsApiService);
  items = signal<Team[]>([]);
  /** Répartitions de rassemblement avec leurs groupes (vide si le module n'est pas accessible). */
  repartitions = signal<GatheringRepartition[]>([]);
  /** Module groupes accessible au compte connecté ; sinon la colonne et l'ajout sont masqués. */
  gatheringAccess = signal(true);
  /** Tous les groupes de rassemblement, toutes répartitions, pour le filtre et l'ajout. */
  gatheringOptions = computed(() =>
    this.repartitions().flatMap((r) =>
      r.groups.map((g) => ({
        id: g.id,
        label: `${g.name} · ${r.name}`,
        name: g.name,
        category: g.category,
        repartitionId: r.id,
        repartitionName: r.name,
      })),
    ),
  );
  gatheringGroupIds = computed(() => this.gatheringOptions().map(({ id }) => id));
  /** Appartenances par équipe : tous les groupes de rassemblement dont elle fait partie. */
  memberships = computed(() => {
    const byTeam = new Map<number, GatheringMembership[]>();
    for (const option of this.gatheringOptions()) {
      const group = this.repartitions()
        .flatMap((r) => r.groups)
        .find((g) => g.id === option.id);
      for (const teamId of group?.teamIds ?? []) {
        byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), option]);
      }
    }
    return byTeam;
  });
  membershipsOf(teamId: number): GatheringMembership[] {
    return this.memberships().get(teamId) ?? [];
  }
  members = signal<Participant[]>([]);
  benevoles = signal<BenevoleAssignment[]>([]);
  /** Bénévoles déjà affectés à une équipe (toutes équipes) : exclus du sélecteur. */
  assignedVolunteerIds = signal<ReadonlySet<number>>(new Set());
  query = signal('');
  /** Filtre par groupe de rassemblement (id de groupe, toutes répartitions). */
  groupFilter = signal<number | null>(null);
  groupFilterForm = form(this.groupFilter);
  /** Groupe choisi dans le sélecteur d'ajout de la fiche équipe. */
  addGroupId = signal<number | null>(null);
  addGroupForm = form(this.addGroupId);
  /** Groupes dont l'équipe ouverte ne fait pas encore partie. */
  addableGroups = computed(() => {
    const team = this.selected();
    if (!team) return [];
    const own = new Set(this.membershipsOf(team.id).map((m) => m.id));
    return this.gatheringOptions().filter((o) => !own.has(o.id));
  });
  addableGroupIds = computed(() => this.addableGroups().map(({ id }) => id));
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
        (!g || this.membershipsOf(x.id).some((m) => m.id === g)) &&
        `${x.name} ${this.membershipsOf(x.id)
          .map((m) => m.label)
          .join(' ')}`.toLowerCase().includes(q),
    );
  });
  jeunesCount = computed(() => this.members().filter((x) => x.type === 'JEUNE').length);
  adultesCount = computed(() => this.members().length - this.jeunesCount());
  stringifyGroup = (id: number) =>
    this.gatheringOptions().find((option) => option.id === id)?.label ?? '';
  protected readonly trackValues = [
    ProgramSequenceTrack.COMMON,
    ProgramSequenceTrack.TA,
    ProgramSequenceTrack.ES,
  ];
  protected readonly trackLabels = TRACK_LABELS;
  stringifyTrack = (track: ProgramSequenceTrack) => TRACK_LABELS[track];
  ngOnInit() {
    this.myAccess.load();
    forkJoin({
      items: this.api.list(),
      repartitions: this.gatheringApi.list().pipe(
        catchError((e) => {
          if (e?.status === 403) this.gatheringAccess.set(false);
          return of([] as GatheringRepartition[]);
        }),
      ),
    }).subscribe((x) => {
      this.items.set(x.items);
      this.repartitions.set(x.repartitions);
      this.loading.set(false);
      // Lien direct depuis les fiches de groupe : /equipes?equipe=ID ouvre la fiche de l'équipe.
      const id = Number(this.route.snapshot.queryParamMap.get('equipe'));
      const target = x.items.find((t) => t.id === id);
      if (target) this.open(target);
    });
  }
  open(x: Team) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
    this.addGroupId.set(null);
    this.api.getParticipants(x.id).subscribe((v) => this.members.set(v));
    this.refreshBenevoles(x.id);
  }
  /** Ajoute l'équipe ouverte au groupe de rassemblement choisi (contrôles serveur : piste, capacité). */
  addToGroup() {
    const groupId = this.addGroupId();
    const team = this.selected();
    if (!groupId || !team) return;
    this.gatheringApi.assignTeam(groupId, team.id).subscribe({
      next: () => {
        this.addGroupId.set(null);
        this.gatheringApi
          .list()
          .pipe(catchError(() => of([] as GatheringRepartition[])))
          .subscribe((v) => this.repartitions.set(v));
      },
      error: (e) => alert(e?.error?.message ?? "L'ajout au groupe a échoué."),
    });
  }
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly trackColors = TRACK_COLORS;
  /** Retire l'équipe ouverte d'un groupe de rassemblement (confirmation, puis rechargement). */
  removeFromGroup(membership: GatheringMembership) {
    const team = this.selected();
    if (!team) return;
    this.confirmDialog
      .ask({
        title: 'Retirer du groupe',
        message: `Retirer « ${team.name} » du groupe « ${membership.name} » (${membership.repartitionName}) ?`,
        yes: 'Retirer',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.gatheringApi.unassignTeam(membership.id, team.id).subscribe({
          next: () =>
            this.gatheringApi
              .list()
              .pipe(catchError(() => of([] as GatheringRepartition[])))
              .subscribe((v) => this.repartitions.set(v)),
          error: (e) => alert(e?.error?.message ?? 'Le retrait du groupe a échoué.'),
        });
      });
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
