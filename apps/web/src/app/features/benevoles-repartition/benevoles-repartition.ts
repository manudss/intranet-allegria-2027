import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { TuiInput } from '@taiga-ui/core';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import {
  RepartitionFilters,
  RepartitionTeamRow,
  RepartitionVolunteerRow,
  VolunteerSkillType,
} from '../../models/models';
import { TeamBenevolesApiService } from '../../services/api.services';
import { autoProposal } from './benevoles-repartition.logic';

type Notice = { kind: 'error' | 'info' | 'warning'; text: string };
type TeamFillFilter = 'all' | 'free' | 'full';
type AssignmentFilter = 'all' | 'unassigned' | 'assigned';

/** Colonne "pool" du board d'affectation (bénévole sans équipe choisie). */
const POOL = 0;

const SKILL_LABELS: Record<string, string> = {
  [VolunteerSkillType.SECURITY]: 'Sécurité',
  [VolunteerSkillType.ANIMATION]: 'Animation',
  [VolunteerSkillType.LITURGY]: 'Liturgie',
  [VolunteerSkillType.LOGISTICS]: 'Logistique',
  [VolunteerSkillType.HEALTH]: 'Santé',
  [VolunteerSkillType.RECEPTION]: 'Accueil',
  [VolunteerSkillType.TRANSPORT]: 'Transport',
  [VolunteerSkillType.ACCOMMODATION]: 'Hébergement',
  [VolunteerSkillType.COMMUNICATION]: 'Communication',
  [VolunteerSkillType.CATERING]: 'Restauration',
  [VolunteerSkillType.CLEANING]: 'Nettoyage',
  [VolunteerSkillType.MISCELLANEOUS]: 'Divers',
  [VolunteerSkillType.OTHER]: 'Autre',
};

@Component({
  selector: 'app-benevoles-repartition',
  standalone: true,
  imports: [...SHARED_IMPORTS, FormsModule, ...TuiInput, SelectFieldComponent, CdkDropList, CdkDrag, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './benevoles-repartition.html',
  styleUrl: './benevoles-repartition.scss',
})
export class BenevolesRepartitionPage implements OnInit {
  private readonly api = inject(TeamBenevolesApiService);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<Notice | null>(null);
  protected readonly step = signal<1 | 2 | 3>(1);
  protected readonly filters = signal<RepartitionFilters | null>(null);

  // ── Étape 1 : pool d'équipes ───────────────────────────────────────────────
  protected readonly allTeams = signal<RepartitionTeamRow[]>([]);
  protected readonly teamSearch = signal('');
  protected readonly teamHostingGroupId = signal<number | null>(null);
  protected readonly teamGroupId = signal<number | null>(null);
  protected readonly teamFill = signal<TeamFillFilter>('all');
  protected readonly selectedTeamIds = signal<ReadonlySet<number>>(new Set());

  // ── Étape 2 : pool de bénévoles ────────────────────────────────────────────
  protected readonly volSearch = signal('');
  protected readonly volSkill = signal('');
  protected readonly volTag = signal('');
  protected readonly volPoleId = signal<number | null>(null);
  protected readonly volAssignment = signal<AssignmentFilter>('unassigned');
  protected readonly volResults = signal<RepartitionVolunteerRow[]>([]);
  protected readonly volTotal = signal(0);
  /** Pool cumulatif : les recherches successives s'y ajoutent. */
  protected readonly poolVolunteers = signal<ReadonlyMap<number, RepartitionVolunteerRow>>(new Map());

  // ── Étape 3 : affectation ──────────────────────────────────────────────────
  /** Équipe souhaitée par bénévole du pool (null = sans équipe). */
  protected readonly desired = signal<ReadonlyMap<number, number | null>>(new Map());
  /** État enregistré au moment d'entrer à l'étape 3 (pour diff et annulation). */
  private initial = new Map<number, number | null>();
  /** Bénévoles dont l'affectation en cours vient de la répartition auto. */
  protected readonly autoProposed = signal<ReadonlySet<number>>(new Set());
  /** Bénévoles sans solution au dernier calcul automatique. */
  protected readonly autoUnplaced = signal<number[]>([]);

  protected readonly POOL = POOL;

  ngOnInit(): void {
    this.api.repartitionFilters().subscribe({
      next: (filters) => this.filters.set(filters),
      error: (error) => this.fail(error),
    });
    this.reloadTeams();
  }

  // ── Étape 1 ────────────────────────────────────────────────────────────────

  protected reloadTeams(): void {
    this.loading.set(true);
    this.api.repartitionTeams().subscribe({
      next: (teams) => {
        this.allTeams.set(teams);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.fail(error);
      },
    });
  }

  protected readonly filteredTeams = computed(() => {
    const q = this.teamSearch().trim().toLowerCase();
    const hg = this.teamHostingGroupId();
    const g = this.teamGroupId();
    const fill = this.teamFill();
    return this.allTeams().filter(
      (t) =>
        (!q || t.name.toLowerCase().includes(q)) &&
        (hg === null || t.hostingGroupId === hg) &&
        (g === null || t.groupId === g) &&
        (fill === 'all' || (fill === 'free' ? t.free > 0 : t.free === 0)),
    );
  });

  protected readonly selectedTeams = computed(() =>
    this.allTeams().filter((t) => this.selectedTeamIds().has(t.id)),
  );

  protected readonly selectedFreeSeats = computed(() =>
    this.selectedTeams().reduce((sum, t) => sum + t.free, 0),
  );

  protected addTeam(id: number): void {
    this.selectedTeamIds.update((set) => new Set(set).add(id));
  }

  protected removeTeam(id: number): void {
    this.selectedTeamIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  protected addAllFilteredTeams(): void {
    this.selectedTeamIds.update((set) => {
      const next = new Set(set);
      for (const t of this.filteredTeams()) if (t.free > 0) next.add(t.id);
      return next;
    });
  }

  protected dropTeam(event: CdkDragDrop<number>): void {
    if (event.previousContainer === event.container) return;
    const id = (event.item.data as { teamId: number }).teamId;
    if (event.container.data === POOL) this.removeTeam(id);
    else this.addTeam(id);
  }

  // ── Étape 2 ────────────────────────────────────────────────────────────────

  protected searchVolunteers(): void {
    this.api
      .repartitionVolunteers({
        search: this.volSearch(),
        skill: this.volSkill(),
        tag: this.volTag(),
        poleId: this.volPoleId(),
        assignment: this.volAssignment(),
      })
      .subscribe({
        next: (result) => {
          this.volResults.set(result.volunteers);
          this.volTotal.set(result.total);
        },
        error: (error) => this.fail(error),
      });
  }

  protected addVolunteer(row: RepartitionVolunteerRow): void {
    this.poolVolunteers.update((map) => new Map(map).set(row.id, row));
  }

  protected removeVolunteer(id: number): void {
    this.poolVolunteers.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }

  protected addAllResultVolunteers(): void {
    this.poolVolunteers.update((map) => {
      const next = new Map(map);
      for (const row of this.volResults()) next.set(row.id, row);
      return next;
    });
  }

  protected readonly poolList = computed(() =>
    [...this.poolVolunteers().values()].sort(
      (a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'),
    ),
  );

  protected readonly poolUnassignedCount = computed(
    () => this.poolList().filter((v) => (this.desired().get(v.id) ?? v.teamId) === null).length,
  );

  // ── Navigation entre étapes ────────────────────────────────────────────────

  protected goToStep(target: 1 | 2 | 3): void {
    if (target === 2 && this.selectedTeamIds().size === 0) {
      this.notice.set({ kind: 'warning', text: 'Sélectionnez au moins une équipe à compléter.' });
      return;
    }
    if (target === 3 && this.poolVolunteers().size === 0) {
      this.notice.set({ kind: 'warning', text: 'Sélectionnez au moins un bénévole à répartir.' });
      return;
    }
    if (target === 2 && this.step() !== 2) this.searchVolunteers();
    if (target === 3 && this.step() !== 3) this.enterBoard();
    this.step.set(target);
  }

  private enterBoard(): void {
    const map = new Map<number, number | null>();
    for (const v of this.poolVolunteers().values()) map.set(v.id, v.teamId);
    this.initial = map;
    this.desired.set(new Map(map));
    this.autoProposed.set(new Set());
    this.autoUnplaced.set([]);
  }

  // ── Étape 3 : board ────────────────────────────────────────────────────────

  /** Équipe souhaitée d'un bénévole (en cours d'édition, pas encore enregistrée). */
  protected desiredTeamOf(volunteerId: number): number | null {
    return this.desired().get(volunteerId) ?? null;
  }

  protected isPending(volunteerId: number): boolean {
    return this.desiredTeamOf(volunteerId) !== (this.initial.get(volunteerId) ?? null);
  }

  /** Bénévoles du pool à afficher dans la colonne "pool" : tous, avec leur état. */
  protected readonly boardPoolUnassigned = computed(() =>
    this.poolList().filter((v) => this.desiredTeamOf(v.id) === null),
  );
  protected readonly boardPoolAssigned = computed(() =>
    this.poolList().filter((v) => this.desiredTeamOf(v.id) !== null),
  );

  /** Cartes d'une colonne d'équipe : confirmées (solides) + proposées (pointillés). */
  protected columnCards(teamId: number): { volunteer: RepartitionVolunteerRow; pending: boolean }[] {
    return this.poolList()
      .filter((v) => this.desiredTeamOf(v.id) === teamId)
      .map((volunteer) => ({ volunteer, pending: this.isPending(volunteer.id) }));
  }

  /** Effectif adulte affiché d'une équipe, affectations en cours incluses. */
  protected adultesWithPending(team: RepartitionTeamRow): number {
    let delta = 0;
    for (const v of this.poolVolunteers().values()) {
      const from = this.initial.get(v.id) ?? null;
      const to = this.desiredTeamOf(v.id);
      if (to === team.id && from !== team.id) delta += 1;
      if (from === team.id && to !== team.id) delta -= 1;
    }
    return team.adultes + delta;
  }

  protected freeWithPending(team: RepartitionTeamRow): number {
    return Math.max(0, team.maxSize - team.jeunes - this.adultesWithPending(team));
  }

  protected percent(used: number, max: number): number {
    return max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  }

  protected teamOptions(): SelectOption<number>[] {
    return [
      { value: POOL, label: 'Sans équipe' },
      ...this.selectedTeams().map((t) => ({ value: t.id, label: t.name })),
    ];
  }

  /** Toutes les listes du board, pour autoriser les glisser-déposer croisés. */
  protected readonly boardListIds = computed(() => [
    'vol-pool',
    ...this.selectedTeams().map((t) => `vol-team-${t.id}`),
  ]);

  protected setDesired(volunteerId: number, teamId: number | null): void {
    const target = teamId === POOL ? null : teamId;
    if (target !== null) {
      const team = this.selectedTeams().find((t) => t.id === target);
      if (team && this.freeWithPending(team) <= 0 && this.desiredTeamOf(volunteerId) !== target) {
        this.notice.set({ kind: 'warning', text: `${team.name} est complète : aucune place libre.` });
        return;
      }
    }
    this.desired.update((map) => new Map(map).set(volunteerId, target));
    this.autoProposed.update((set) => {
      if (!set.has(volunteerId)) return set;
      const next = new Set(set);
      next.delete(volunteerId);
      return next;
    });
  }

  protected dropVolunteer(event: CdkDragDrop<number>): void {
    if (event.previousContainer === event.container) return;
    const volunteerId = (event.item.data as { volunteerId: number }).volunteerId;
    const target = event.container.data;
    this.setDesired(volunteerId, target === POOL ? null : target);
  }

  protected readonly pendingChanges = computed(
    () => this.poolList().filter((v) => this.isPending(v.id)).length,
  );

  // ── Répartition automatique (aperçu, corrections, validation) ─────────────

  protected computeAuto(): void {
    const candidates = this.poolList().filter((v) => this.desiredTeamOf(v.id) === null);
    const teams = this.selectedTeams().map((t) => ({
      id: t.id,
      name: t.name,
      used: t.jeunes + this.adultesWithPending(t),
      maxSize: t.maxSize,
    }));
    const result = autoProposal(candidates, teams);
    this.desired.update((map) => {
      const next = new Map(map);
      for (const [volunteerId, teamId] of result.proposals) next.set(volunteerId, teamId);
      return next;
    });
    this.autoProposed.set(new Set(result.proposals.keys()));
    this.autoUnplaced.set(result.unplaced);
    this.notice.set({
      kind: 'info',
      text: result.proposals.size
        ? `Proposition : ${result.proposals.size} affectation(s). Aucun enregistrement tant que vous ne validez pas.`
        : 'Aucune affectation à proposer.',
    });
  }

  protected recalcAuto(): void {
    // Réinitialise les propositions auto précédentes puis recalcule.
    this.desired.update((map) => {
      const next = new Map(map);
      for (const id of this.autoProposed()) next.set(id, this.initial.get(id) ?? null);
      return next;
    });
    this.autoProposed.set(new Set());
    this.autoUnplaced.set([]);
    this.computeAuto();
  }

  protected resetBoard(): void {
    this.desired.set(new Map(this.initial));
    this.autoProposed.set(new Set());
    this.autoUnplaced.set([]);
    this.notice.set(null);
  }

  protected validate(): void {
    const entries = this.poolList()
      .filter((v) => this.isPending(v.id))
      .map((v) => ({ volunteerId: v.id, teamId: this.desiredTeamOf(v.id) }));
    if (entries.length === 0) return;
    this.run(this.api.applyRepartition(entries), (result) => {
      this.notice.set({ kind: 'info', text: `${result.applied} affectation(s) enregistrée(s).` });
      // L'état validé devient la référence ; les compteurs d'équipes sont rechargés.
      this.initial = new Map(this.desired());
      this.autoProposed.set(new Set());
      this.autoUnplaced.set([]);
      this.poolVolunteers.update((map) => {
        const next = new Map(map);
        for (const [id, row] of next) {
          const teamId = this.desiredTeamOf(id);
          const team = this.selectedTeams().find((t) => t.id === teamId);
          next.set(id, { ...row, teamId, teamName: team?.name ?? row.teamName });
        }
        return next;
      });
      this.reloadTeams();
    });
  }

  // ── Filtres : options ──────────────────────────────────────────────────────

  protected readonly hostingGroupOptions = computed<SelectOption<number>[]>(() => [
    { value: 0, label: 'Toutes' },
    ...(this.filters()?.hostingGroups ?? []).map((g) => ({ value: g.id, label: g.name })),
  ]);
  protected readonly groupOptions = computed<SelectOption<number>[]>(() => [
    { value: 0, label: 'Tous' },
    ...(this.filters()?.groups ?? []).map((g) => ({ value: g.id, label: g.name })),
  ]);
  protected readonly poleOptions = computed<SelectOption<number>[]>(() => [
    { value: 0, label: 'Tous' },
    ...(this.filters()?.poles ?? []).map((p) => ({ value: p.id, label: p.name })),
  ]);
  protected readonly skillOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Toutes' },
    ...(this.filters()?.skills ?? []).map((s) => ({ value: s, label: SKILL_LABELS[s] ?? s })),
  ]);
  protected readonly tagOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Toutes' },
    ...(this.filters()?.tags ?? []).map((t) => ({ value: t, label: t })),
  ]);
  protected readonly assignmentOptions: SelectOption<string>[] = [
    { value: 'unassigned', label: 'Sans équipe d’abord' },
    { value: 'assigned', label: 'Déjà affectés' },
    { value: 'all', label: 'Tous' },
  ];
  protected readonly fillOptions: SelectOption<string>[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'free', label: 'Places libres' },
    { value: 'full', label: 'Complètes' },
  ];

  protected skillLabel(skill: string): string {
    return SKILL_LABELS[skill] ?? skill;
  }

  protected setTeamFill(value: string | null): void {
    this.teamFill.set(value === 'free' || value === 'full' ? value : 'all');
  }

  protected setVolAssignment(value: string | null): void {
    this.volAssignment.set(value === 'all' || value === 'assigned' ? value : 'unassigned');
  }

  protected volunteerName(v: RepartitionVolunteerRow): string {
    return `${v.firstName} ${v.lastName}`;
  }

  protected trackTeam(_: number, t: RepartitionTeamRow): number {
    return t.id;
  }

  protected trackVolunteer(_: number, v: RepartitionVolunteerRow): number {
    return v.id;
  }

  // ── Utilitaires ────────────────────────────────────────────────────────────

  private fail(error: unknown): void {
    const message =
      error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : "L'action a échoué. Rien n'a été modifié.";
    this.notice.set({ kind: 'error', text: message });
  }

  private run<T>(request: Observable<T>, onSuccess: (value: T) => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.notice.set(null);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        onSuccess(value);
      },
      error: (error) => {
        this.busy.set(false);
        this.fail(error);
      },
    });
  }
}
