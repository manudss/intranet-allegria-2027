import { DatePipe, NgClass } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth.service';
import {
  DashboardGlobalSummary,
  DashboardLocationRow,
  DashboardShiftsByStatus,
  DashboardTeamSummary,
  DashboardTodoList,
  DashboardWhoDoesWhatResult,
  VolunteerShiftStatus,
  VolunteerTeam,
} from '../models/models';
import {
  OperationalDashboardApiService,
  VolunteerMissionsApiService,
  VolunteerTeamsApiService,
} from '../services/api.services';
import { ALLEGRIA_2027_EVENT_DATES } from '../shared/event-date-selector/event-date.config';
import {
  EVENT_DATE_VALUE_PROVIDER,
  EventDateSelectorComponent,
} from '../shared/event-date-selector/event-date-selector.component';
import { SHARED_IMPORTS } from '../shared/shared-imports';

type Tab = 'missions' | 'teams' | 'locations' | 'who' | 'alerts';

const SHIFT_STATUS_LABELS: Record<VolunteerShiftStatus, string> = {
  [VolunteerShiftStatus.TODO]: 'À faire',
  [VolunteerShiftStatus.ASSIGNED]: 'Assigné',
  [VolunteerShiftStatus.IN_PROGRESS]: 'En cours',
  [VolunteerShiftStatus.DONE]: 'Terminé',
  [VolunteerShiftStatus.CANCELLED]: 'Annulé',
  [VolunteerShiftStatus.NOT_DONE]: 'Non réalisé',
};

const REFRESH_OPTIONS = [
  { label: 'Désactivé', value: 0 },
  { label: '30 s', value: 30_000 },
  { label: '1 min', value: 60_000 },
  { label: '5 min', value: 300_000 },
];

const TEAM_SHIFT_STATUSES: ReadonlyArray<{
  key: keyof DashboardShiftsByStatus;
  label: string;
}> = [
  { key: VolunteerShiftStatus.TODO, label: 'À faire' },
  { key: VolunteerShiftStatus.ASSIGNED, label: 'Assigné' },
  { key: VolunteerShiftStatus.IN_PROGRESS, label: 'En cours' },
  { key: VolunteerShiftStatus.DONE, label: 'Terminé' },
  { key: VolunteerShiftStatus.NOT_DONE, label: 'Non réalisé' },
];

@Component({
  selector: 'app-jour-j',
  standalone: true,
  imports: [...SHARED_IMPORTS, DatePipe, NgClass, EventDateSelectorComponent],
  templateUrl: './jour-j.html',
  styleUrl: './jour-j.scss',
})
export class JourJ implements OnInit, OnDestroy {
  private readonly dashApi = inject(OperationalDashboardApiService);
  private readonly missionsApi = inject(VolunteerMissionsApiService);
  private readonly teamsApi = inject(VolunteerTeamsApiService);
  private readonly auth = inject(AuthService);
  private readonly dateProvider = inject(EVENT_DATE_VALUE_PROVIDER);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ─── Filtres ──────────────────────────────────────────────────────────────
  readonly eventDateConfig = ALLEGRIA_2027_EVENT_DATES;
  readonly selectedDate = signal(this.dateProvider.todayIsoDate());
  readonly selectedTeamId = signal<number | null>(null);
  readonly refreshInterval = signal(0);
  readonly activeTab = signal<Tab>('missions');

  // ─── Autorisations ────────────────────────────────────────────────────────
  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['ADMIN', 'COORDINATOR', 'HEALTH', 'ANIMATOR', 'LOGISTICS']),
  );
  readonly canForce = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));

  // ─── Données ──────────────────────────────────────────────────────────────
  readonly teams = signal<VolunteerTeam[]>([]);
  readonly global = signal<DashboardGlobalSummary | null>(null);
  readonly teamsSummary = signal<DashboardTeamSummary[]>([]);
  readonly locations = signal<DashboardLocationRow[]>([]);
  readonly whoResult = signal<DashboardWhoDoesWhatResult | null>(null);
  readonly todoList = signal<DashboardTodoList | null>(null);

  // ─── États de chargement ──────────────────────────────────────────────────
  readonly loadingGlobal = signal(false);
  readonly loadingTeams = signal(false);
  readonly loadingLocations = signal(false);
  readonly loadingWho = signal(false);
  readonly loadingTodo = signal(false);
  readonly exporting = signal(false);
  readonly exportError = signal('');

  // ─── "Qui fait quoi" : filtres locaux ────────────────────────────────────
  readonly whoSearch = signal('');
  readonly whoPage = signal(1);
  private whoSearchTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── Alertes calculées ───────────────────────────────────────────────────
  readonly alerts = computed(() => {
    const g = this.global();
    if (!g) return [];
    const list: { type: 'warning' | 'danger'; message: string }[] = [];
    if (g.understaffedShifts > 0) {
      list.push({ type: 'danger', message: `${g.understaffedShifts} shift(s) sous-doté(s)` });
    }
    if (g.shiftsWithoutConfirmedAssignment > 0) {
      list.push({
        type: 'warning',
        message: `${g.shiftsWithoutConfirmedAssignment} shift(s) sans effectif confirmé`,
      });
    }
    if (g.provisionalVolunteers > 0) {
      list.push({
        type: 'warning',
        message: `${g.provisionalVolunteers} bénévole(s) en affectation provisoire`,
      });
    }
    const teamAlerts = this.teamsSummary().flatMap((t) =>
      t.alerts.map((msg) => ({ type: 'warning' as const, message: `[${t.teamCode}] ${msg}` })),
    );
    const locAlerts = this.locations().flatMap((l) =>
      l.alerts.map((msg) => ({ type: 'danger' as const, message: `[${l.location}] ${msg}` })),
    );
    return [...list, ...teamAlerts, ...locAlerts];
  });

  readonly alertCount = computed(() => this.alerts().length);

  // ─── Cycle de vie ─────────────────────────────────────────────────────────

  readonly refreshOptions = REFRESH_OPTIONS;
  readonly shiftStatusLabels = SHIFT_STATUS_LABELS;
  readonly shiftStatusList = Object.values(VolunteerShiftStatus);
  readonly shiftStatus = VolunteerShiftStatus;
  readonly teamShiftStatuses = TEAM_SHIFT_STATUSES;

  ngOnInit(): void {
    this.teamsApi.list().subscribe((t) => this.teams.set(t));
    this.refreshAll();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  // ─── Actions publiques ────────────────────────────────────────────────────

  setDate(value: string): void {
    this.selectedDate.set(value);
    this.refreshAll();
  }

  setTeam(value: string): void {
    this.selectedTeamId.set(value ? Number(value) : null);
    this.refreshAll();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  setRefreshInterval(value: number): void {
    this.refreshInterval.set(value);
    this.clearTimer();
    if (value > 0) {
      this.refreshTimer = setInterval(() => this.refreshAll(), value);
    }
  }

  refreshAll(): void {
    this.loadGlobal();
    this.loadTeams();
    this.loadLocations();
    this.loadWho();
    this.loadTodo();
  }

  // ─── "Qui fait quoi" ──────────────────────────────────────────────────────

  onWhoSearch(value: string): void {
    this.whoSearch.set(value);
    if (this.whoSearchTimer) clearTimeout(this.whoSearchTimer);
    this.whoSearchTimer = setTimeout(() => {
      this.whoPage.set(1);
      this.loadWho();
    }, 400);
  }

  whoPrevPage(): void {
    if (this.whoPage() <= 1) return;
    this.whoPage.update((p) => p - 1);
    this.loadWho();
  }

  whoNextPage(): void {
    const result = this.whoResult();
    if (!result) return;
    const maxPage = Math.ceil(result.total / result.limit);
    if (this.whoPage() >= maxPage) return;
    this.whoPage.update((p) => p + 1);
    this.loadWho();
  }

  // ─── Actions rapides shift ────────────────────────────────────────────────

  changeShiftStatus(missionId: number, shiftId: number, status: VolunteerShiftStatus): void {
    this.missionsApi.changeShiftStatus(missionId, shiftId, { status }).subscribe({
      next: () => this.refreshAll(),
      error: (err) => alert(err?.error?.message ?? 'Impossible de changer le statut.'),
    });
  }

  exportCurrentPlanning(format: 'xlsx' | 'print' | 'pdf' = 'xlsx'): void {
    this.exporting.set(true);
    this.exportError.set('');

    this.dashApi
      .exportOperationalData('global-planning', {
        format,
        date: this.selectedDate(),
        volunteerTeamId: this.selectedTeamId(),
      })
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe({
        next: (blob) => this.downloadBlob(blob, format),
        error: (err) => {
          this.exportError.set(
            err?.error?.message ??
              'Impossible de générer l’export. Réessayez dans quelques instants.',
          );
        },
      });
  }

  // ─── Utilitaires template ─────────────────────────────────────────────────

  shiftLabel(s: VolunteerShiftStatus): string {
    return SHIFT_STATUS_LABELS[s];
  }

  shiftStatusClass(s: string): string {
    if (s === 'DONE') return 'status-done';
    if (s === 'IN_PROGRESS') return 'status-in-progress';
    if (s === 'ASSIGNED') return 'status-assigned';
    if (s === 'CANCELLED' || s === 'NOT_DONE') return 'status-negative';
    return 'status-todo';
  }

  assignmentStatusLabel(s: string): string {
    const labels: Record<string, string> = {
      PROVISIONAL: 'Provisoire',
      CONFIRMED: 'Confirmée',
      CANCELLED: 'Annulée',
    };
    return labels[s] ?? s;
  }

  assignmentStatusClass(s: string): string {
    if (s === 'CONFIRMED') return 'status-done';
    if (s === 'CANCELLED') return 'status-negative';
    return 'status-warning';
  }

  whoTotalPages(): number {
    const r = this.whoResult();
    if (!r || r.limit === 0) return 1;
    return Math.ceil(r.total / r.limit);
  }

  confirmedCountClass(confirmed: number, capacity: number | null): string {
    if (capacity == null || capacity === 0) return '';
    if (confirmed >= capacity) return 'status-done';
    if (confirmed > 0) return 'status-warning';
    return 'status-negative';
  }

  // ─── Chargements privés ───────────────────────────────────────────────────

  private loadGlobal(): void {
    this.loadingGlobal.set(true);
    this.dashApi
      .getGlobalSummary(this.selectedDate(), this.selectedTeamId())
      .pipe(finalize(() => this.loadingGlobal.set(false)))
      .subscribe({ next: (d) => this.global.set(d), error: () => undefined });
  }

  private loadTeams(): void {
    this.loadingTeams.set(true);
    this.dashApi
      .getTeamsSummary(this.selectedDate(), this.selectedTeamId())
      .pipe(finalize(() => this.loadingTeams.set(false)))
      .subscribe({ next: (d) => this.teamsSummary.set(d), error: () => undefined });
  }

  private loadLocations(): void {
    this.loadingLocations.set(true);
    this.dashApi
      .getLocationsSummary(this.selectedDate(), this.selectedTeamId())
      .pipe(finalize(() => this.loadingLocations.set(false)))
      .subscribe({ next: (d) => this.locations.set(d), error: () => undefined });
  }

  private loadWho(): void {
    this.loadingWho.set(true);
    this.dashApi
      .getWhoDoesWhat({
        date: this.selectedDate(),
        volunteerTeamId: this.selectedTeamId(),
        q: this.whoSearch() || undefined,
        page: this.whoPage(),
        limit: 20,
      })
      .pipe(finalize(() => this.loadingWho.set(false)))
      .subscribe({ next: (d) => this.whoResult.set(d), error: () => undefined });
  }

  private loadTodo(): void {
    this.loadingTodo.set(true);
    this.dashApi
      .getTodoList(this.selectedDate(), this.selectedTeamId())
      .pipe(finalize(() => this.loadingTodo.set(false)))
      .subscribe({ next: (d) => this.todoList.set(d), error: () => undefined });
  }

  private downloadBlob(blob: Blob, format: 'xlsx' | 'print' | 'pdf'): void {
    const teamPart = this.selectedTeamId() ? `__team-${this.selectedTeamId()}` : '';
    const name = `planning-global__${this.selectedDate()}${teamPart}.${format === 'print' ? 'html' : format}`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private clearTimer(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
