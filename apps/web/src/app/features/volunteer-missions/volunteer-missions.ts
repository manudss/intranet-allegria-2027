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
import { SHARED_IMPORTS } from '../../shared/shared-imports';

const MISSION_STATUSES = Object.values(VolunteerMissionStatus);
const SHIFT_STATUSES = Object.values(VolunteerShiftStatus);
const ASSIGNMENT_STATUSES = Object.values(VolunteerShiftAssignmentStatus);

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
  imports: [...SHARED_IMPORTS],
  template: `<app-page-layout title="Missions opérationnelles" description="Pilotage des missions bénévoles et des shifts">
      @if (canWrite()) {
        <button actions tuiButton (click)="openCreateMission()">Nouvelle mission</button>
      }

      <div class="filters">
        <label>
          <span>Équipe</span>
          <select [value]="filters().volunteerTeamId ?? ''" (change)="setTeamFilter($any($event.target).value)">
            <option value="">Toutes</option>
            @for (team of teams(); track team.id) {
              <option [value]="team.id">{{ team.code }} · {{ team.name }}</option>
            }
          </select>
        </label>
        <label>
          <span>Lieu</span>
          <input [value]="filters().location" placeholder="Gymnase, chapelle..." (input)="setLocationFilter($any($event.target).value)" />
        </label>
        <label>
          <span>Date</span>
          <input type="date" [value]="filters().date" (input)="setDateFilter($any($event.target).value)" />
        </label>
        <label>
          <span>Statut</span>
          <select [value]="filters().status" (change)="setStatusFilter($any($event.target).value)">
            <option value="">Tous</option>
            @for (status of missionStatuses; track status) {
              <option [value]="status">{{ missionStatusLabel(status) }}</option>
            }
          </select>
        </label>
      </div>

      @if (loading()) {
        <tui-loader />
      } @else {
        <app-data-table [rows]="missions()" [columns]="columns" (rowSelected)="openMission($event)" />
      }
    </app-page-layout>

    @if (opened()) {
      <tui-drawer direction="end">
        <header>
          <h2>{{ drawerMode() === 'detail' ? selectedMission()?.title : drawerMode() === 'create' ? 'Nouvelle mission' : 'Modifier mission' }}</h2>
        </header>

        @if (drawerMode() === 'detail') {
          <dl>
            <dt>Statut</dt>
            <dd><span size="m" tuiBadge [appearance]="statusAppearance(selectedMission()?.status || VolunteerMissionStatus.DRAFT)">{{ missionStatusLabel(selectedMission()?.status || VolunteerMissionStatus.DRAFT) }}</span></dd>
            <dt>Équipe</dt>
            <dd>{{ selectedMission()?.volunteerTeam?.name || 'Mission transversale' }}</dd>
            <dt>Lieu</dt>
            <dd>{{ selectedMission()?.location || '—' }}</dd>
            <dt>Optionnelle</dt>
            <dd>{{ selectedMission()?.isOptional ? 'Oui' : 'Non' }}</dd>
            <dt>Description</dt>
            <dd>{{ selectedMission()?.description || '—' }}</dd>
          </dl>

          @if (canWrite()) {
            <div class="status-actions">
              @for (status of missionStatuses; track status) {
                <button tuiButton size="s" type="button" [appearance]="status === selectedMission()?.status ? 'primary' : 'secondary'" [disabled]="status === selectedMission()?.status" (click)="changeMissionStatus(status)">{{ missionStatusLabel(status) }}</button>
              }
            </div>
          }

          <section>
            <h3>Shifts</h3>
            @if (shiftsLoading()) {
              <tui-loader />
            } @else if (shifts().length === 0) {
              <p>Aucun shift pour cette mission.</p>
            } @else {
              <ul class="shift-list">
                @for (shift of shifts(); track shift.id) {
                  <li>
                    <div class="shift-head">
                      <strong>{{ shift.startAt | date: 'shortTime' }} - {{ shift.endAt | date: 'shortTime' }}</strong>
                      <span size="s" tuiBadge [appearance]="statusAppearance(shift.status)">{{ shiftStatusLabel(shift.status) }}</span>
                    </div>
                    <p>{{ shift.location || selectedMission()?.location || 'Sans lieu' }} · Capacité {{ shift.capacity || '—' }}</p>
                    <p>
                      Affectés actifs : {{ shift.activeAssignmentsCount ?? 0 }} · Confirmés : {{ shift.confirmedAssignmentsCount ?? 0 }}
                    </p>
                    <small>{{ shift.notes || 'Aucune note' }}</small>
                    <div class="shift-assignments">
                      <label>
                        <span>Filtrer affectations</span>
                        <select
                          [value]="assignmentStatusFilters()[shift.id] || ''"
                          (change)="setAssignmentStatusFilter(shift.id, $any($event.target).value)"
                        >
                          <option value="">Toutes</option>
                          @for (status of assignmentStatuses; track status) {
                            <option [value]="status">{{ assignmentStatusLabel(status) }}</option>
                          }
                        </select>
                      </label>
                      @if (filteredAssignmentsForShift(shift).length === 0) {
                        <p>Aucune affectation.</p>
                      } @else {
                        <ul>
                          @for (assignment of filteredAssignmentsForShift(shift); track assignment.id) {
                            <li>
                              <strong>{{ assignment.volunteer.lastName }} {{ assignment.volunteer.firstName }}</strong>
                              <span size="s" tuiBadge [appearance]="statusAppearance(assignment.status)">{{ assignmentStatusLabel(assignment.status) }}</span>
                              <small> · par {{ assignment.assignedByUser.email }}</small>
                              @if (canWrite()) {
                                <select [value]="assignment.status" (change)="changeAssignmentStatus(shift, assignment, $any($event.target).value)">
                                  @for (status of assignmentStatuses; track status) {
                                    <option [value]="status">{{ assignmentStatusLabel(status) }}</option>
                                  }
                                </select>
                                <button tuiButton size="s" appearance="secondary-destructive" type="button" (click)="cancelAssignment(shift, assignment)">
                                  Annuler
                                </button>
                              }
                            </li>
                          }
                        </ul>
                      }

                      @if (canWrite()) {
                        <div class="assign-search">
                          <input
                            placeholder="Recherche bénévole"
                            [value]="assignmentSearchQuery()"
                            (input)="assignmentSearchQuery.set($any($event.target).value)"
                          />
                          <select [value]="assignmentSearchSkill() || ''" (change)="assignmentSearchSkill.set($any($event.target).value || null)">
                            <option value="">Compétence</option>
                            @for (skill of allSkills; track skill) {
                              <option [value]="skill">{{ skill }}</option>
                            }
                          </select>
                          <input
                            placeholder="Tag"
                            [value]="assignmentSearchTag()"
                            (input)="assignmentSearchTag.set($any($event.target).value)"
                          />
                          <label class="check">
                            <input type="checkbox" [checked]="assignmentSearchAvailableOnly()" (change)="assignmentSearchAvailableOnly.set($any($event.target).checked)" />
                            Disponibles
                          </label>
                          <button tuiButton size="s" type="button" (click)="searchVolunteersForShift(shift)">Rechercher</button>
                        </div>
                        @if (assignmentSearchResults()[shift.id]?.length) {
                          <ul>
                            @for (entry of assignmentSearchResults()[shift.id]; track entry.volunteer.id) {
                              <li>
                                {{ entry.volunteer.lastName }} {{ entry.volunteer.firstName }}
                                @if (entry.hasOverlap) {
                                  <small class="warning">Chevauchement détecté</small>
                                }
                                <button tuiButton size="s" type="button" (click)="assignVolunteer(shift, entry.volunteer.id, VolunteerShiftAssignmentStatus.PROVISIONAL)">
                                  Provisoire
                                </button>
                                <button tuiButton size="s" type="button" (click)="assignVolunteer(shift, entry.volunteer.id, VolunteerShiftAssignmentStatus.CONFIRMED)">
                                  Confirmée
                                </button>
                              </li>
                            }
                          </ul>
                        }
                      }
                    </div>
                    @if (canWrite()) {
                      <div class="shift-actions">
                        <button tuiButton size="s" appearance="secondary" type="button" (click)="startEditShift(shift)">Modifier</button>
                        <button tuiButton size="s" appearance="secondary-destructive" type="button" (click)="removeShift(shift.id)">Supprimer</button>
                        <select [value]="shift.status" (change)="changeShiftStatus(shift.id, $any($event.target).value)">
                          @for (status of shiftStatuses; track status) {
                            <option [value]="status">{{ shiftStatusLabel(status) }}</option>
                          }
                        </select>
                      </div>
                    }
                  </li>
                }
              </ul>
            }

            @if (canWrite()) {
              <h4>{{ editingShiftId() ? 'Modifier un shift' : 'Ajouter un shift' }}</h4>
              <form class="drawer-form">
                <tui-textfield iconStart="@tui.clock">
                  <label for="debut-2" tuiLabel>Début</label><input tuiInput type="datetime-local" [formField]="shiftForm.startAt" id="debut-2" />
                </tui-textfield>
                <tui-textfield iconStart="@tui.clock">
                  <label for="fin-2" tuiLabel>Fin</label><input tuiInput type="datetime-local" [formField]="shiftForm.endAt" id="fin-2" />
                </tui-textfield>
                <tui-textfield iconStart="@tui.map-pin">
                  <label for="lieu-2" tuiLabel>Lieu</label><input tuiInput [formField]="$any(shiftForm.location)" id="lieu-2" />
                </tui-textfield>
                <tui-textfield iconStart="@tui.users">
                  <label for="capacite-2" tuiLabel>Capacité</label><input tuiInput type="number" [formField]="shiftForm.capacity" id="capacite-2" />
                </tui-textfield>
                <label class="check"><input type="checkbox" [formField]="shiftForm.isOptional" /> Optionnel</label>
                <tui-textfield iconStart="@tui.file-text" class="wide">
                  <label for="notes-2" tuiLabel>Notes</label><textarea tuiTextarea [formField]="$any(shiftForm.notes)" id="notes-2"></textarea>
                </tui-textfield>
              </form>
              <div class="shift-form-actions">
                <button tuiButton appearance="flat" type="button" (click)="resetShiftForm()">Réinitialiser</button>
                <button tuiButton type="button" (click)="saveShift()">{{ editingShiftId() ? 'Mettre à jour' : 'Ajouter' }}</button>
              </div>
            }
          </section>
        } @else {
          <form class="drawer-form">
            <tui-textfield iconStart="@tui.briefcase">
              <label for="titre-2" tuiLabel>Titre</label><input tuiInput [formField]="missionForm.title" id="titre-2" />
            </tui-textfield>
            <tui-textfield iconStart="@tui.map-pin">
              <label for="lieu-3" tuiLabel>Lieu</label><input tuiInput [formField]="missionForm.location" id="lieu-3" />
            </tui-textfield>
            <tui-textfield iconStart="@tui.users" tuiChevron [stringify]="stringifyTeam">
              <label for="equipe-operationnelle" tuiLabel>Équipe opérationnelle</label><select tuiSelect [items]="teamIds()" [formField]="missionForm.volunteerTeamId" id="equipe-operationnelle"></select>
            </tui-textfield>
            <tui-textfield iconStart="@tui.activity" tuiChevron [stringify]="stringifyMissionStatus">
              <label for="statut-2" tuiLabel>Statut</label><select tuiSelect [items]="missionStatuses" [formField]="missionForm.status" id="statut-2"></select>
            </tui-textfield>
            <label class="check"><input type="checkbox" [formField]="missionForm.isOptional" /> Optionnelle</label>
            <tui-textfield iconStart="@tui.file-text" class="wide">
              <label for="description-2" tuiLabel>Description</label><textarea tuiTextarea [formField]="$any(missionForm.description)" id="description-2"></textarea>
            </tui-textfield>
          </form>
        }

        <footer>
          <button tuiButton appearance="flat" type="button" (click)="opened.set(false)">Fermer</button>
          @if (drawerMode() === 'detail' && canWrite()) {
            <button tuiButton type="button" (click)="openEditMission()">Modifier</button>
            <button tuiButton appearance="secondary-destructive" type="button" (click)="removeMission()">Supprimer</button>
          } @else if (drawerMode() !== 'detail') {
            <button tuiButton type="button" (click)="saveMission()">Enregistrer</button>
          }
        </footer>
      </tui-drawer>
    }`,
  styles: [`
    .filters { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); margin-block-end: .75rem; }
    .filters label { display: grid; gap: .25rem; }
    .filters select, .filters input { min-block-size: 2.75rem; border-radius: .5rem; border: 1px solid var(--tui-border-normal); padding-inline: .625rem; }
    .status-actions, .shift-actions, .shift-form-actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-block: .75rem; }
    .shift-list { display: grid; gap: .75rem; list-style: none; margin: 0; padding: 0; }
    .shift-list li { border: 1px solid var(--tui-border-normal); border-radius: .75rem; padding: .75rem; }
    .shift-head { display: flex; justify-content: space-between; gap: .5rem; align-items: center; }
    .shift-actions select { min-block-size: 2.75rem; }
    .shift-assignments { margin-top: .75rem; display: grid; gap: .5rem; }
    .shift-assignments ul { margin: 0; padding-left: 1rem; display: grid; gap: .35rem; }
    .shift-assignments select, .assign-search input { min-block-size: 2.5rem; border-radius: .5rem; border: 1px solid var(--tui-border-normal); padding-inline: .5rem; }
    .assign-search { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .5rem; align-items: end; }
    .warning { color: #b85c00; margin-left: .35rem; }
  `],
  styleUrl: '../../shared/crud.scss',
})
export class VolunteerMissionsPage implements OnInit {
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
      presentation: { type: 'chip', autoColor: true },
    },
    {
      key: 'status',
      label: 'Statut',
      type: 'list',
      value: (mission) => this.missionStatusLabel(mission.status),
      filterValue: (mission) => mission.status,
      presentation: {
        type: 'badge',
        appearance: (mission) => this.statusAppearance(mission.status),
      },
    },
    {
      key: 'location',
      label: 'Lieu',
      type: 'text',
      value: (mission) => mission.location || '—',
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
  assignmentSearchResults = signal<Record<number, { volunteer: Volunteer; hasOverlap: boolean }[]>>({});
  assignmentSearchQuery = signal('');
  assignmentSearchSkill = signal<VolunteerSkillType | null>(null);
  assignmentSearchTag = signal('');
  assignmentSearchAvailableOnly = signal(true);
  filters = signal<{ volunteerTeamId: number | null; location: string; date: string; status: VolunteerMissionStatus | '' }>({
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

  stringifyTeam = (id: number): string => {
    const team = this.teams().find((item) => item.id === id);
    return team ? `${team.code} · ${team.name}` : 'Mission transversale';
  };

  stringifyMissionStatus = (status: VolunteerMissionStatus): string => this.missionStatusLabel(status);

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
    this.missionsApi.changeShiftStatus(mission.id, shiftId, { status: status as VolunteerShiftStatus }).subscribe(() => {
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

  assignVolunteer(shift: VolunteerShift, volunteerId: number, status: VolunteerShiftAssignmentStatus, force = false): void {
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
            if (confirm('Chevauchement détecté. Forcer l\'affectation ?')) {
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
    this.assignmentsApi.cancel(mission.id, shift.id, assignment.id).subscribe(() => this.loadShifts(mission.id));
  }

  statusAppearance(status: VolunteerMissionStatus | VolunteerShiftStatus | VolunteerShiftAssignmentStatus): string {
    if (status === VolunteerMissionStatus.DONE || status === VolunteerShiftStatus.DONE) return 'positive';
    if (status === VolunteerShiftAssignmentStatus.CONFIRMED) return 'positive';
    if (status === VolunteerShiftAssignmentStatus.PROVISIONAL) return 'warning';
    if (status === VolunteerMissionStatus.IN_PROGRESS || status === VolunteerShiftStatus.IN_PROGRESS) return 'warning';
    if (status === VolunteerMissionStatus.CANCELLED || status === VolunteerShiftStatus.CANCELLED) return 'negative';
    if (status === VolunteerShiftAssignmentStatus.CANCELLED) return 'negative';
    if (status === VolunteerMissionStatus.NOT_DONE || status === VolunteerShiftStatus.NOT_DONE) return 'negative';
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
      capacity: payload.capacity == null || payload.capacity === ('' as never) ? null : Number(payload.capacity),
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








