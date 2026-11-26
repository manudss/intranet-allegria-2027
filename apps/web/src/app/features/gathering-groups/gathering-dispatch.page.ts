import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { GatheringGroupsApiService } from './gathering-groups.api';
import {
  CATEGORY_LABELS,
  GATHERING_CATEGORIES,
  GatheringBoard,
  GatheringBoardTeam,
  GatheringCategory,
  GatheringGroupSummary,
  GatheringProposal,
  TRACK_COLORS,
  TRACK_LABELS,
} from './gathering-groups.models';

type Notice = { kind: 'error' | 'info'; text: string };

/**
 * Page dispatch d'une répartition : équipes non placées à gauche, groupes avec jauges
 * à droite, affectation tactile, proposition automatique avec aperçu avant application.
 */
@Component({
  selector: 'app-gathering-dispatch',
  standalone: true,
  imports: [...SHARED_IMPORTS, SelectFieldComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gathering-dispatch.page.html',
  styleUrl: './gathering-dispatch.page.scss',
})
export class GatheringDispatchPage implements OnInit, OnDestroy {
  private readonly api = inject(GatheringGroupsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroy$ = new Subject<void>();

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly trackLabels = TRACK_LABELS;
  protected readonly trackColors = TRACK_COLORS;
  protected readonly categoryOptions: SelectOption<GatheringCategory>[] = GATHERING_CATEGORIES.map(
    (c) => ({ value: c, label: CATEGORY_LABELS[c] }),
  );

  protected readonly repartitionId = signal(0);
  protected readonly board = signal<GatheringBoard | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<Notice | null>(null);

  protected readonly selectedTeamId = signal<number | null>(null);
  protected readonly filter = signal('');

  /** Panneau visible sur écran étroit : les deux colonnes ne sont pas empilées mais permutées. */
  protected readonly panel = signal<'teams' | 'groups'>('teams');

  protected readonly proposal = signal<GatheringProposal | null>(null);
  protected readonly proposalBusy = signal(false);

  protected readonly creating = signal(false);
  protected readonly newGroupName = signal('');
  protected readonly newGroupCategory = signal<GatheringCategory | null>('MIXTE');
  protected readonly newGroupCapacity = signal('');
  protected readonly newGroupLocation = signal('');

  protected readonly filteredTeams = computed(() => {
    const b = this.board();
    if (!b) return [];
    const q = this.filter().trim().toLowerCase();
    if (!q) return b.unplacedTeams;
    return b.unplacedTeams.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.delegation ?? '').toLowerCase().includes(q),
    );
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.repartitionId.set(Number(params.get('id')) || 0);
          this.loading.set(true);
          return this.api.board(this.repartitionId());
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (board) => {
          this.board.set(board);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notice.set({ kind: 'error', text: 'Impossible de charger la répartition.' });
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.board(this.repartitionId()).subscribe({
      next: (board) => {
        this.board.set(board);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notice.set({ kind: 'error', text: 'Impossible de recharger la répartition.' });
      },
    });
  }

  protected toggleTeam(team: GatheringBoardTeam): void {
    const selecting = this.selectedTeamId() !== team.id;
    this.selectedTeamId.update((id) => (id === team.id ? null : team.id));
    // Sur écran étroit, une équipe sélectionnée amène directement sur les groupes cibles.
    if (selecting && this.isNarrow()) this.panel.set('groups');
  }

  protected selectedTeamName(): string {
    const id = this.selectedTeamId();
    return id === null ? '' : this.teamName(id);
  }

  protected selectGroup(group: GatheringGroupSummary): void {
    const teamId = this.selectedTeamId();
    if (teamId === null || this.busy()) return;
    this.busy.set(true);
    this.api.assignTeam(group.id, teamId).subscribe({
      next: () => {
        this.selectedTeamId.set(null);
        this.busy.set(false);
        this.panel.set('teams');
        this.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.notice.set({ kind: 'error', text: this.readError(err, 'Affectation refusée.') });
      },
    });
  }

  protected unassign(group: GatheringGroupSummary, teamId: number): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.unassignTeam(group.id, teamId).subscribe({
      next: () => {
        this.busy.set(false);
        this.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.notice.set({ kind: 'error', text: this.readError(err, 'Retrait impossible.') });
      },
    });
  }

  protected createGroup(): void {
    if (!this.newGroupName().trim() || this.busy()) return;
    const capacityRaw = this.newGroupCapacity().trim();
    const capacity = capacityRaw === '' ? null : Number(capacityRaw);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
      this.notice.set({ kind: 'error', text: 'Capacité invalide : un nombre entier positif, ou vide.' });
      return;
    }
    this.busy.set(true);
    this.api
      .createGroup(this.repartitionId(), {
        name: this.newGroupName().trim(),
        category: this.newGroupCategory() ?? 'MIXTE',
        capacityPersons: capacity,
        location: this.newGroupLocation().trim() || null,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.creating.set(false);
          this.newGroupName.set('');
          this.newGroupCapacity.set('');
          this.newGroupLocation.set('');
          this.reload();
        },
        error: (err) => {
          this.busy.set(false);
          this.notice.set({ kind: 'error', text: this.readError(err, 'Création impossible.') });
        },
      });
  }

  protected removeGroup(group: GatheringGroupSummary): void {
    this.confirmDialog
      .askDelete(`le groupe « ${group.name} »`, 'Ses équipes repasseront dans les équipes à placer.')
      .subscribe((ok) => {
        if (!ok) return;
        this.api.removeGroup(group.id).subscribe({
          next: () => this.reload(),
          error: (err) =>
            this.notice.set({ kind: 'error', text: this.readError(err, 'Suppression impossible.') }),
        });
      });
  }

  protected toggleOverflow(): void {
    const repartition = this.board()?.repartition;
    if (!repartition) return;
    const target = !repartition.allowOverflow;
    const action = () =>
      this.api.setOverflow(repartition.id, target).subscribe({
        next: () => {
          this.notice.set({
            kind: 'info',
            text: target
              ? 'Dérogation activée : les dépassements de capacité sont possibles.'
              : 'Dépassement à nouveau bloquant.',
          });
          this.reload();
        },
        error: (err) =>
          this.notice.set({ kind: 'error', text: this.readError(err, 'Réglage impossible.') }),
      });
    if (target) {
      this.confirmDialog
        .ask({
          title: 'Activer la dérogation',
          message: `Autoriser les dépassements de capacité sur « ${repartition.name} » ?`,
          yes: 'Activer',
        })
        .subscribe((ok) => ok && action());
    } else {
      action();
    }
  }

  protected propose(): void {
    this.proposalBusy.set(true);
    this.api.propose(this.repartitionId()).subscribe({
      next: (p) => {
        this.proposal.set(p);
        this.proposalBusy.set(false);
      },
      error: (err) => {
        this.proposalBusy.set(false);
        this.notice.set({ kind: 'error', text: this.readError(err, 'Proposition impossible.') });
      },
    });
  }

  protected applyProposal(): void {
    const p = this.proposal();
    if (!p || !p.assignments.length || this.busy()) return;
    this.busy.set(true);
    this.api
      .apply(
        this.repartitionId(),
        p.assignments.map((a) => ({ teamId: a.teamId, groupId: a.groupId })),
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.proposal.set(null);
          this.notice.set({ kind: 'info', text: 'Proposition appliquée.' });
          this.reload();
        },
        error: (err) => {
          this.busy.set(false);
          this.notice.set({ kind: 'error', text: this.readError(err, 'Application impossible.') });
        },
      });
  }

  protected teamName(teamId: number): string {
    const b = this.board();
    const unplaced = b?.unplacedTeams.find((x) => x.id === teamId);
    if (unplaced) return unplaced.name;
    for (const g of b?.groups ?? []) {
      const placed = g.teams?.find((x) => x.id === teamId);
      if (placed) return placed.name;
    }
    return `Équipe ${teamId}`;
  }

  protected gaugeRatio(group: { persons: number; capacity: number | null }): number {
    if (!group.capacity) return 0;
    return Math.min(1, group.persons / group.capacity);
  }

  private isNarrow(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 60rem)').matches;
  }

  private readError(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: string | string[] } })?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
