import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { TuiInput } from '@taiga-ui/core';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import {
  JeunesRepartitionFilters,
  JeunesRepartitionParticipantRow,
  JeunesRepartitionParams,
  JeunesRepartitionTeamRow,
  JeunesProposalViolation,
  MejAgeGroup,
} from '../../models/models';
import { JeunesRepartitionApiService } from '../../services/api.services';
import {
  DEFAULT_PARAMS,
  buildApplyEntries,
  displayName,
  isPending,
  originLabel,
  sexShort,
  teamCountsWithPending,
} from './jeunes-repartition.logic';

type Notice = { kind: 'error' | 'info' | 'warning'; text: string };
type TeamFillFilter = 'all' | 'free' | 'full';
type AssignmentFilter = 'all' | 'unassigned' | 'assigned';
type ParticipantTypeFilter = 'all' | 'JEUNE' | 'ANIMATEUR';

/** Colonne « pool » du board (participant sans équipe choisie). */
const POOL = 0;

@Component({
  selector: 'app-jeunes-repartition',
  standalone: true,
  imports: [...SHARED_IMPORTS, FormsModule, ...TuiInput, SelectFieldComponent, CdkDropList, CdkDrag, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './jeunes-repartition.html',
  styleUrl: './jeunes-repartition.scss',
})
export class JeunesRepartitionPage implements OnInit {
  private readonly api = inject(JeunesRepartitionApiService);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<Notice | null>(null);
  protected readonly step = signal<1 | 2 | 3>(1);
  protected readonly filters = signal<JeunesRepartitionFilters | null>(null);

  // ── Étape 1 : pool de participants ────────────────────────────────────────
  protected readonly pSearch = signal('');
  protected readonly pType = signal<ParticipantTypeFilter>('all');
  protected readonly pAgeGroup = signal('');
  protected readonly pSex = signal('');
  protected readonly pGroupId = signal<number | null>(null);
  protected readonly pCity = signal('');
  protected readonly pDiocese = signal('');
  protected readonly pAssignment = signal<AssignmentFilter>('unassigned');
  protected readonly pResults = signal<JeunesRepartitionParticipantRow[]>([]);
  protected readonly pTotal = signal(0);
  protected readonly pLoading = signal(false);
  /** Pool cumulatif : les recherches successives s'y ajoutent. */
  protected readonly poolParticipants = signal<ReadonlyMap<number, JeunesRepartitionParticipantRow>>(
    new Map(),
  );

  // ── Étape 2 : équipes ─────────────────────────────────────────────────────
  protected readonly allTeams = signal<JeunesRepartitionTeamRow[]>([]);
  protected readonly tSearch = signal('');
  protected readonly tGroupId = signal<number | null>(null);
  protected readonly tFill = signal<TeamFillFilter>('all');
  protected readonly selectedTeamIds = signal<ReadonlySet<number>>(new Set());
  protected readonly createCount = signal(8);
  protected readonly createBaseName = signal('Équipe');
  protected readonly createMaxSize = signal(12);

  // ── Étape 3 : critères + board ────────────────────────────────────────────
  protected readonly jeunesPerTeam = signal(DEFAULT_PARAMS.jeunesPerTeam);
  protected readonly adultsPerTeam = signal(DEFAULT_PARAMS.adultsPerTeam);
  protected readonly ageMode = signal<JeunesRepartitionParams['ageMode']>(DEFAULT_PARAMS.ageMode);
  protected readonly sexMode = signal<JeunesRepartitionParams['sexMode']>(DEFAULT_PARAMS.sexMode);
  protected readonly geoGranularity = signal<JeunesRepartitionParams['geoGranularity']>(
    DEFAULT_PARAMS.geoGranularity,
  );
  protected readonly geoMaxPerTeam = signal(DEFAULT_PARAMS.geoMaxPerTeam);
  protected readonly separateAnimators = signal(DEFAULT_PARAMS.separateAnimators);
  protected readonly moveAssigned = signal(DEFAULT_PARAMS.moveAssigned);

  /** Équipe souhaitée par participant du pool (null = sans équipe). */
  protected readonly desired = signal<ReadonlyMap<number, number | null>>(new Map());
  /** État enregistré au moment d'entrer à l'étape 3 (diff et annulation). */
  private initial = new Map<number, number | null>();
  protected readonly autoProposed = signal<ReadonlySet<number>>(new Set());
  protected readonly autoUnplaced = signal<number[]>([]);
  protected readonly violations = signal<JeunesProposalViolation[]>([]);

  protected readonly POOL = POOL;

  ngOnInit(): void {
    this.api.repartitionFilters().subscribe({
      next: (filters) => this.filters.set(filters),
      error: (error) => this.fail(error),
    });
    this.searchParticipants();
    this.reloadTeams();
  }

  // ── Étape 1 : participants ────────────────────────────────────────────────

  private participantFilters() {
    return {
      search: this.pSearch(),
      type: this.pType(),
      ageGroup: this.pAgeGroup(),
      sex: this.pSex(),
      groupId: this.pGroupId(),
      city: this.pCity(),
      diocese: this.pDiocese(),
      assignment: this.pAssignment(),
    };
  }

  protected searchParticipants(append = false): void {
    this.pLoading.set(true);
    this.api
      .participants({
        ...this.participantFilters(),
        offset: append ? this.pResults().length : 0,
        limit: 100,
      })
      .subscribe({
        next: (result) => {
          this.pResults.update((rows) =>
            append ? [...rows, ...result.participants] : result.participants,
          );
          this.pTotal.set(result.total);
          this.pLoading.set(false);
        },
        error: (error) => {
          this.pLoading.set(false);
          this.fail(error);
        },
      });
  }

  protected addParticipant(row: JeunesRepartitionParticipantRow): void {
    this.poolParticipants.update((map) => new Map(map).set(row.id, row));
  }

  protected removeParticipant(id: number): void {
    this.poolParticipants.update((map) => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }

  /** « Tout ajouter » : récupère toutes les correspondances du filtre courant. */
  protected async addAllResultParticipants(): Promise<void> {
    this.pLoading.set(true);
    try {
      const rows = [...this.pResults()];
      while (rows.length < this.pTotal()) {
        const result = await firstValueFrom(
          this.api.participants({ ...this.participantFilters(), offset: rows.length, limit: 1000 }),
        );
        if (result.participants.length === 0) break;
        rows.push(...result.participants);
        this.pTotal.set(result.total);
      }
      this.pResults.set(rows);
      this.poolParticipants.update((map) => {
        const next = new Map(map);
        for (const row of rows) next.set(row.id, row);
        return next;
      });
    } catch (error) {
      this.fail(error);
    } finally {
      this.pLoading.set(false);
    }
  }

  protected dropParticipant(event: CdkDragDrop<number>): void {
    if (event.previousContainer === event.container) return;
    const row = event.item.data as JeunesRepartitionParticipantRow;
    if (event.container.data === POOL) this.addParticipant(row);
  }

  protected readonly poolList = computed(() =>
    [...this.poolParticipants().values()].sort(
      (a, b) =>
        (a.type === b.type ? 0 : a.type === 'ANIMATEUR' ? 1 : -1) ||
        a.firstName.localeCompare(b.firstName, 'fr') ||
        a.id - b.id,
    ),
  );

  protected readonly poolJeunesCount = computed(
    () => this.poolList().filter((p) => p.type === 'JEUNE').length,
  );
  protected readonly poolAdultesCount = computed(
    () => this.poolList().filter((p) => p.type === 'ANIMATEUR').length,
  );

  // ── Étape 2 : équipes ─────────────────────────────────────────────────────

  protected reloadTeams(): void {
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
    const q = this.tSearch().trim().toLowerCase();
    const g = this.tGroupId();
    const fill = this.tFill();
    return this.allTeams().filter(
      (t) =>
        (!q || t.name.toLowerCase().includes(q)) &&
        (g === null || t.groupId === g) &&
        (fill === 'all' || (fill === 'free' ? t.totalCount < t.maxSize : t.totalCount >= t.maxSize)),
    );
  });

  protected readonly selectedTeams = computed(() =>
    this.allTeams().filter((t) => this.selectedTeamIds().has(t.id)),
  );

  protected readonly selectedFreeSeats = computed(() =>
    this.selectedTeams().reduce((sum, t) => sum + Math.max(0, t.maxSize - t.totalCount), 0),
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
      for (const t of this.filteredTeams()) if (t.totalCount < t.maxSize) next.add(t.id);
      return next;
    });
  }

  protected dropTeam(event: CdkDragDrop<number>): void {
    if (event.previousContainer === event.container) return;
    const id = (event.item.data as { teamId: number }).teamId;
    if (event.container.data === POOL) this.removeTeam(id);
    else this.addTeam(id);
  }

  /** Étape 2 : création de X équipes vides, ajoutées à la sélection. */
  protected createTeams(): void {
    const count = Math.floor(this.createCount());
    if (!Number.isFinite(count) || count < 1) {
      this.notice.set({ kind: 'warning', text: 'Indiquez un nombre d’équipes à créer (1 minimum).' });
      return;
    }
    this.run(
      this.api.bulkCreateTeams({
        count,
        baseName: this.createBaseName(),
        maxSize: Math.floor(this.createMaxSize()) || 12,
      }),
      (result) => {
        this.notice.set({
          kind: 'info',
          text: `${result.created.length} équipe(s) vide(s) créée(s) : ${result.created
            .map((t) => t.name)
            .join(', ')}.`,
        });
        this.selectedTeamIds.update((set) => {
          const next = new Set(set);
          for (const t of result.created) next.add(t.id);
          return next;
        });
        this.reloadTeams();
      },
    );
  }

  // ── Navigation entre étapes ────────────────────────────────────────────────

  protected goToStep(target: 1 | 2 | 3): void {
    if (target === 2 && this.poolParticipants().size === 0) {
      this.notice.set({ kind: 'warning', text: 'Sélectionnez au moins un jeune ou un animateur.' });
      return;
    }
    if (target === 3 && this.selectedTeamIds().size === 0) {
      this.notice.set({ kind: 'warning', text: 'Sélectionnez au moins une équipe à compléter.' });
      return;
    }
    if (target === 3 && this.step() !== 3) this.enterBoard();
    this.step.set(target);
  }

  private enterBoard(): void {
    const map = new Map<number, number | null>();
    for (const p of this.poolParticipants().values()) map.set(p.id, p.teamId);
    this.initial = map;
    this.desired.set(new Map(map));
    this.autoProposed.set(new Set());
    this.autoUnplaced.set([]);
    this.violations.set([]);
  }

  // ── Étape 3 : board ────────────────────────────────────────────────────────

  protected desiredTeamOf(participantId: number): number | null {
    return this.desired().get(participantId) ?? null;
  }

  protected isPending(participantId: number): boolean {
    return isPending(participantId, this.desired(), this.initial);
  }

  protected readonly boardPoolUnassigned = computed(() =>
    this.poolList().filter((p) => this.desiredTeamOf(p.id) === null),
  );
  /** Pool membres dont l'équipe (actuelle ou souhaitée) n'est pas dans la sélection. */
  protected readonly boardPoolOutside = computed(() =>
    this.poolList().filter((p) => {
      const teamId = this.desiredTeamOf(p.id);
      return teamId !== null && !this.selectedTeamIds().has(teamId);
    }),
  );

  protected columnCards(
    teamId: number,
  ): { participant: JeunesRepartitionParticipantRow; pending: boolean }[] {
    return this.poolList()
      .filter((p) => this.desiredTeamOf(p.id) === teamId)
      .map((participant) => ({ participant, pending: this.isPending(participant.id) }));
  }

  protected teamCounts(team: JeunesRepartitionTeamRow) {
    return teamCountsWithPending(team, this.poolList(), this.desired(), this.initial);
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

  protected readonly boardListIds = computed(() => [
    'jeune-pool',
    ...this.selectedTeams().map((t) => `jeune-team-${t.id}`),
  ]);

  protected setDesired(participantId: number, teamId: number | null): void {
    const target = teamId === POOL ? null : teamId;
    if (target !== null) {
      const team = this.selectedTeams().find((t) => t.id === target);
      if (team && this.teamCounts(team).free <= 0 && this.desiredTeamOf(participantId) !== target) {
        this.notice.set({ kind: 'warning', text: `${team.name} est complète : aucune place libre.` });
        return;
      }
    }
    this.desired.update((map) => new Map(map).set(participantId, target));
    this.autoProposed.update((set) => {
      if (!set.has(participantId)) return set;
      const next = new Set(set);
      next.delete(participantId);
      return next;
    });
  }

  protected dropOnBoard(event: CdkDragDrop<number>): void {
    if (event.previousContainer === event.container) return;
    const participantId = (event.item.data as { participantId: number }).participantId;
    const target = event.container.data;
    this.setDesired(participantId, target === POOL ? null : target);
  }

  protected readonly pendingChanges = computed(
    () => this.poolList().filter((p) => this.isPending(p.id)).length,
  );

  // ── Répartition automatique (proposition API, corrections, validation) ─────

  private currentParams(): JeunesRepartitionParams {
    return {
      jeunesPerTeam: Math.max(1, Math.floor(this.jeunesPerTeam()) || DEFAULT_PARAMS.jeunesPerTeam),
      adultsPerTeam: Math.max(0, Math.floor(this.adultsPerTeam()) ?? DEFAULT_PARAMS.adultsPerTeam),
      ageMode: this.ageMode(),
      sexMode: this.sexMode(),
      geoGranularity: this.geoGranularity(),
      geoMaxPerTeam: Math.max(1, Math.floor(this.geoMaxPerTeam()) || 1),
      separateAnimators: this.separateAnimators(),
      moveAssigned: this.moveAssigned(),
    };
  }

  protected computeAuto(): void {
    this.run(
      this.api.propose(
        [...this.poolParticipants().keys()],
        [...this.selectedTeamIds()],
        this.currentParams(),
      ),
      (result) => {
        this.desired.update((map) => {
          const next = new Map(map);
          for (const proposal of result.proposals) next.set(proposal.participantId, proposal.teamId);
          return next;
        });
        this.autoProposed.set(new Set(result.proposals.map((p) => p.participantId)));
        this.autoUnplaced.set(result.unplaced);
        this.violations.set(result.violations);
        this.notice.set({
          kind: 'info',
          text: result.proposals.length
            ? `Proposition : ${result.proposals.length} affectation(s). Rien n'est enregistré tant que vous ne validez pas.`
            : 'Aucune affectation à proposer.',
        });
      },
    );
  }

  protected recalcAuto(): void {
    this.desired.update((map) => {
      const next = new Map(map);
      for (const id of this.autoProposed()) next.set(id, this.initial.get(id) ?? null);
      return next;
    });
    this.autoProposed.set(new Set());
    this.autoUnplaced.set([]);
    this.violations.set([]);
    this.computeAuto();
  }

  protected resetBoard(): void {
    this.desired.set(new Map(this.initial));
    this.autoProposed.set(new Set());
    this.autoUnplaced.set([]);
    this.violations.set([]);
    this.notice.set(null);
  }

  protected validate(): void {
    const entries = buildApplyEntries(
      this.poolParticipants().keys(),
      this.desired(),
      this.initial,
    );
    if (entries.length === 0) return;
    this.run(this.api.apply(entries), (result) => {
      this.notice.set({ kind: 'info', text: `${result.applied} affectation(s) enregistrée(s).` });
      this.initial = new Map(this.desired());
      this.autoProposed.set(new Set());
      this.autoUnplaced.set([]);
      this.violations.set([]);
      this.poolParticipants.update((map) => {
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

  protected readonly groupOptions = computed<SelectOption<number>[]>(() => [
    { value: 0, label: 'Tous' },
    ...(this.filters()?.groups ?? []).map((g) => ({ value: g.id, label: g.name })),
  ]);
  protected readonly cityOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Toutes' },
    ...(this.filters()?.cities ?? []).map((c) => ({ value: c, label: c })),
  ]);
  protected readonly dioceseOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Tous' },
    ...(this.filters()?.dioceses ?? []).map((d) => ({ value: d, label: d })),
  ]);
  protected readonly ageGroupOptions = computed<SelectOption<string>[]>(() => [
    { value: '', label: 'Toutes' },
    ...(this.filters()?.ageGroups ?? []).map((a) => ({ value: a, label: a })),
  ]);
  protected readonly typeOptions: SelectOption<string>[] = [
    { value: 'all', label: 'Jeunes + animateurs' },
    { value: 'JEUNE', label: 'Jeunes' },
    { value: 'ANIMATEUR', label: 'Animateurs' },
  ];
  protected readonly sexOptions: SelectOption<string>[] = [
    { value: '', label: 'Tous' },
    { value: 'FEMALE', label: 'Filles' },
    { value: 'MALE', label: 'Garçons' },
  ];
  protected readonly assignmentOptions: SelectOption<string>[] = [
    { value: 'unassigned', label: 'Sans équipe' },
    { value: 'assigned', label: 'Déjà affectés' },
    { value: 'all', label: 'Tous' },
  ];
  protected readonly fillOptions: SelectOption<string>[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'free', label: 'Places libres' },
    { value: 'full', label: 'Complètes' },
  ];
  protected readonly ageModeOptions: SelectOption<string>[] = [
    { value: 'mixed', label: 'Âges mélangés' },
    { value: 'tranches', label: 'Par tranches d’âge (TA/ES)' },
    { value: 'same-age', label: 'Même âge' },
  ];
  protected readonly sexModeOptions: SelectOption<string>[] = [
    { value: 'balanced', label: 'Équilibrée' },
    { value: 'non-mixed', label: 'Non mixte (filles ou garçons)' },
    { value: 'none', label: 'Sans critère' },
  ];
  protected readonly geoGranularityOptions: SelectOption<string>[] = [
    { value: 'group', label: 'par groupe d’origine' },
    { value: 'city', label: 'par ville' },
    { value: 'diocese', label: 'par diocèse' },
  ];
  protected readonly moveAssignedOptions: SelectOption<string>[] = [
    { value: 'no', label: 'Ne pas déplacer' },
    { value: 'yes', label: 'Autoriser le déplacement' },
  ];
  protected readonly separateAnimatorsOptions: SelectOption<string>[] = [
    { value: 'yes', label: 'Oui' },
    { value: 'no', label: 'Non' },
  ];

  protected setPType(value: string | null): void {
    this.pType.set(value === 'JEUNE' || value === 'ANIMATEUR' ? value : 'all');
    this.searchParticipants();
  }
  protected setPAgeGroup(value: string | null): void {
    this.pAgeGroup.set(value === MejAgeGroup.TA || value === MejAgeGroup.ES ? value : '');
    this.searchParticipants();
  }
  protected setPAssignment(value: string | null): void {
    this.pAssignment.set(value === 'all' || value === 'assigned' ? value : 'unassigned');
    this.searchParticipants();
  }
  protected setTFill(value: string | null): void {
    this.tFill.set(value === 'free' || value === 'full' ? value : 'all');
  }
  protected setAgeMode(value: string | null): void {
    if (value === 'tranches' || value === 'same-age' || value === 'mixed') this.ageMode.set(value);
  }
  protected setSexMode(value: string | null): void {
    if (value === 'balanced' || value === 'non-mixed' || value === 'none') this.sexMode.set(value);
  }
  protected setGeoGranularity(value: string | null): void {
    if (value === 'group' || value === 'city' || value === 'diocese') this.geoGranularity.set(value);
  }
  protected setMoveAssigned(value: string | null): void {
    this.moveAssigned.set(value === 'yes');
  }
  protected setSeparateAnimators(value: string | null): void {
    this.separateAnimators.set(value !== 'no');
  }

  // ── Affichage ──────────────────────────────────────────────────────────────

  protected readonly displayName = displayName;
  protected readonly sexShort = sexShort;

  protected originOf(row: JeunesRepartitionParticipantRow): string {
    return originLabel(row, this.geoGranularity());
  }

  protected trackTeam(_: number, t: JeunesRepartitionTeamRow): number {
    return t.id;
  }

  protected trackParticipant(_: number, p: JeunesRepartitionParticipantRow): number {
    return p.id;
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
