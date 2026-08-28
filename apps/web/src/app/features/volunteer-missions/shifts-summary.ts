import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  StatusCounters,
  VolunteerMission,
  VolunteerMissionStatus,
  VolunteerShift,
  VolunteerShiftStatus,
} from '../../models/models';
import { VolunteerMissionsApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';

/** Transitions autorisées côté client (miroir du backend) */
const SHIFT_NEXT_STATUSES: Partial<Record<VolunteerShiftStatus, VolunteerShiftStatus[]>> = {
  [VolunteerShiftStatus.TODO]: [VolunteerShiftStatus.ASSIGNED, VolunteerShiftStatus.IN_PROGRESS, VolunteerShiftStatus.CANCELLED],
  [VolunteerShiftStatus.ASSIGNED]: [VolunteerShiftStatus.IN_PROGRESS, VolunteerShiftStatus.CANCELLED],
  [VolunteerShiftStatus.IN_PROGRESS]: [VolunteerShiftStatus.DONE, VolunteerShiftStatus.NOT_DONE, VolunteerShiftStatus.CANCELLED],
  // DONE → NOT_DONE affiché seulement pour ADMIN/COORDINATOR (géré dans le template)
  [VolunteerShiftStatus.DONE]: [VolunteerShiftStatus.NOT_DONE],
};

@Component({
  selector: 'app-shifts-summary',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `<app-page-layout title="Suivi opérationnel" description="Synthèse des missions et shifts par statut">

    @if (countersLoading()) {
      <tui-loader />
    } @else {
      <!-- Compteurs missions -->
      <section class="section">
        <h2 class="section-title">Missions</h2>
        <div class="summary-grid">
          @for (entry of missionCards; track entry.status) {
            <button
              class="counter-card"
              [class.active]="currentView() === 'missions' && currentStatus() === entry.status"
              type="button"
              (click)="viewMissionsByStatus(entry.status)"
            >
              <span class="card-label">{{ entry.label }}</span>
              <span class="count" [class.positive]="entry.positive" [class.negative]="entry.negative">
                {{ counters()?.missions?.[entry.status] ?? 0 }}
              </span>
            </button>
          }
        </div>
      </section>

      <!-- Compteurs shifts -->
      <section class="section">
        <h2 class="section-title">Shifts</h2>
        <div class="summary-grid">
          @for (entry of shiftCards; track entry.status) {
            <button
              class="counter-card"
              [class.active]="currentView() === 'shifts' && currentStatus() === entry.status"
              type="button"
              (click)="viewShiftsByStatus(entry.status)"
            >
              <span class="card-label">{{ entry.label }}</span>
              <span class="count" [class.positive]="entry.positive" [class.negative]="entry.negative">
                {{ counters()?.shifts?.[entry.status] ?? 0 }}
              </span>
            </button>
          }
        </div>
      </section>
    }

    <!-- Vue détail missions -->
    @if (currentView() === 'missions' && currentStatus()) {
      <section class="details-section">
        <div class="details-header">
          <h2>Missions — {{ statusLabel(currentStatus()) }}</h2>
          <div class="filter-tabs">
            <button type="button" tuiButton size="xs"
              [appearance]="mandatoryFilter() === null ? 'primary' : 'flat'"
              (click)="mandatoryFilter.set(null)">Toutes</button>
            <button type="button" tuiButton size="xs"
              [appearance]="mandatoryFilter() === true ? 'primary' : 'flat'"
              (click)="mandatoryFilter.set(true)">Obligatoires</button>
            <button type="button" tuiButton size="xs"
              [appearance]="mandatoryFilter() === false ? 'primary' : 'flat'"
              (click)="mandatoryFilter.set(false)">Facultatives</button>
          </div>
        </div>

        @if (detailsLoading()) {
          <tui-loader />
        } @else if (filteredMissions().length === 0) {
          <p class="empty">Aucune mission à afficher.</p>
        } @else {
          <ul class="detail-list">
            @for (mission of filteredMissions(); track mission.id) {
              <li class="detail-item" [class.optional]="mission.isOptional">
                <div class="item-head">
                  <strong>{{ mission.title }}</strong>
                  @if (mission.isOptional) {
                    <span class="badge-optional">Facultatif</span>
                  }
                </div>
                <p class="item-meta">Équipe : {{ mission.volunteerTeam?.name || 'Transversale' }}</p>
                <p class="item-meta">Shifts : {{ mission.shifts?.length ?? 0 }}</p>
              </li>
            }
          </ul>
        }
      </section>
    }

    <!-- Vue détail shifts -->
    @if (currentView() === 'shifts' && currentStatus()) {
      <section class="details-section">
        <div class="details-header">
          <h2>Shifts — {{ statusLabel(currentStatus()) }}</h2>
          <div class="filter-tabs">
            <button type="button" tuiButton size="xs"
              [appearance]="mandatoryFilter() === null ? 'primary' : 'flat'"
              (click)="mandatoryFilter.set(null)">Tous</button>
            <button type="button" tuiButton size="xs"
              [appearance]="mandatoryFilter() === true ? 'primary' : 'flat'"
              (click)="mandatoryFilter.set(true)">Obligatoires</button>
            <button type="button" tuiButton size="xs"
              [appearance]="mandatoryFilter() === false ? 'primary' : 'flat'"
              (click)="mandatoryFilter.set(false)">Facultatifs</button>
          </div>
        </div>

        @if (detailsLoading()) {
          <tui-loader />
        } @else if (filteredShifts().length === 0) {
          <p class="empty">Aucun shift à afficher.</p>
        } @else {
          <ul class="detail-list">
            @for (shift of filteredShifts(); track shift.id) {
              <li class="detail-item" [class.optional]="shift.isOptional">
                <div class="item-head">
                  <strong>{{ shift.startAt | date: 'dd/MM HH:mm' }} – {{ shift.endAt | date: 'HH:mm' }}</strong>
                  @if (shift.isOptional) {
                    <span class="badge-optional">Facultatif</span>
                  }
                </div>
                <p class="item-meta">
                  Mission : {{ shift.mission?.title || '—' }} ·
                  Équipe : {{ shift.mission?.volunteerTeam?.name || 'Transversale' }}
                </p>
                <p class="item-meta">
                  Lieu : {{ shift.location || 'Non spécifié' }} ·
                  Affectés : {{ shift.activeAssignmentsCount ?? 0 }}/{{ shift.capacity ?? '?' }}
                </p>
                @if (canWrite() && nextStatuses(shift).length > 0) {
                  <div class="quick-actions">
                    @for (nextStatus of nextStatuses(shift); track nextStatus) {
                      <!-- DONE→NOT_DONE réservé ADMIN/COORDINATOR -->
                      @if (nextStatus !== shiftStatusEnum.NOT_DONE || shift.status !== shiftStatusEnum.DONE || canForce()) {
                        <button
                          type="button"
                          tuiButton
                          size="xs"
                          [appearance]="actionAppearance(nextStatus)"
                          [disabled]="changingShiftId() === shift.id"
                          (click)="changeShiftStatus(shift, nextStatus)"
                        >
                          → {{ shiftStatusLabel(nextStatus) }}
                        </button>
                      }
                    }
                  </div>
                }
              </li>
            }
          </ul>
        }
      </section>
    }
  </app-page-layout>`,
  styles: [`
    .section { margin-block: 1.5rem; }
    .section-title {
      font-size: 1rem;
      font-weight: 600;
      margin-block-end: 0.75rem;
      color: var(--tui-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
      gap: 0.75rem;
    }
    .counter-card {
      border: 2px solid var(--tui-border-normal);
      border-radius: 0.75rem;
      padding: 0.875rem 0.75rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.375rem;
      background: var(--tui-background-base);
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .counter-card:hover { border-color: var(--tui-border-hover); box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    .counter-card.active { border-color: var(--tui-primary); background: var(--tui-background-accent-1); }
    .card-label { font-size: 0.75rem; text-transform: uppercase; color: var(--tui-text-secondary); }
    .count { font-size: 1.75rem; font-weight: 700; color: var(--tui-text-primary); }
    .count.positive { color: var(--tui-positive); }
    .count.negative { color: var(--tui-negative); }

    .details-section {
      margin-block-start: 2rem;
      padding: 1rem;
      border: 1px solid var(--tui-border-normal);
      border-radius: 0.75rem;
    }
    .details-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-block-end: 1rem;
    }
    .details-header h2 { margin: 0; font-size: 1.125rem; }
    .filter-tabs { display: flex; gap: 0.375rem; flex-wrap: wrap; }
    .empty { color: var(--tui-text-secondary); font-style: italic; }

    .detail-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.625rem; }
    .detail-item {
      padding: 0.75rem;
      border-left: 4px solid var(--tui-border-normal);
      background: var(--tui-background-secondary);
      border-radius: 0.25rem;
    }
    .detail-item.optional { border-left-color: var(--tui-chart-categorical-04, #aaa); }
    .item-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-block-end: 0.25rem; }
    .item-meta { margin: 0.125rem 0; font-size: 0.8125rem; color: var(--tui-text-secondary); }
    .badge-optional {
      font-size: 0.6875rem;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      background: var(--tui-background-accent-2, #f0f0f0);
      color: var(--tui-text-secondary);
      border: 1px solid var(--tui-border-normal);
    }
    .quick-actions { display: flex; gap: 0.375rem; flex-wrap: wrap; margin-block-start: 0.5rem; }

    @media (max-width: 480px) {
      .summary-grid { grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); }
      .details-header { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class ShiftsSummaryPage implements OnInit {
  readonly missionStatusEnum = VolunteerMissionStatus;
  readonly shiftStatusEnum = VolunteerShiftStatus;

  private readonly missionsApi = inject(VolunteerMissionsApiService);
  private readonly auth = inject(AuthService);

  readonly counters = signal<StatusCounters | null>(null);
  readonly countersLoading = signal(true);
  readonly currentView = signal<'overview' | 'missions' | 'shifts'>('overview');
  readonly currentStatus = signal<VolunteerMissionStatus | VolunteerShiftStatus | null>(null);
  readonly detailMissions = signal<VolunteerMission[]>([]);
  readonly detailShifts = signal<VolunteerShift[]>([]);
  readonly detailsLoading = signal(false);
  readonly mandatoryFilter = signal<boolean | null>(null);
  readonly changingShiftId = signal<number | null>(null);

  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['ADMIN', 'COORDINATOR', 'VOLUNTEERS', 'HEALTH', 'ANIMATOR', 'LOGISTICS']),
  );
  readonly canForce = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));

  readonly filteredMissions = computed(() => {
    const filter = this.mandatoryFilter();
    const missions = this.detailMissions();
    if (filter === null) return missions;
    return missions.filter((m) => (filter ? !m.isOptional : m.isOptional));
  });

  readonly filteredShifts = computed(() => {
    const filter = this.mandatoryFilter();
    const shifts = this.detailShifts();
    if (filter === null) return shifts;
    return shifts.filter((s) => (filter ? !s.isOptional : s.isOptional));
  });

  readonly missionCards = [
    { status: VolunteerMissionStatus.TODO, label: 'À faire', positive: false, negative: false },
    { status: VolunteerMissionStatus.IN_PROGRESS, label: 'En cours', positive: false, negative: false },
    { status: VolunteerMissionStatus.DONE, label: 'Terminées', positive: true, negative: false },
    { status: VolunteerMissionStatus.NOT_DONE, label: 'Non réalisées', positive: false, negative: true },
    { status: VolunteerMissionStatus.CANCELLED, label: 'Annulées', positive: false, negative: false },
  ];

  readonly shiftCards = [
    { status: VolunteerShiftStatus.TODO, label: 'À faire', positive: false, negative: false },
    { status: VolunteerShiftStatus.ASSIGNED, label: 'Assignés', positive: false, negative: false },
    { status: VolunteerShiftStatus.IN_PROGRESS, label: 'En cours', positive: false, negative: false },
    { status: VolunteerShiftStatus.DONE, label: 'Terminés', positive: true, negative: false },
    { status: VolunteerShiftStatus.NOT_DONE, label: 'Non réalisés', positive: false, negative: true },
    { status: VolunteerShiftStatus.CANCELLED, label: 'Annulés', positive: false, negative: false },
  ];

  ngOnInit(): void {
    this.loadCounters();
  }

  viewMissionsByStatus(status: VolunteerMissionStatus): void {
    this.currentView.set('missions');
    this.currentStatus.set(status);
    this.mandatoryFilter.set(null);
    this.detailsLoading.set(true);
    this.missionsApi
      .listMissionsByStatus(status)
      .pipe(finalize(() => this.detailsLoading.set(false)))
      .subscribe((missions) => this.detailMissions.set(missions));
  }

  viewShiftsByStatus(status: VolunteerShiftStatus): void {
    this.currentView.set('shifts');
    this.currentStatus.set(status);
    this.mandatoryFilter.set(null);
    this.detailsLoading.set(true);
    this.missionsApi
      .listShiftsByStatus(status)
      .pipe(finalize(() => this.detailsLoading.set(false)))
      .subscribe((shifts) => this.detailShifts.set(shifts));
  }

  changeShiftStatus(shift: VolunteerShift, nextStatus: VolunteerShiftStatus): void {
    if (!shift.missionId) return;
    this.changingShiftId.set(shift.id);
    this.missionsApi
      .changeShiftStatus(shift.missionId, shift.id, { status: nextStatus })
      .pipe(finalize(() => this.changingShiftId.set(null)))
      .subscribe({
        next: () => {
          // Rechargement de la liste après succès (sûr, évite les états incohérents)
          const currentStatus = this.currentStatus() as VolunteerShiftStatus;
          this.viewShiftsByStatus(currentStatus);
          this.loadCounters();
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'Impossible de changer le statut.';
          alert(msg);
        },
      });
  }

  nextStatuses(shift: VolunteerShift): VolunteerShiftStatus[] {
    return SHIFT_NEXT_STATUSES[shift.status] ?? [];
  }

  actionAppearance(status: VolunteerShiftStatus): string {
    if (status === VolunteerShiftStatus.DONE) return 'positive';
    if (status === VolunteerShiftStatus.CANCELLED || status === VolunteerShiftStatus.NOT_DONE) return 'secondary-destructive';
    if (status === VolunteerShiftStatus.IN_PROGRESS) return 'warning';
    return 'secondary';
  }

  statusLabel(status: VolunteerMissionStatus | VolunteerShiftStatus | null): string {
    if (!status) return '';
    const missionLabels: Record<VolunteerMissionStatus, string> = {
      [VolunteerMissionStatus.DRAFT]: 'Brouillons',
      [VolunteerMissionStatus.TODO]: 'À faire',
      [VolunteerMissionStatus.IN_PROGRESS]: 'En cours',
      [VolunteerMissionStatus.DONE]: 'Terminées',
      [VolunteerMissionStatus.CANCELLED]: 'Annulées',
      [VolunteerMissionStatus.NOT_DONE]: 'Non réalisées',
    };
    if (Object.values(VolunteerMissionStatus).includes(status as VolunteerMissionStatus)) {
      return missionLabels[status as VolunteerMissionStatus];
    }
    return this.shiftStatusLabel(status as VolunteerShiftStatus);
  }

  shiftStatusLabel(status: VolunteerShiftStatus): string {
    const labels: Record<VolunteerShiftStatus, string> = {
      [VolunteerShiftStatus.TODO]: 'À faire',
      [VolunteerShiftStatus.ASSIGNED]: 'Assigné',
      [VolunteerShiftStatus.IN_PROGRESS]: 'En cours',
      [VolunteerShiftStatus.DONE]: 'Terminé',
      [VolunteerShiftStatus.CANCELLED]: 'Annulé',
      [VolunteerShiftStatus.NOT_DONE]: 'Non réalisé',
    };
    return labels[status];
  }

  private loadCounters(): void {
    this.countersLoading.set(true);
    this.missionsApi
      .getStatusCounters()
      .pipe(finalize(() => this.countersLoading.set(false)))
      .subscribe((counters) => this.counters.set(counters));
  }
}

