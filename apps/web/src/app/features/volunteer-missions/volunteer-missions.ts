import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  VolunteerMission,
  VolunteerMissionPayload,
  VolunteerMissionStatus,
  Volunteer,
  VolunteerShift,
  VolunteerShiftAssignment,
  VolunteerShiftAssignmentPayload,
  VolunteerShiftAssignmentStatus,
  VolunteerShiftPayload,
  VolunteerShiftStatus,
  VolunteerSkillType,
  VolunteerTeam,
} from '../../models/models';
import {
  VolunteerMissionsApiService,
  VolunteerShiftAssignmentsApiService,
  VolunteerTeamsApiService,
} from '../../services/api.services';
import { DataTableColumn } from '../../shared/data-table';
import { ALLEGRIA_2027_EVENT_DATES } from '../../shared/event-date-selector/event-date.config';
import { EventDateSelectorComponent } from '../../shared/event-date-selector/event-date-selector.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { TuiDataListWrapper, TuiSelect } from "@taiga-ui/kit";
import { FormsModule } from "@angular/forms";

const MISSION_STATUSES = Object.values(VolunteerMissionStatus);
const SHIFT_STATUSES = Object.values(VolunteerShiftStatus);
const ASSIGNMENT_STATUSES = Object.values(VolunteerShiftAssignmentStatus);

const MISSION_STATUS_LABELS: Record<VolunteerMissionStatus, string> = {
  [VolunteerMissionStatus.DRAFT]: 'Brouillon',
  [VolunteerMissionStatus.TODO]: 'À faire',
  [VolunteerMissionStatus.IN_PROGRESS]: 'En cours',
  [VolunteerMissionStatus.DONE]: 'Terminée',
  [VolunteerMissionStatus.CANCELLED]: 'Annulée',
  [VolunteerMissionStatus.NOT_DONE]: 'Non réalisée',
};

const MISSION_STATUS_APPEARANCE: Record<VolunteerMissionStatus, string> = {
  [VolunteerMissionStatus.DRAFT]: 'neutral',
  [VolunteerMissionStatus.TODO]: 'warning',
  [VolunteerMissionStatus.IN_PROGRESS]: 'primary',
  [VolunteerMissionStatus.DONE]: 'success',
  [VolunteerMissionStatus.CANCELLED]: 'danger',
  [VolunteerMissionStatus.NOT_DONE]: 'danger',
};

function formatDateTime(datetimeStr: string): string {
  const date = new Date(datetimeStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function volunteerName(v: Volunteer | null): string {
  return v ? `${v.lastName} ${v.firstName}` : '—';
}

const missionDraft = (): VolunteerMissionPayload => ({
  title: '',
  description: '',
  volunteerTeamId: null,
  location: '',
  responsibleVolunteerId: null,
  status: VolunteerMissionStatus.DRAFT,
  isOptional: false,
});

const shiftDraft = (): VolunteerShiftPayload => ({
  startAt: '',
  endAt: '',
  location: '',
  capacity: null,
  status: VolunteerShiftStatus.TODO,
  isOptional: false,
  notes: '',
});

const assignmentDraft = (): VolunteerShiftAssignmentPayload => ({
  volunteerId: 0,
  status: VolunteerShiftAssignmentStatus.PROVISIONAL,
  notes: '',
});

@Component({
  selector: 'app-volunteer-missions',
  standalone: true,
  imports: [...SHARED_IMPORTS, EventDateSelectorComponent, TuiDataListWrapper, TuiSelect, FormsModule],
  templateUrl: './volunteer-missions.html',
  styleUrls: ['../../shared/crud.scss', './volunteer-missions.scss'],
})
export class VolunteerMissionsPage implements OnInit {
  protected readonly eventDateConfig = ALLEGRIA_2027_EVENT_DATES;
  readonly VolunteerMissionStatus = VolunteerMissionStatus;
  readonly VolunteerShiftAssignmentStatus = VolunteerShiftAssignmentStatus;
  readonly missionStatuses = MISSION_STATUSES;
  readonly shiftStatuses = SHIFT_STATUSES;
  readonly assignmentStatuses = ASSIGNMENT_STATUSES;
  readonly allSkills = Object.values(VolunteerSkillType);

  private readonly missionsApi = inject(VolunteerMissionsApiService);
  private readonly assignmentsApi = inject(VolunteerShiftAssignmentsApiService);
  private readonly teamsApi = inject(VolunteerTeamsApiService);
  private readonly auth = inject(AuthService);

  readonly columns: readonly DataTableColumn<VolunteerMission>[] = [
    {
      key: 'title',
      label: 'Mission',
      type: 'text',
      value: (mission) => mission.title,
      presentation: { type: 'icon', icon: () => '@tui.briefcase' },
    },
    {
      key: 'team',
      label: 'Équipe',
      type: 'list',
      value: (mission) => mission.volunteerTeam?.code || 'TRANSVERSAL',
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' },
    },
    {
      key: 'status',
      label: 'Statut',
      type: 'list',
      value: (mission) => MISSION_STATUS_LABELS[mission.status],
      filterValue: (mission) => mission.status,
      presentation: {
        type: 'chip',
        appearance: (mission) => MISSION_STATUS_APPEARANCE[mission.status],
      },
    },
    {
      key: 'location',
      label: 'Lieu',
      type: 'text',
      value: (mission) => mission.location || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.map-pin' },
    },
    {
      key: 'description',
      label: 'Description',
      type: 'text',
      value: (mission) => mission.description || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.note' },
    },
    {
      key: 'responsibleVolunteer',
      label: 'Responsable',
      type: 'list',
      value: (mission) => volunteerName(mission.responsibleVolunteer),
      hidden: true,
      presentation: { type: 'person', subtitle: (mission) => mission.responsibleVolunteer?.email || '—' },
    },
    {
      key: 'isOptional',
      label: 'Optionnel',
      type: 'list',
      value: (mission) => mission.isOptional,
      hidden: true,
      presentation: { type: 'boolean' },
    },
    {
      key: 'shifts',
      label: 'Shifts',
      type: 'number',
      value: (mission) => mission.shifts?.length ?? 0,
      hidden: true,
      presentation: { type: 'number' },
    },
    {
      key: 'createdAt',
      label: 'Créé le',
      type: 'date',
      value: (mission) => formatDateTime(mission.createdAt),
      filterValue: (mission) => mission.createdAt,
      hidden: true,
      presentation: { type: 'date' },
    },
    {
      key: 'updatedAt',
      label: 'Modifié le',
      type: 'date',
      value: (mission) => formatDateTime(mission.updatedAt),
      filterValue: (mission) => mission.updatedAt,
      hidden: true,
      presentation: { type: 'date' },
    },
  ];

  missions = signal<VolunteerMission[]>([]);
  teams = signal<VolunteerTeam[]>([]);
  shifts = signal<VolunteerShift[]>([]);
  loading = signal(true);
  shiftsLoading = signal(false);
  opened = signal(false);
  drawerMode = signal<'detail' | 'create' | 'edit'>('detail');
  selectedMission = signal<VolunteerMission | null>(null);
  editingShiftId = signal<number | null>(null);
  missionModel = signal<VolunteerMissionPayload>(missionDraft());
  shiftModel = signal<VolunteerShiftPayload>(shiftDraft());
  assignmentModel = signal<VolunteerShiftAssignmentPayload>(assignmentDraft());
  assignmentStatusFilters = signal<Record<number, VolunteerShiftAssignmentStatus | ''>>({});
  assignmentSearchResults = signal<Record<number, { volunteer: Volunteer; hasOverlap: boolean }[]>>(
    {},
  );
  assignmentSearchQuery = signal('');
  assignmentSearchSkill = signal<VolunteerSkillType | null>(null);
  assignmentSearchTag = signal('');
  assignmentSearchAvailableOnly = signal(true);
  filters = signal<{
    volunteerTeamId: number | null;
    location: string;
    date: string;
    status: VolunteerMissionStatus | '';
  }>({
    volunteerTeamId: null,
    location: '',
    date: '',
    status: '',
  });

  missionForm = form(this.missionModel, (path) => {
    required(path.title);
    required(path.status);
  });

  shiftForm = form(this.shiftModel, (path) => {
    required(path.startAt);
    required(path.endAt);
  });

  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['ADMIN', 'COORDINATOR', 'VOLUNTEERS', 'HEALTH', 'ANIMATOR', 'LOGISTICS']),
  );

  readonly teamIds = computed(() => this.teams().map((team) => team.id));

  readonly teamFilterItems = computed(() => [null, ...this.teams().map((team) => team.id)]);
  readonly missionStatusFilterItems = ['', ...this.missionStatuses];
  readonly assignmentStatusFilterItems = ['', ...this.assignmentStatuses];
  readonly skillFilterItems = ['', ...this.allSkills];

  stringifyTeam = (id: number | null): string => {
    if (id === null) {
      return 'Mission transversale';
    }

    const team = this.teams().find((item) => item.id === id);
    return team ? `${team.code} · ${team.name}` : 'Mission transversale';
  };

  stringifyTeamFilter = (id: number | null): string => {
    if (id === null) {
      return 'Toutes';
    }

    return this.stringifyTeam(id);
  };

  stringifyMissionStatus = (status: VolunteerMissionStatus): string =>
    this.missionStatusLabel(status);

  stringifyMissionStatusFilter = (status: VolunteerMissionStatus | ''): string =>
    status ? this.missionStatusLabel(status) : 'Tous';

  stringifyAssignmentStatusFilter = (status: VolunteerShiftAssignmentStatus | ''): string =>
    status ? this.assignmentStatusLabel(status) : 'Toutes';

  stringifySkillFilter = (skill: VolunteerSkillType | ''): string => skill || 'Compétence';

  ngOnInit(): void {
    this.teamsApi.list().subscribe((teams) => this.teams.set(teams));
    this.loadMissions();
  }

  setTeamFilter(rawTeamId: string): void {
    this.filters.update((filters) => ({
      ...filters,
      volunteerTeamId: rawTeamId ? Number(rawTeamId) : null,
    }));
    this.loadMissions();
  }

  setLocationFilter(location: string): void {
    this.filters.update((filters) => ({ ...filters, location }));
    this.loadMissions();
  }

  setDateFilter(date: string): void {
    this.filters.update((filters) => ({ ...filters, date }));
    this.loadMissions();
  }

  setStatusFilter(status: string): void {
    this.filters.update((filters) => ({
      ...filters,
      status: status as VolunteerMissionStatus | '',
    }));
    this.loadMissions();
  }

  openMission(mission: VolunteerMission): void {
    this.selectedMission.set(mission);
    this.drawerMode.set('detail');
    this.opened.set(true);
    this.resetShiftForm();
    this.loadShifts(mission.id);
  }

  openCreateMission(): void {
    this.selectedMission.set(null);
    this.missionModel.set(missionDraft());
    this.drawerMode.set('create');
    this.opened.set(true);
  }

  openEditMission(): void {
    const mission = this.requireMission();
    this.missionModel.set({
      title: mission.title,
      description: mission.description || '',
      volunteerTeamId: mission.volunteerTeamId,
      location: mission.location || '',
      responsibleVolunteerId: mission.responsibleVolunteerId,
      status: mission.status,
      isOptional: mission.isOptional,
    });
    this.drawerMode.set('edit');
  }

  saveMission(): void {
    submit(this.missionForm, async () => {
      const payload = this.missionModel();
      const request =
        this.drawerMode() === 'create'
          ? this.missionsApi.create(payload)
          : this.missionsApi.update(this.requireMission().id, payload);

      request.subscribe((mission) => {
        this.loadMissions();
        this.openMission(mission);
      });
    });
  }

  removeMission(): void {
    const mission = this.requireMission();
    if (!confirm(`Supprimer la mission "${mission.title}" ?`)) {
      return;
    }

    this.missionsApi.delete(mission.id).subscribe(() => {
      this.opened.set(false);
      this.loadMissions();
    });
  }

  changeMissionStatus(status: VolunteerMissionStatus): void {
    const mission = this.requireMission();
    this.missionsApi.changeStatus(mission.id, { status }).subscribe((updated) => {
      this.selectedMission.set(updated);
      this.loadMissions();
    });
  }

  startEditShift(shift: VolunteerShift): void {
    this.editingShiftId.set(shift.id);
    this.shiftModel.set({
      startAt: this.toLocalDateTime(shift.startAt),
      endAt: this.toLocalDateTime(shift.endAt),
      location: shift.location || '',
      capacity: shift.capacity,
      status: shift.status,
      isOptional: shift.isOptional,
      notes: shift.notes || '',
    });
  }

  saveShift(): void {
    const mission = this.requireMission();
    submit(this.shiftForm, async () => {
      const payload = this.normalizeShiftPayload(this.shiftModel());
      const request = this.editingShiftId()
        ? this.missionsApi.updateShift(mission.id, this.editingShiftId() as number, payload)
        : this.missionsApi.createShift(mission.id, payload);

      request.subscribe(() => {
        this.resetShiftForm();
        this.loadShifts(mission.id);
      });
    });
  }

  removeShift(shiftId: number): void {
    const mission = this.requireMission();
    if (!confirm('Supprimer ce shift ?')) {
      return;
    }

    this.missionsApi.deleteShift(mission.id, shiftId).subscribe(() => {
      this.loadShifts(mission.id);
      if (this.editingShiftId() === shiftId) {
        this.resetShiftForm();
      }
    });
  }

  changeShiftStatus(shiftId: number, status: string): void {
    const mission = this.requireMission();
    this.missionsApi
      .changeShiftStatus(mission.id, shiftId, { status: status as VolunteerShiftStatus })
      .subscribe(() => {
        this.loadShifts(mission.id);
      });
  }

  resetShiftForm(): void {
    this.editingShiftId.set(null);
    this.shiftModel.set(shiftDraft());
  }

  missionStatusLabel(status: VolunteerMissionStatus): string {
    return {
      [VolunteerMissionStatus.DRAFT]: 'Brouillon',
      [VolunteerMissionStatus.TODO]: 'À faire',
      [VolunteerMissionStatus.IN_PROGRESS]: 'En cours',
      [VolunteerMissionStatus.DONE]: 'Terminée',
      [VolunteerMissionStatus.CANCELLED]: 'Annulée',
      [VolunteerMissionStatus.NOT_DONE]: 'Non réalisée',
    }[status];
  }

  shiftStatusLabel(status: VolunteerShiftStatus): string {
    return {
      [VolunteerShiftStatus.TODO]: 'À faire',
      [VolunteerShiftStatus.ASSIGNED]: 'Assigné',
      [VolunteerShiftStatus.IN_PROGRESS]: 'En cours',
      [VolunteerShiftStatus.DONE]: 'Terminé',
      [VolunteerShiftStatus.CANCELLED]: 'Annulé',
      [VolunteerShiftStatus.NOT_DONE]: 'Non réalisé',
    }[status];
  }

  assignmentStatusLabel(status: VolunteerShiftAssignmentStatus): string {
    return {
      [VolunteerShiftAssignmentStatus.PROVISIONAL]: 'Provisoire',
      [VolunteerShiftAssignmentStatus.CONFIRMED]: 'Confirmée',
      [VolunteerShiftAssignmentStatus.CANCELLED]: 'Annulée',
    }[status];
  }

  filteredAssignmentsForShift(shift: VolunteerShift): VolunteerShiftAssignment[] {
    const filter = this.assignmentStatusFilters()[shift.id];
    const list = shift.assignments ?? [];
    return filter ? list.filter((assignment) => assignment.status === filter) : list;
  }

  setAssignmentStatusFilter(shiftId: number, status: string): void {
    this.assignmentStatusFilters.update((filters) => ({
      ...filters,
      [shiftId]: (status as VolunteerShiftAssignmentStatus) || '',
    }));
  }

  searchVolunteersForShift(shift: VolunteerShift): void {
    this.assignmentsApi
      .searchVolunteers({
        shiftId: shift.id,
        q: this.assignmentSearchQuery() || undefined,
        skill: this.assignmentSearchSkill(),
        tag: this.assignmentSearchTag() || undefined,
        availableOnly: this.assignmentSearchAvailableOnly(),
      })
      .subscribe((results) => {
        this.assignmentSearchResults.update((state) => ({ ...state, [shift.id]: results }));
      });
  }

  assignVolunteer(
    shift: VolunteerShift,
    volunteerId: number,
    status: VolunteerShiftAssignmentStatus,
    force = false,
  ): void {
    const mission = this.requireMission();
    this.assignmentsApi
      .create(mission.id, shift.id, {
        volunteerId,
        status,
        notes: this.assignmentModel().notes,
        force,
      })
      .subscribe({
        next: () => this.loadShifts(mission.id),
        error: (error: HttpErrorResponse) => {
          if (error.status === 409 && error.error?.canForce) {
            if (confirm("Chevauchement détecté. Forcer l'affectation ?")) {
              this.assignVolunteer(shift, volunteerId, status, true);
            }
          }
        },
      });
  }

  changeAssignmentStatus(
    shift: VolunteerShift,
    assignment: VolunteerShiftAssignment,
    status: string,
    force = false,
  ): void {
    const mission = this.requireMission();
    this.assignmentsApi
      .changeStatus(mission.id, shift.id, assignment.id, {
        status: status as VolunteerShiftAssignmentStatus,
        force,
      })
      .subscribe({
        next: () => this.loadShifts(mission.id),
        error: (error: HttpErrorResponse) => {
          if (error.status === 409 && error.error?.canForce) {
            if (confirm('Chevauchement détecté. Forcer ce changement de statut ?')) {
              this.changeAssignmentStatus(shift, assignment, status, true);
            }
          }
        },
      });
  }

  cancelAssignment(shift: VolunteerShift, assignment: VolunteerShiftAssignment): void {
    const mission = this.requireMission();
    this.assignmentsApi
      .cancel(mission.id, shift.id, assignment.id)
      .subscribe(() => this.loadShifts(mission.id));
  }

  statusAppearance(
    status: VolunteerMissionStatus | VolunteerShiftStatus | VolunteerShiftAssignmentStatus,
  ): string {
    if (status === VolunteerMissionStatus.DONE || status === VolunteerShiftStatus.DONE)
      return 'positive';
    if (status === VolunteerShiftAssignmentStatus.CONFIRMED) return 'positive';
    if (status === VolunteerShiftAssignmentStatus.PROVISIONAL) return 'warning';
    if (
      status === VolunteerMissionStatus.IN_PROGRESS ||
      status === VolunteerShiftStatus.IN_PROGRESS
    )
      return 'warning';
    if (status === VolunteerMissionStatus.CANCELLED || status === VolunteerShiftStatus.CANCELLED)
      return 'negative';
    if (status === VolunteerShiftAssignmentStatus.CANCELLED) return 'negative';
    if (status === VolunteerMissionStatus.NOT_DONE || status === VolunteerShiftStatus.NOT_DONE)
      return 'negative';
    if (status === VolunteerShiftStatus.ASSIGNED) return 'info';
    return 'neutral';
  }

  private loadMissions(): void {
    const filters = this.filters();
    this.loading.set(true);
    this.missionsApi
      .listFiltered({
        volunteerTeamId: filters.volunteerTeamId,
        location: filters.location || undefined,
        date: filters.date || undefined,
        status: filters.status || undefined,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((missions) => this.missions.set(missions));
  }

  private loadShifts(missionId: number): void {
    this.shiftsLoading.set(true);
    this.missionsApi
      .listShifts(missionId)
      .pipe(finalize(() => this.shiftsLoading.set(false)))
      .subscribe((shifts) => this.shifts.set(shifts));
  }

  private requireMission(): VolunteerMission {
    const mission = this.selectedMission();
    if (!mission) {
      throw new Error('No mission selected');
    }
    return mission;
  }

  private normalizeShiftPayload(payload: VolunteerShiftPayload): VolunteerShiftPayload {
    return {
      ...payload,
      startAt: new Date(payload.startAt).toISOString(),
      endAt: new Date(payload.endAt).toISOString(),
      location: payload.location?.trim() || null,
      notes: payload.notes?.trim() || null,
      capacity:
        payload.capacity == null || payload.capacity === ('' as never)
          ? null
          : Number(payload.capacity),
    };
  }

  private toLocalDateTime(isoDate: string): string {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
