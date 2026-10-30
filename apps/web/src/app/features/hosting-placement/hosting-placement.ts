import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ALLEGRIA_2027_EVENT_DATES } from '../../shared/event-date-selector/event-date.config';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { TuiCheckbox, TuiInput } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';
import { HostingPlacementApiService } from './hosting-placement.api';
import {
  REASON_LABELS,
  familiesOfGroup,
  FILL_LABELS,
  GroupFillState,
  familyLoad,
  groupFill,
  groupStats,
  isMinorAt,
  needsReview,
  teamsOfGroup,
  unplacedMembers,
} from './hosting-placement.logic';
import {
  AutoPlaceResult,
  Board,
  BoardFamily,
  BoardMember,
  PlacementRules,
  SexMixingRule,
} from './hosting-placement.models';

type DragItem = { kind: 'team' | 'family'; id: number };
type Notice = { kind: 'error' | 'info' | 'warning'; text: string };

/** Identifiant de liste "Non affectés" (aucun groupe). */
const NONE = 0;
const HIDDEN_KEY = 'allegria.placement.hiddenColumns';
export type FillFilter = 'all' | GroupFillState;

@Component({
  selector: 'app-hosting-placement',
  standalone: true,
  imports: [...SHARED_IMPORTS, FormsModule, ...TuiInput, TuiCheckbox, TuiChip, SelectFieldComponent, CdkDropList, CdkDrag, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hosting-placement.html',
  styleUrl: './hosting-placement.scss',
})
export class HostingPlacementPage implements OnInit {
  private readonly api = inject(HostingPlacementApiService);

  protected readonly board = signal<Board | null>(null);
  protected readonly loading = signal(true);
  protected readonly step = signal<1 | 2>(1);
  protected readonly notice = signal<Notice | null>(null);
  protected readonly selectedGroupId = signal<number | null>(null);
  protected readonly selectedMemberId = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly newGroupName = signal('');

  /** Dates du séjour : celles de l'événement configurées dans l'application, modifiables. */
  protected readonly arrivalDate = signal(this.eventStart());
  protected readonly departureDate = signal(ALLEGRIA_2027_EVENT_DATES.endDate);
  /** Règles non confirmées par l'organisation : aucune valeur par défaut, il faut choisir. */
  protected readonly countAnimators = signal<boolean | null>(null);
  protected readonly sexMixing = signal<SexMixingRule | null>(null);
  protected readonly rulesChosen = computed(() => this.countAnimators() !== null && this.sexMixing() !== null);
  protected readonly preview = signal<AutoPlaceResult | null>(null);

  protected readonly NONE = NONE;
  protected readonly reasonLabels = REASON_LABELS;
  protected readonly needsReview = needsReview;

  protected readonly groups = computed(() => this.board()?.hostingGroups ?? []);
  protected readonly fillLabels = FILL_LABELS;
  protected readonly animatorOptions: SelectOption<string>[] = [
    { value: '', label: '— choisir —' },
    { value: 'yes', label: 'Oui : jeunes et animateurs comptent ensemble' },
    { value: 'no', label: 'Non : seuls les jeunes comptent' },
  ];
  protected readonly mixingOptions: SelectOption<string>[] = [
    { value: '', label: '— choisir —' },
    { value: 'ignore', label: 'Aucune règle' },
    { value: 'avoid', label: 'Éviter si possible' },
    { value: 'forbid', label: 'Interdire' },
  ];
  protected readonly groupOptions = computed<SelectOption<number>[]>(() => [
    { value: 0, label: 'Non affectée' },
    ...this.groups().map((g) => ({ value: g.id, label: g.name })),
  ]);
  protected readonly realGroupOptions = computed<SelectOption<number>[]>(() =>
    this.groups().map((g) => ({ value: g.id, label: g.name })),
  );
  protected readonly fillFilters: { id: FillFilter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'empty', label: 'Vides' },
    { id: 'under', label: 'Places libres' },
    { id: 'full', label: 'Complets' },
    { id: 'over', label: 'Trop pleins' },
  ];
  protected readonly fillFilter = signal<FillFilter>('all');
  protected readonly groupSearch = signal('');
  /** Colonnes masquées dans la vue de placement (mémorisées dans le navigateur). */
  protected readonly hiddenIds = signal<ReadonlySet<number>>(this.loadHidden());

  /** Une ligne par groupe, avec disponibilité et état de remplissage. */
  protected readonly groupRows = computed(() => {
    const b = this.board();
    if (!b) return [];
    return this.groups().map((group) => {
      const stats = groupStats(b, group.id);
      return { group, stats, fill: groupFill(stats) };
    });
  });
  protected readonly fillCounts = computed(() => {
    const counts: Record<FillFilter, number> = { all: 0, empty: 0, under: 0, full: 0, over: 0 };
    for (const row of this.groupRows()) {
      counts.all += 1;
      counts[row.fill.state] += 1;
    }
    return counts;
  });
  protected readonly filteredGroupRows = computed(() => {
    const filter = this.fillFilter();
    const q = this.groupSearch().trim().toLowerCase();
    return this.groupRows().filter(
      (r) => (filter === 'all' || r.fill.state === filter) && (!q || r.group.name.toLowerCase().includes(q)),
    );
  });
  protected readonly columnIds = computed(() => [NONE, ...this.groups().map((g) => g.id)]);
  protected readonly visibleColumnIds = computed(() => this.columnIds().filter((id) => !this.hiddenIds().has(id)));
  protected readonly hiddenCount = computed(() => this.columnIds().filter((id) => this.hiddenIds().has(id)).length);
  protected readonly teamListIds = computed(() => this.visibleColumnIds().map((id) => `teams-${id}`));
  protected readonly poolConnections = computed(() => [
    'pool',
    ...this.groupFamilies().map((row) => `family-${row.family.id}`),
  ]);
  protected readonly familyListIds = computed(() => this.visibleColumnIds().map((id) => `families-${id}`));

  protected readonly summary = computed(() => {
    const b = this.board();
    if (!b) return null;
    return {
      teamsWithout: teamsOfGroup(b, null).length,
      familiesWithout: familiesOfGroup(b, null).length,
      toPlace: b.members.filter((m) => m.hostFamilyId === null).length,
      conflicts: b.conflicts.length,
    };
  });

  protected readonly selectedGroup = computed(() => {
    const id = this.selectedGroupId();
    return this.groups().find((g) => g.id === id) ?? null;
  });

  protected readonly groupFamilies = computed(() => {
    const b = this.board();
    const id = this.selectedGroupId();
    if (!b || id === null) return [];
    return familiesOfGroup(b, id).map((family) => ({
      family,
      load: familyLoad(b, family, this.arrivalDate()),
      ghosts: this.ghostsOf(family.id),
    }));
  });

  protected readonly pool = computed(() => {
    const b = this.board();
    const id = this.selectedGroupId();
    return b && id !== null ? unplacedMembers(b, id) : [];
  });

  protected readonly poolByTeam = computed(() => {
    const b = this.board();
    const names = new Map((b?.teams ?? []).map((t) => [t.id, t.name]));
    const result: { teamId: number; teamName: string; members: BoardMember[] }[] = [];
    for (const member of this.pool()) {
      const last = result[result.length - 1];
      if (last && last.teamId === member.teamId) last.members.push(member);
      else result.push({ teamId: member.teamId, teamName: names.get(member.teamId) ?? '', members: [member] });
    }
    return result;
  });

  protected readonly poolTeams = computed(() =>
    this.board() && this.selectedGroupId() !== null
      ? teamsOfGroup(this.board() as Board, this.selectedGroupId())
      : [],
  );

  protected readonly selectedMember = computed(() => {
    const id = this.selectedMemberId();
    return this.board()?.members.find((m) => m.participantId === id) ?? null;
  });

  protected readonly conflictRows = computed(() => {
    const b = this.board();
    if (!b) return [];
    const members = new Map(b.members.map((m) => [m.participantId, m]));
    const families = new Map(b.families.map((f) => [f.id, f]));
    return b.conflicts.map((c) => ({
      name: `${members.get(c.participantId)?.firstName ?? ''} ${members.get(c.participantId)?.lastName ?? ''}`.trim(),
      family: families.get(c.hostFamilyId)?.familyName ?? '',
      reason: c.reason,
    }));
  });

  private readonly classified = computed(() => {
    const b = this.board();
    if (!b) return { group: [] as ReturnType<HostingPlacementPage['conflictRows']>, uninit: 0, other: 0 };
    const teams = new Map(b.teams.map((x) => [x.id, x]));
    const families = new Map(b.families.map((f) => [f.id, f]));
    const sel = this.selectedGroupId();
    const rows = this.conflictRows();
    const group: typeof rows = [];
    let uninit = 0;
    let other = 0;
    b.conflicts.forEach((c, i) => {
      const tg = teams.get(c.teamId)?.hostingGroupId ?? null;
      const fg = families.get(c.hostFamilyId)?.hostingGroupId ?? null;
      if (tg === null || fg === null) uninit += 1;
      else if (tg === sel || fg === sel) group.push(rows[i]);
      else other += 1;
    });
    return { group, uninit, other };
  });
  protected readonly groupConflicts = computed(() => this.classified().group);
  protected readonly uninitialisedCount = computed(() => this.classified().uninit);
  protected readonly otherGroupConflicts = computed(() => this.classified().other);

  ngOnInit(): void {
    this.reload();
  }

  protected groupById(id: number) {
    return this.groups().find((g) => g.id === id) ?? null;
  }

  protected isShown(id: number): boolean {
    return !this.hiddenIds().has(id);
  }

  protected setShown(id: number, shown: boolean): void {
    this.setHidden((set) => (shown ? set.delete(id) : set.add(id)));
  }

  /** Affiche ou masque d'un coup les groupes actuellement listés (après filtre). */
  protected showListed(shown: boolean): void {
    const ids = this.filteredGroupRows().map((r) => r.group.id);
    this.setHidden((set) => ids.forEach((id) => (shown ? set.delete(id) : set.add(id))));
  }

  protected showOnly(id: number): void {
    this.setHidden((set) => {
      set.clear();
      this.columnIds().filter((c) => c !== id).forEach((c) => set.add(c));
    });
  }

  private setHidden(mutate: (set: Set<number>) => void): void {
    const next = new Set(this.hiddenIds());
    mutate(next);
    this.hiddenIds.set(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      /* stockage indisponible : la préférence reste valable pour la session */
    }
  }

  private loadHidden(): ReadonlySet<number> {
    try {
      const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
      return new Set(Array.isArray(raw) ? raw.filter((x): x is number => typeof x === 'number') : []);
    } catch {
      return new Set();
    }
  }

  protected kindLabel(kind: string | undefined): string {
    return kind === 'ZONE' ? 'zone' : kind === 'PARISH' ? 'paroisse' : '';
  }

  protected stats(groupId: number | null) {
    const b = this.board();
    return b ? groupStats(b, groupId) : { teams: 0, families: 0, people: 0, placed: 0, seats: 0 };
  }

  protected teamsIn(groupId: number | null) {
    const b = this.board();
    return b ? teamsOfGroup(b, groupId) : [];
  }

  protected familiesIn(groupId: number | null) {
    const b = this.board();
    return b ? familiesOfGroup(b, groupId) : [];
  }

  protected isMinor(member: BoardMember): boolean {
    return isMinorAt(member.dateOfBirth, this.arrivalDate());
  }

  protected memberName(member: BoardMember): string {
    return `${member.firstName} ${member.lastName}`;
  }

  protected sexLabel(member: BoardMember): string {
    return member.sex === 'FEMALE' ? 'F' : member.sex === 'MALE' ? 'G' : '–';
  }

  protected percent(used: number, max: number): number {
    return max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.board().subscribe({
      next: (board) => {
        this.board.set(board);
        this.loading.set(false);
        if (this.selectedGroupId() === null && board.hostingGroups.length > 0) {
          this.selectedGroupId.set(board.hostingGroups[0].id);
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.fail(error);
      },
    });
  }

  // ── Étape 1 : groupes d'hébergement ────────────────────────────────────────

  protected createGroup(): void {
    const name = this.newGroupName().trim();
    if (!name) return;
    this.run(this.api.createGroup(name), (group) => {
      this.patchBoard((b) => ({ ...b, hostingGroups: [...b.hostingGroups, group] }));
      this.newGroupName.set('');
      this.info(`Groupe « ${group.name} » créé.`);
    });
  }

  protected deleteGroup(id: number): void {
    const group = this.groups().find((g) => g.id === id);
    if (!group || !confirm(`Supprimer le groupe « ${group.name} » ? Ses équipes et familles redeviennent non affectées.`)) return;
    this.run(this.api.deleteGroup(id), () => {
      this.patchBoard((b) => ({
        ...b,
        hostingGroups: b.hostingGroups.filter((g) => g.id !== id),
        teams: b.teams.map((t) => (t.hostingGroupId === id ? { ...t, hostingGroupId: null } : t)),
        families: b.families.map((f) => (f.hostingGroupId === id ? { ...f, hostingGroupId: null } : f)),
      }));
      if (this.selectedGroupId() === id) this.selectedGroupId.set(null);
    });
  }

  protected dropOnColumn(event: CdkDragDrop<number>, kind: 'team' | 'family'): void {
    if (event.previousContainer === event.container) return;
    const item = event.item.data as DragItem;
    if (item.kind !== kind) return;
    this.moveToGroup(kind, item.id, event.container.data === NONE ? null : event.container.data);
  }

  protected moveToGroup(kind: 'team' | 'family', id: number, groupId: number | null): void {
    if (kind === 'team') {
      this.run(this.api.setTeamGroup(id, groupId), () =>
        this.patchBoard((b) => ({
          ...b,
          teams: b.teams.map((t) => (t.id === id ? { ...t, hostingGroupId: groupId } : t)),
        })),
      );
    } else {
      this.run(this.api.setFamilyGroup(id, groupId), () =>
        this.patchBoard((b) => ({
          ...b,
          families: b.families.map((f) => (f.id === id ? { ...f, hostingGroupId: groupId } : f)),
        })),
      );
    }
  }


  // ── Étape 2 : placement dans les familles ──────────────────────────────────

  protected openGroup(groupId: number): void {
    this.selectedGroupId.set(groupId);
    this.selectedMemberId.set(null);
    this.preview.set(null);
    this.step.set(2);
  }

  protected selectGroup(id: number | null): void {
    this.selectedGroupId.set(id);
    this.selectedMemberId.set(null);
    this.preview.set(null);
  }

  protected toggleMember(member: BoardMember): void {
    this.selectedMemberId.update((id) => (id === member.participantId ? null : member.participantId));
  }

  /** Dépôt d'un jeune sur une famille (liste = id de famille) ou sur "À placer" (0). */
  protected dropMember(event: CdkDragDrop<number>): void {
    if (event.previousContainer === event.container) return;
    const participantId = (event.item.data as { participantId: number }).participantId;
    const target = event.container.data;
    if (target === NONE) this.unplace(participantId);
    else this.placeMember(participantId, target);
  }

  protected placeSelectedIn(family: BoardFamily): void {
    const id = this.selectedMemberId();
    if (id !== null) this.placeMember(id, family.id);
  }

  protected placeMember(participantId: number, familyId: number): void {
    const member = this.board()?.members.find((m) => m.participantId === participantId);
    if (!member || member.hostFamilyId === familyId) return;
    const moving = member.hostFamilyId !== null;
    if (moving && member.assignmentStatus === 'CONFIRMED') {
      const ok = confirm(`${this.memberName(member)} a une affectation confirmée. La déplacer vers cette famille ?`);
      if (!ok) return;
    }
    this.run(
      this.api.place({
        participantId,
        hostFamilyId: familyId,
        replaceExisting: moving,
        ...(moving ? {} : { arrivalDate: this.arrivalDate(), departureDate: this.departureDate() }),
        ...(this.rulesChosen() ? { rules: this.rules() } : {}),
      }),
      (result) => {
        this.patchBoard((b) => ({
          ...b,
          members: b.members.map((m) =>
            m.participantId === participantId
              ? { ...m, hostFamilyId: familyId, assignmentId: result.assignment.id, assignmentStatus: result.assignment.status }
              : m,
          ),
        }));
        this.selectedMemberId.set(null);
        this.preview.set(null);
        if (result.warnings.length) this.notice.set({ kind: 'warning', text: result.warnings.join(' · ') });
      },
    );
  }

  protected unplace(participantId: number): void {
    const member = this.board()?.members.find((m) => m.participantId === participantId);
    if (!member || member.hostFamilyId === null) return;
    if (member.assignmentStatus === 'CONFIRMED' && !confirm(`${this.memberName(member)} a une affectation confirmée. La retirer ?`)) return;
    this.run(this.api.unplace(participantId), () => {
      this.patchBoard((b) => ({
        ...b,
        members: b.members.map((m) =>
          m.participantId === participantId
            ? { ...m, hostFamilyId: null, assignmentId: null, assignmentStatus: null }
            : m,
        ),
      }));
      this.selectedMemberId.set(null);
      this.preview.set(null);
    });
  }

  // ── Placement automatique : aperçu puis application ────────────────────────

  /** Règles choisies pour le placement automatique (jamais appelé tant que le choix n'est pas fait). */
  protected rules(): PlacementRules {
    return {
      countAnimatorsInCapacity: this.countAnimators() ?? true,
      sexMixing: this.sexMixing() ?? 'ignore',
    };
  }

  protected setAnimatorRule(value: string | null): void {
    this.countAnimators.set(!value ? null : value === 'yes');
    this.preview.set(null);
  }

  protected setMixingRule(value: string | null): void {
    this.sexMixing.set(!value ? null : (value as SexMixingRule));
    this.preview.set(null);
  }

  protected computeProposal(): void {
    const groupId = this.selectedGroupId();
    if (groupId === null || !this.rulesChosen()) return;
    this.run(
      this.api.autoPlace(groupId, {
        arrivalDate: this.arrivalDate(),
        departureDate: this.departureDate(),
        apply: false,
        rules: this.rules(),
      }),
      (result) => {
        this.preview.set(result);
        this.info(
          result.proposals.length
            ? `Proposition : ${result.proposals.length} placement(s). Rien n'est enregistré tant que vous n'appliquez pas.`
            : 'Aucun placement à proposer.',
        );
      },
    );
  }

  protected applyProposal(): void {
    const groupId = this.selectedGroupId();
    const proposal = this.preview();
    if (groupId === null || !proposal || proposal.proposals.length === 0 || !this.rulesChosen()) return;
    this.run(
      this.api.autoPlace(groupId, {
        arrivalDate: this.arrivalDate(),
        departureDate: this.departureDate(),
        apply: true,
        rules: this.rules(),
      }),
      (result) => {
        this.preview.set(null);
        this.info(`${result.proposals.length} placement(s) enregistré(s) en attente de confirmation.`);
        this.reload();
      },
    );
  }

  protected cancelProposal(): void {
    this.preview.set(null);
  }

  protected unplacedPreview = computed(() => {
    const preview = this.preview();
    const members = new Map((this.board()?.members ?? []).map((m) => [m.participantId, m]));
    return (preview?.unplaced ?? []).map((u) => ({
      name: members.get(u.participantId) ? this.memberName(members.get(u.participantId) as BoardMember) : `#${u.participantId}`,
      reason: REASON_LABELS[u.reason] ?? u.reason,
    }));
  });

  protected proposedIds = computed(() => new Set((this.preview()?.proposals ?? []).map((p) => p.participantId)));

  private ghostsOf(familyId: number): BoardMember[] {
    const preview = this.preview();
    const b = this.board();
    if (!preview || !b) return [];
    const ids = new Set(preview.proposals.filter((p) => p.hostFamilyId === familyId).map((p) => p.participantId));
    return b.members.filter((m) => ids.has(m.participantId));
  }

  // ── Utilitaires ────────────────────────────────────────────────────────────

  private eventStart(): string {
    return ALLEGRIA_2027_EVENT_DATES.startDate;
  }

  private patchBoard(update: (board: Board) => Board): void {
    this.board.update((b) => (b ? update(b) : b));
  }

  private info(text: string): void {
    this.notice.set({ kind: 'info', text });
  }

  private fail(error: unknown): void {
    const message =
      error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : "L'action a échoué. Rien n'a été modifié.";
    this.notice.set({ kind: 'error', text: message });
  }

  private run<T>(
    request: Observable<T>,
    onSuccess: (value: T) => void,
  ): void {
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
