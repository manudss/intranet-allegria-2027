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
import { TuiIcon } from '@taiga-ui/core';
import { TuiAutoColorPipe, TuiAvatar, TuiAvatarStack } from '@taiga-ui/kit';
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
  GatheringOtherGroup,
  GatheringProposal,
  Track,
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
  imports: [...SHARED_IMPORTS, SelectFieldComponent, RouterLink, TuiIcon, TuiAvatar, TuiAvatarStack, TuiAutoColorPipe],
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

  /** Filtres de la liste des équipes à placer. */
  protected readonly trackFilter = signal<Track | 'ALL'>('ALL');
  protected readonly otherGroupFilter = signal<number | 'ALL'>('ALL');
  protected readonly membershipFilter = signal<'ALL' | 'WITH' | 'WITHOUT'>('ALL');
  protected readonly minPersons = signal('');
  protected readonly trackOptions: SelectOption<Track | 'ALL'>[] = [
    { value: 'ALL', label: 'Toutes les pistes' },
    { value: 'TA', label: 'TA' },
    { value: 'ES', label: 'ES' },
    { value: 'COMMON', label: 'Piste à renseigner' },
  ];
  protected readonly membershipOptions: SelectOption<'ALL' | 'WITH' | 'WITHOUT'>[] = [
    { value: 'ALL', label: 'Avec ou sans autre groupe' },
    { value: 'WITH', label: 'Déjà dans un autre groupe' },
    { value: 'WITHOUT', label: 'Dans aucun autre groupe' },
  ];
  protected readonly otherGroupOptions = computed<SelectOption<number | 'ALL'>[]>(() => [
    { value: 'ALL', label: 'Tous les autres groupes' },
    ...(this.board()?.otherGroups ?? []).map((g) => ({
      value: g.groupId,
      label: `${g.groupName} · ${g.repartitionName}`,
    })),
  ]);
  protected readonly activeFilters = computed(
    () =>
      (this.filter().trim() ? 1 : 0) +
      (this.trackFilter() !== 'ALL' ? 1 : 0) +
      (this.otherGroupFilter() !== 'ALL' ? 1 : 0) +
      (this.membershipFilter() !== 'ALL' ? 1 : 0) +
      (String(this.minPersons() ?? '').trim() ? 1 : 0),
  );

  protected readonly filteredTeams = computed(() => {
    const b = this.board();
    if (!b) return [];
    const q = this.filter().trim().toLowerCase();
    const track = this.trackFilter();
    const other = this.otherGroupFilter();
    const membership = this.membershipFilter();
    const min = Number(this.minPersons()) || 0;
    return b.unplacedTeams.filter(
      (t) =>
        (!q ||
          t.name.toLowerCase().includes(q) ||
          t.otherGroups.some((g) => g.groupName.toLowerCase().includes(q))) &&
        (track === 'ALL' || t.track === track) &&
        (other === 'ALL' || t.otherGroups.some((g) => g.groupId === other)) &&
        (membership === 'ALL' ||
          (membership === 'WITH' ? t.otherGroups.length > 0 : t.otherGroups.length === 0)) &&
        t.persons >= min,
    );
  });

  protected resetFilters(): void {
    this.filter.set('');
    this.trackFilter.set('ALL');
    this.otherGroupFilter.set('ALL');
    this.membershipFilter.set('ALL');
    this.minPersons.set('');
  }

  /** Équipe en cours de glisser-déposer. */
  protected readonly draggingTeamId = signal<number | null>(null);
  /** Groupe survolé pendant un glisser-déposer. */
  protected readonly dropGroupId = signal<number | null>(null);
  /** Équipe sélectionnée, ou glissée : celle qu'on s'apprête à placer. */
  protected readonly activeTeam = computed(() => {
    const id = this.draggingTeamId() ?? this.selectedTeamId();
    if (id === null) return null;
    const b = this.board();
    return b?.unplacedTeams.find((t) => t.id === id) ?? null;
  });
  /** Groupe choisi dans la liste du bandeau « Placer ». */
  protected readonly targetGroupId = signal<number | null>(null);
  protected readonly targetGroupOptions = computed<SelectOption<number>[]>(() =>
    (this.board()?.groups ?? []).map((g) => ({
      value: g.id,
      label: `${g.name} (${CATEGORY_LABELS[g.category]}) · ${g.persons}/${g.capacity ?? '∞'}`,
    })),
  );


  /** Logos officiels des pistes et de la catégorie commune (même dossier que les logos existants). */
  protected readonly trackLogos: Record<Track, string> = {
    TA: '/assets/branches/ta.jpg',
    ES: '/assets/branches/es.jpg',
    COMMON: '/assets/branches/mej.png',
  };

  protected categoryLogo(category: GatheringCategory): string {
    if (category === 'TA') return this.trackLogos.TA;
    if (category === 'ES') return this.trackLogos.ES;
    return this.trackLogos.COMMON;
  }

  /** Deux lettres d'une équipe ou d'un groupe pour un avatar (nom composé : première lettre de chaque mot). */
  protected initials(name: string): string {
    const words = name.split(/[\s–-]+/).filter((w) => /\p{L}|\p{N}/u.test(w));
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (words[0] ?? name).slice(0, 2).toUpperCase();
  }

  /** Équipes dont la liste est dépliée dans un groupe : repliée par défaut pour voir tous les groupes d'un coup. */
  protected readonly expandedGroups = signal<ReadonlySet<number>>(new Set());

  protected isGroupExpanded(groupId: number): boolean {
    return this.expandedGroups().has(groupId);
  }

  protected toggleGroupExpanded(groupId: number): void {
    const next = new Set(this.expandedGroups());
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    this.expandedGroups.set(next);
  }

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
          this.showNotice({ kind: 'error', text: 'Impossible de charger la répartition.' });
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
        this.showNotice({ kind: 'error', text: 'Impossible de recharger la répartition.' });
      },
    });
  }

  protected toggleTeam(team: GatheringBoardTeam): void {
    const selecting = this.selectedTeamId() !== team.id;
    this.targetGroupId.set(null);
    this.selectedTeamId.update((id) => (id === team.id ? null : team.id));
    // Sur écran étroit, une équipe sélectionnée amène directement sur les groupes cibles.
    if (selecting && this.isNarrow()) this.panel.set('groups');
  }

  protected selectedTeamName(): string {
    const id = this.selectedTeamId();
    return id === null ? '' : this.teamName(id);
  }

  /** Raison pour laquelle l'équipe active ne peut pas entrer dans ce groupe, ou null si elle le peut. */
  protected refusal(group: GatheringGroupSummary): string | null {
    const team = this.activeTeam();
    if (!team) return null;
    if (group.category !== 'MIXTE' && group.category !== team.track) {
      return team.track === 'COMMON'
        ? `Piste de l'équipe à renseigner : seul un groupe Mixte l'accepte`
        : `Piste ${team.track} : n'entre pas dans un groupe ${CATEGORY_LABELS[group.category]}`;
    }
    const allowOverflow = this.board()?.repartition.allowOverflow;
    if (!allowOverflow && group.capacity != null && group.persons + team.persons > group.capacity) {
      return `Refusé : avec cette équipe (+${team.persons}), le groupe passerait à ${group.persons + team.persons}/${group.capacity} (actuel : ${group.persons}/${group.capacity})`;
    }
    return null;
  }

  protected selectGroup(group: GatheringGroupSummary): void {
    const teamId = this.selectedTeamId();
    if (teamId === null) return;
    this.placeTeam(teamId, group);
  }

  /** Placement depuis le bandeau : équipe sélectionnée + groupe choisi dans la liste. */
  protected placeFromBar(): void {
    const teamId = this.selectedTeamId();
    const group = this.board()?.groups.find((g) => g.id === this.targetGroupId());
    if (teamId === null || !group) return;
    this.placeTeam(teamId, group);
  }

  protected placeTeam(teamId: number, group: GatheringGroupSummary): void {
    if (this.busy()) return;
    const team = this.board()?.unplacedTeams.find((t) => t.id === teamId);
    this.busy.set(true);
    this.api.assignTeam(group.id, teamId).subscribe({
      next: () => {
        this.selectedTeamId.set(null);
        this.targetGroupId.set(null);
        this.draggingTeamId.set(null);
        this.dropGroupId.set(null);
        this.busy.set(false);
        this.panel.set('teams');
        this.showNotice({
          kind: 'info',
          text: `« ${team?.name ?? 'Équipe'} » placée dans « ${group.name} ».`,
        });
        this.reload();
      },
      error: (err) => {
        this.busy.set(false);
        this.draggingTeamId.set(null);
        this.dropGroupId.set(null);
        this.showNotice({ kind: 'error', text: this.readError(err, 'Affectation refusée.') });
      },
    });
  }

  protected onGroupCardClick(event: MouseEvent, group: GatheringGroupSummary): void {
    if (this.selectedTeamId() === null) return;
    // Les liens et boutons de la carte (Fiche, Suppr., retrait) gardent leur propre action.
    if ((event.target as HTMLElement).closest('a, button.link, button[tuiButton]')) return;
    const reason = this.refusal(group);
    if (reason) {
      this.showNotice({ kind: 'error', text: `${reason}.` });
      return;
    }
    this.selectGroup(group);
  }

  protected dragStart(event: DragEvent, team: GatheringBoardTeam): void {
    this.draggingTeamId.set(team.id);
    this.selectedTeamId.set(team.id);
    event.dataTransfer?.setData('text/plain', String(team.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected dragEnd(): void {
    this.draggingTeamId.set(null);
    this.dropGroupId.set(null);
  }

  protected dragOver(event: DragEvent, group: GatheringGroupSummary): void {
    if (this.draggingTeamId() === null || this.refusal(group)) return;
    event.preventDefault();
    this.dropGroupId.set(group.id);
  }

  protected drop(event: DragEvent, group: GatheringGroupSummary): void {
    event.preventDefault();
    const teamId = this.draggingTeamId() ?? Number(event.dataTransfer?.getData('text/plain'));
    if (!teamId) return;
    const reason = this.refusal(group);
    if (reason) {
      this.showNotice({ kind: 'error', text: `${reason}.` });
      this.dragEnd();
      return;
    }
    this.placeTeam(teamId, group);
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
        this.showNotice({ kind: 'error', text: this.readError(err, 'Retrait impossible.') });
      },
    });
  }

  protected createGroup(): void {
    if (!this.newGroupName().trim() || this.busy()) return;
    const capacityRaw = String(this.newGroupCapacity() ?? '').trim();
    const capacity = capacityRaw === '' ? null : Number(capacityRaw);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
      this.showNotice({ kind: 'error', text: 'Capacité invalide : un nombre entier positif, ou vide.' });
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
          this.showNotice({ kind: 'info', text: 'Groupe créé.' });
          this.reload();
        },
        error: (err) => {
          this.busy.set(false);
          this.showNotice({ kind: 'error', text: this.readError(err, 'Création impossible.') });
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
            this.showNotice({ kind: 'error', text: this.readError(err, 'Suppression impossible.') }),
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
          this.showNotice({
            kind: 'info',
            text: target
              ? 'Dérogation activée : les dépassements de capacité sont possibles.'
              : 'Dépassement à nouveau bloquant.',
          });
          this.reload();
        },
        error: (err) =>
          this.showNotice({ kind: 'error', text: this.readError(err, 'Réglage impossible.') }),
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
        this.showNotice({ kind: 'error', text: this.readError(err, 'Proposition impossible.') });
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
          this.showNotice({ kind: 'info', text: 'Proposition appliquée.' });
          this.reload();
        },
        error: (err) => {
          this.busy.set(false);
          this.showNotice({ kind: 'error', text: this.readError(err, 'Application impossible.') });
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

  /** Champ Taiga type=number : la valeur émise est un number (ou null si vidé), on stocke une chaîne. */
  protected asText(value: unknown): string {
    return value == null ? '' : String(value);
  }

  /** Affiche le message en haut de page et le ramène dans le champ de vision (mobile : la page est longue). */
  private showNotice(notice: Notice): void {
    this.notice.set(notice);
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  private readError(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: string | string[] } })?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
