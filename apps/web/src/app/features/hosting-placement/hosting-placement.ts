import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ALLEGRIA_2027_EVENT_DATES } from '../../shared/event-date-selector/event-date.config';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { HostingPlacementApiService } from './hosting-placement.api';
import {
  REASON_LABELS,
  familiesOfGroup,
  familyLoad,
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

@Component({
  selector: 'app-hosting-placement',
  standalone: true,
  imports: [...SHARED_IMPORTS, CdkDropList, CdkDrag, RouterLink],
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
  protected readonly columnIds = computed(() => [NONE, ...this.groups().map((g) => g.id)]);
  protected readonly teamListIds = computed(() => this.columnIds().map((id) => `teams-${id}`));
  protected readonly poolConnections = computed(() => [
    'pool',
    ...this.groupFamilies().map((row) => `family-${row.family.id}`),
  ]);
  protected readonly familyListIds = computed(() => this.columnIds().map((id) => `families-${id}`));

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

  ngOnInit(): void {
    this.reload();
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

  protected onGroupSelect(kind: 'team' | 'family', id: number, event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.moveToGroup(kind, id, value === NONE ? null : value);
  }

  // ── Étape 2 : placement dans les familles ──────────────────────────────────

  protected openGroup(groupId: number): void {
    this.selectedGroupId.set(groupId);
    this.selectedMemberId.set(null);
    this.preview.set(null);
    this.step.set(2);
  }

  protected onSelectGroup(event: Event): void {
    this.selectedGroupId.set(Number((event.target as HTMLSelectElement).value));
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

  protected onAnimatorRule(event: Event): void {
    const value = ((event.target as HTMLSelectElement)).value;
    this.countAnimators.set(value === '' ? null : value === 'yes');
    this.preview.set(null);
  }

  protected onMixingRule(event: Event): void {
    const value = ((event.target as HTMLSelectElement)).value;
    this.sexMixing.set(value === '' ? null : (value as SexMixingRule));
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
