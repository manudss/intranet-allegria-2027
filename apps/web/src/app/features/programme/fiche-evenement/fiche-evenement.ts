import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TuiTabs } from '@taiga-ui/kit';
import { AuthService } from '../../../core/auth.service';
import {
  EventPreparationTask,
  Group,
  ProgramChangeLogAction,
  ProgramChangeLogEntry,
  ProgramDocumentLink,
  ProgramResizePreview,
  ProgramSequence,
  ProgramSequenceDetail,
  ProgramSequenceStatus,
  ProgramSequenceTrack,
  ProgramSequenceVisibility,
  VolunteerMission,
  VolunteerMissionStatus,
  VolunteerTeam,
} from '../../../models/models';
import {
  GroupsApiService,
  ProgramApiService,
  VolunteerMissionsApiService,
  VolunteerTeamsApiService,
} from '../../../services/api.services';
import { SHARED_IMPORTS } from '../../../shared/shared-imports';
import { minutesToTime, timeToMinutes } from '../schedule-time.util';

const TRACK_LABELS: Record<ProgramSequenceTrack, string> = {
  [ProgramSequenceTrack.TA]: 'Piste TA',
  [ProgramSequenceTrack.ES]: 'Piste ES',
  [ProgramSequenceTrack.COMMON]: 'Temps commun',
};

const VISIBILITY_LABELS: Record<ProgramSequenceVisibility, string> = {
  [ProgramSequenceVisibility.PUBLIC]: 'Public',
  [ProgramSequenceVisibility.INTERNAL]: 'Réservé bénévoles-coordinateurs',
};

const ACTION_LABELS: Record<ProgramChangeLogAction, string> = {
  INSERT: 'Insertion',
  UPDATE: 'Modification',
  MOVE: 'Déplacement',
  RESIZE: 'Redimensionnement',
  DELETE: 'Suppression',
  FREEZE: 'Figer',
  UNFREEZE: 'Défiger',
};

/** Présélections d'échéance relative pour les tâches de préparation. */
const OFFSET_PRESETS: { value: number; label: string }[] = [
  { value: 30, label: '30 min avant le début' },
  { value: 60, label: '1 h avant le début' },
  { value: 120, label: '2 h avant le début' },
  { value: 180, label: '3 h avant le début' },
  { value: 360, label: '6 h avant le début' },
  { value: 720, label: '12 h avant le début' },
  { value: 1440, label: '1 jour avant le début' },
  { value: 2880, label: '2 jours avant le début' },
  { value: 10080, label: '7 jours avant le début' },
];

const TABS = ['Détails', 'Missions & tâches', 'Groupes concernés', 'Documents', 'Historique'];

interface NewMissionDraft {
  title: string;
  volunteerTeamId: number | null;
  location: string;
}

interface EditDraft {
  title: string;
  notes: string;
  track: ProgramSequenceTrack;
  visibility: ProgramSequenceVisibility;
  volunteerTeamId: number | null;
  minDurationMinutes: number | null;
  minMarginMinutes: number | null;
}

interface TaskDraft {
  title: string;
  dueKind: 'offset' | 'date';
  dueOffsetMinutes: number;
  dueDate: string;
  responsible: string;
}

/**
 * Fiche événement : vue complète d'un créneau du programme (détails, missions et tâches,
 * groupes concernés, documents, historique), accessible depuis le planning.
 */
@Component({
  selector: 'app-fiche-evenement',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink, TuiTabs],
  templateUrl: './fiche-evenement.html',
  styleUrl: './fiche-evenement.scss',
})
export class FicheEvenementPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProgramApiService);
  private readonly groupsApi = inject(GroupsApiService);
  private readonly missionsApi = inject(VolunteerMissionsApiService);
  private readonly teamsApi = inject(VolunteerTeamsApiService);
  private readonly auth = inject(AuthService);

  readonly ProgramSequenceStatus = ProgramSequenceStatus;
  readonly ProgramSequenceTrack = ProgramSequenceTrack;
  readonly ProgramSequenceVisibility = ProgramSequenceVisibility;
  readonly TRACK_LABELS = TRACK_LABELS;
  readonly VISIBILITY_LABELS = VISIBILITY_LABELS;
  readonly OFFSET_PRESETS = OFFSET_PRESETS;
  readonly TABS = TABS;

  readonly canEdit = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));

  readonly sequenceId = signal<number | null>(null);
  readonly sequence = signal<ProgramSequenceDetail | null>(null);
  readonly tasks = signal<EventPreparationTask[]>([]);
  readonly groups = signal<Group[]>([]);
  readonly missions = signal<VolunteerMission[]>([]);
  readonly teams = signal<VolunteerTeam[]>([]);
  readonly daySequences = signal<ProgramSequence[]>([]);
  readonly logs = signal<ProgramChangeLogEntry[]>([]);
  readonly logsLoaded = signal(false);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busy = signal(false);

  readonly tabIndex = signal(0);
  readonly editing = signal(false);
  readonly editDraft = signal<EditDraft | null>(null);
  readonly taskDraft = signal<TaskDraft>({
    title: '',
    dueKind: 'offset',
    dueOffsetMinutes: 180,
    dueDate: '',
    responsible: '',
  });
  readonly taskFormError = signal<string | null>(null);
  readonly missionToAdd = signal<number | null>(null);
  readonly newMission = signal<NewMissionDraft | null>(null);
  readonly missionFormError = signal<string | null>(null);
  readonly groupToAdd = signal<number | null>(null);
  readonly newGroup = signal<{ name: string; diocese: string } | null>(null);
  readonly newDoc = signal<{ label: string; url: string }>({ label: '', url: '' });
  readonly docFormError = signal<string | null>(null);

  // ---- Édition des horaires via les opérations chaînées (aperçu puis validation) ----
  readonly timeEdit = signal<{ startTime: string; durationMinutes: number } | null>(null);
  readonly timePreview = signal<ProgramResizePreview | null>(null);
  readonly timePreviewTarget = signal<ProgramSequence | null>(null);
  readonly parallelPreview = signal<ProgramResizePreview | null>(null);
  readonly syncParallel = signal(false);
  readonly timeError = signal<string | null>(null);

  /** Onglets avec compteurs, comme la maquette validée. */
  readonly tabLabels = computed(() => {
    const sequence = this.sequence();
    if (!sequence) return TABS;
    return [
      TABS[0],
      `${TABS[1]} ${sequence.missionIds.length} · ${this.tasks().length}`,
      `${TABS[2]} ${sequence.groupIds.length}`,
      `${TABS[3]} ${sequence.documentLinks.length}`,
      TABS[4],
    ];
  });

  readonly linkedGroups = computed(() => {
    const sequence = this.sequence();
    if (!sequence) return [];
    const byId = new Map(this.groups().map((g) => [g.id, g]));
    return sequence.groupIds
      .map((id) => byId.get(id))
      .filter((g): g is Group => !!g);
  });

  readonly availableGroups = computed(() => {
    const sequence = this.sequence();
    if (!sequence) return this.groups();
    const linked = new Set(sequence.groupIds);
    return this.groups().filter((g) => !linked.has(g.id));
  });

  readonly linkedMissions = computed(() => {
    const sequence = this.sequence();
    if (!sequence) return [];
    const byId = new Map(this.missions().map((m) => [m.id, m]));
    return sequence.missionIds
      .map((id) => byId.get(id))
      .filter((m): m is VolunteerMission => !!m);
  });

  readonly availableMissions = computed(() => {
    const sequence = this.sequence();
    if (!sequence) return this.missions();
    const linked = new Set(sequence.missionIds);
    return this.missions().filter((m) => !linked.has(m.id));
  });

  /** Créneaux avant / après dans la chaîne principale et voies parallèles du même repère. */
  readonly chainContext = computed(() => {
    const sequence = this.sequence();
    if (!sequence) return { previous: null, next: null, parallels: [] as ProgramSequence[] };
    const all = this.daySequences();
    return {
      previous: all.find((s) => s.id === sequence.previousSequenceId) ?? null,
      next: all.find((s) => s.previousSequenceId === sequence.id) ?? null,
      parallels: all.filter((s) => s.anchorSequenceId === sequence.id),
    };
  });

  readonly dateLabel = computed(() => {
    const sequence = this.sequence();
    if (!sequence) return '';
    const [year, month, day] = sequence.eventDate.split('-').map(Number);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (!Number.isInteger(id) || id <= 0) {
        this.loadError.set('Identifiant de créneau invalide.');
        this.loading.set(false);
        return;
      }
      this.sequenceId.set(id);
      this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      sequence: this.api.getSequence(id),
      tasks: this.api.listTasks(id),
      groups: this.groupsApi.list(),
      missions: this.missionsApi.list(),
      teams: this.teamsApi.list(),
    }).subscribe({
      next: ({ sequence, tasks, groups, missions, teams }) => {
        this.sequence.set(sequence);
        this.tasks.set(tasks);
        this.groups.set(groups);
        this.missions.set(missions);
        this.teams.set(teams);
        this.loading.set(false);
        this.api.getDay(sequence.eventDate).subscribe({
          next: (day) => this.daySequences.set(day.sequences),
          error: () => this.daySequences.set([]),
        });
      },
      error: () => {
        this.loadError.set("Impossible de charger la fiche de ce créneau.");
        this.loading.set(false);
      },
    });
  }

  selectTab(index: number): void {
    this.tabIndex.set(index);
    const id = this.sequenceId();
    if (index === 4 && id && !this.logsLoaded()) {
      this.logsLoaded.set(true);
      this.api.getChangeLog(undefined, id).subscribe({
        next: (logs) => this.logs.set(logs),
        error: () => this.logs.set([]),
      });
    }
  }

  // ---- En-tête : figer / défiger, dupliquer ----

  toggleFreeze(): void {
    const sequence = this.sequence();
    if (!sequence || this.busy()) return;
    this.busy.set(true);
    const request =
      sequence.status === ProgramSequenceStatus.FROZEN
        ? this.api.unfreeze(sequence.id)
        : this.api.freeze(sequence.id);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.reloadSequence();
      },
      error: () => this.fail('Le changement de fige a échoué.'),
    });
  }

  duplicate(): void {
    const sequence = this.sequence();
    if (!sequence || this.busy()) return;
    this.busy.set(true);
    this.api.duplicateSequence(sequence.id).subscribe({
      next: (copy) => {
        this.busy.set(false);
        this.router.navigate(['/programme/evenements', copy.id]);
      },
      error: () => this.fail('La duplication a échoué.'),
    });
  }

  // ---- Onglet Détails : horaires (opérations chaînées) ----

  startTimeEdit(): void {
    const sequence = this.sequence();
    if (!sequence) return;
    this.timeEdit.set({ startTime: sequence.startTime, durationMinutes: sequence.durationMinutes });
    this.timePreview.set(null);
    this.timePreviewTarget.set(null);
    this.parallelPreview.set(null);
    this.syncParallel.set(false);
    this.timeError.set(null);
  }

  cancelTimeEdit(): void {
    this.timeEdit.set(null);
    this.timePreview.set(null);
    this.timePreviewTarget.set(null);
    this.parallelPreview.set(null);
    this.timeError.set(null);
  }

  updateTimeEdit(patch: Partial<{ startTime: string; durationMinutes: number }>): void {
    const draft = this.timeEdit();
    if (draft) this.timeEdit.set({ ...draft, ...patch });
    // Toute modification invalide l'aperçu affiché.
    this.timePreview.set(null);
    this.parallelPreview.set(null);
  }

  /** Tête de chaîne : le modèle chaîné ne permet pas de décaler le premier créneau. */
  readonly isChainHead = computed(() => {
    const sequence = this.sequence();
    return !!sequence && sequence.previousSequenceId === null;
  });

  readonly startChanged = computed(() => {
    const sequence = this.sequence();
    const draft = this.timeEdit();
    return !!sequence && !!draft && draft.startTime !== sequence.startTime;
  });

  readonly durationChanged = computed(() => {
    const sequence = this.sequence();
    const draft = this.timeEdit();
    return !!sequence && !!draft && draft.durationMinutes !== sequence.durationMinutes;
  });

  private previousSequence(): ProgramSequence | null {
    const sequence = this.sequence();
    if (!sequence || sequence.previousSequenceId === null) return null;
    return this.daySequences().find((s) => s.id === sequence.previousSequenceId) ?? null;
  }

  /**
   * Aperçu du recalcul : la durée se redimensionne sur le créneau lui-même ; le décalage du
   * début se redimensionne sur le prédécesseur (même invariant que le planning). Une seule
   * opération à la fois : modifier le début OU la durée avant de prévisualiser.
   */
  previewTimeChange(): void {
    const sequence = this.sequence();
    const draft = this.timeEdit();
    if (!sequence || !draft || this.busy()) return;
    this.timeError.set(null);

    if (this.startChanged() && this.durationChanged()) {
      this.timeError.set(
        'Modifiez le début ou la durée, puis prévisualisez : les deux changements ne se valident pas ensemble.',
      );
      return;
    }
    if (!this.startChanged() && !this.durationChanged()) {
      this.timeError.set('Aucun changement à prévisualiser.');
      return;
    }

    let target: ProgramSequence | null = null;
    let newDuration = 0;
    if (this.durationChanged()) {
      target = sequence;
      newDuration = draft.durationMinutes;
    } else {
      const previous = this.previousSequence();
      if (!previous) {
        this.timeError.set(
          'Premier créneau de la chaîne : son début ne peut pas être décalé (le planning fonctionne de la même façon).',
        );
        return;
      }
      const delta = timeToMinutes(draft.startTime) - timeToMinutes(sequence.startTime);
      newDuration = previous.durationMinutes + delta;
      if (newDuration < 5) {
        this.timeError.set('Ce décalage réduirait le créneau précédent à moins de 5 minutes.');
        return;
      }
      target = previous;
    }

    this.busy.set(true);
    this.api.previewResize(target.id, newDuration).subscribe({
      next: (preview) => {
        this.timePreview.set(preview);
        this.timePreviewTarget.set(target);
        // Voie parallèle : proposer d'appliquer la même durée, comme la note de maquette.
        const parallel =
          this.durationChanged() && this.syncParallel() ? this.chainContext().parallels[0] : null;
        if (parallel) {
          this.api.previewResize(parallel.id, draft.durationMinutes).subscribe({
            next: (parallelPreview) => {
              this.busy.set(false);
              this.parallelPreview.set(parallelPreview);
            },
            error: () => this.failTime("L'aperçu de la voie parallèle a échoué."),
          });
        } else {
          this.busy.set(false);
          this.parallelPreview.set(null);
        }
      },
      error: () => this.failTime("L'aperçu du recalcul a échoué."),
    });
  }

  applyTimeChange(): void {
    const preview = this.timePreview();
    const target = this.timePreviewTarget();
    const parallel = this.parallelPreview();
    if (!preview || !target || preview.outcome !== 'ok' || this.busy()) return;
    if (parallel && parallel.outcome !== 'ok') return;
    this.busy.set(true);
    this.api.applyResize(target.id, preview.newDurationMinutes, preview.version).subscribe({
      next: () => {
        if (parallel) {
          this.api.applyResize(parallel.sequenceId, parallel.newDurationMinutes, parallel.version).subscribe({
            next: () => this.finishTimeChange(),
            error: () => this.failTime(
              'Le créneau a été modifié mais la voie parallèle a refusé le changement : rechargez la fiche.',
            ),
          });
        } else {
          this.finishTimeChange();
        }
      },
      error: () => this.failTime("L'application a échoué (la chaîne a peut-être changé entre-temps)."),
    });
  }

  private finishTimeChange(): void {
    this.busy.set(false);
    this.cancelTimeEdit();
    this.reloadSequence();
    const sequence = this.sequence();
    if (sequence) {
      this.api.getDay(sequence.eventDate).subscribe({
        next: (day) => this.daySequences.set(day.sequences),
        error: () => undefined,
      });
    }
  }

  private failTime(message: string): void {
    this.busy.set(false);
    this.timeError.set(message);
  }

  // ---- Onglet Détails : édition ----

  startEdit(): void {
    const sequence = this.sequence();
    if (!sequence) return;
    this.editDraft.set({
      title: sequence.title,
      notes: sequence.notes ?? '',
      track: sequence.track,
      visibility: sequence.visibility,
      volunteerTeamId: sequence.volunteerTeamId,
      minDurationMinutes: sequence.minDurationMinutes,
      minMarginMinutes: sequence.minMarginMinutes,
    });
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editDraft.set(null);
  }

  updateEditDraft(patch: Partial<EditDraft>): void {
    const draft = this.editDraft();
    if (draft) this.editDraft.set({ ...draft, ...patch });
  }

  saveEdit(): void {
    const sequence = this.sequence();
    const draft = this.editDraft();
    if (!sequence || !draft || this.busy()) return;
    if (!draft.title.trim()) {
      this.actionError.set('Le titre est obligatoire.');
      return;
    }
    this.busy.set(true);
    this.api
      .updateSequence(sequence.id, {
        title: draft.title.trim(),
        notes: draft.notes.trim() || null,
        track: draft.track,
        visibility: draft.visibility,
        volunteerTeamId: draft.volunteerTeamId,
        minDurationMinutes: draft.minDurationMinutes,
        minMarginMinutes: draft.minMarginMinutes,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.editing.set(false);
          this.editDraft.set(null);
          this.reloadSequence();
        },
        error: () => this.fail("L'enregistrement a échoué."),
      });
  }

  // ---- Onglet Missions & tâches ----

  addMission(): void {
    const sequence = this.sequence();
    const missionId = this.missionToAdd();
    if (!sequence || !missionId || this.busy()) return;
    this.patchSequence({ missionIds: [...sequence.missionIds, missionId] }, () =>
      this.missionToAdd.set(null),
    );
  }

  removeMission(missionId: number): void {
    const sequence = this.sequence();
    if (!sequence || this.busy()) return;
    this.patchSequence({ missionIds: sequence.missionIds.filter((id) => id !== missionId) });
  }

  startNewMission(): void {
    const sequence = this.sequence();
    this.newMission.set({
      title: '',
      volunteerTeamId: sequence?.volunteerTeamId ?? null,
      location: sequence?.location ?? '',
    });
    this.missionFormError.set(null);
  }

  cancelNewMission(): void {
    this.newMission.set(null);
  }

  updateNewMission(patch: Partial<NewMissionDraft>): void {
    const draft = this.newMission();
    if (draft) this.newMission.set({ ...draft, ...patch });
  }

  /** Crée une mission bénévole (brouillon) puis la lie à ce créneau. */
  createAndLinkMission(): void {
    const sequence = this.sequence();
    const draft = this.newMission();
    if (!sequence || !draft || this.busy()) return;
    const title = draft.title.trim();
    if (!title) {
      this.missionFormError.set('Le titre de la mission est obligatoire.');
      return;
    }
    this.busy.set(true);
    this.missionsApi
      .create({
        title,
        description: '',
        volunteerTeamId: draft.volunteerTeamId,
        location: draft.location.trim(),
        responsibleVolunteerId: null,
        status: VolunteerMissionStatus.DRAFT,
        isOptional: false,
      })
      .subscribe({
        next: (mission) => {
          this.missions.set([...this.missions(), mission]);
          this.newMission.set(null);
          this.patchSequence({ missionIds: [...(this.sequence()?.missionIds ?? []), mission.id] });
        },
        error: () => this.fail('La création de la mission a échoué.'),
      });
  }

  addTask(): void {
    const sequence = this.sequence();
    const draft = this.taskDraft();
    if (!sequence || this.busy()) return;
    const title = draft.title.trim();
    if (!title) {
      this.taskFormError.set('Le titre de la tâche est obligatoire.');
      return;
    }
    if (draft.dueKind === 'date' && !draft.dueDate) {
      this.taskFormError.set('Choisissez une date ou une échéance relative.');
      return;
    }
    this.taskFormError.set(null);
    this.busy.set(true);
    this.api
      .createTask(sequence.id, {
        title,
        dueOffsetMinutes: draft.dueKind === 'offset' ? draft.dueOffsetMinutes : null,
        dueDate: draft.dueKind === 'date' ? draft.dueDate : null,
        responsible: draft.responsible.trim() || null,
      })
      .subscribe({
        next: (task) => {
          this.busy.set(false);
          this.tasks.set([...this.tasks(), task]);
          this.taskDraft.set({
            title: '',
            dueKind: 'offset',
            dueOffsetMinutes: 180,
            dueDate: '',
            responsible: '',
          });
        },
        error: () => this.fail("L'ajout de la tâche a échoué."),
      });
  }

  toggleTask(task: EventPreparationTask): void {
    const sequence = this.sequence();
    if (!sequence || this.busy()) return;
    this.busy.set(true);
    this.api.updateTask(sequence.id, task.id, { isDone: !task.isDone }).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.tasks.set(this.tasks().map((t) => (t.id === task.id ? updated : t)));
      },
      error: () => this.fail('La mise à jour de la tâche a échoué.'),
    });
  }

  removeTask(task: EventPreparationTask): void {
    const sequence = this.sequence();
    if (!sequence || this.busy()) return;
    this.busy.set(true);
    this.api.deleteTask(sequence.id, task.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.tasks.set(this.tasks().filter((t) => t.id !== task.id));
      },
      error: () => this.fail('La suppression de la tâche a échoué.'),
    });
  }

  taskDueLabel(task: EventPreparationTask): string {
    if (task.dueDate) {
      const [year, month, day] = task.dueDate.split('-').map(Number);
      const label = new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'long',
      }).format(new Date(year, month - 1, day));
      return `Le ${label}`;
    }
    const minutes = task.dueOffsetMinutes ?? 0;
    if (minutes % 1440 === 0) {
      const days = minutes / 1440;
      return `${days} jour${days > 1 ? 's' : ''} avant le début`;
    }
    if (minutes % 60 === 0) return `${minutes / 60} h avant le début`;
    return `${minutes} min avant le début`;
  }

  // ---- Onglet Groupes concernés ----

  addGroup(): void {
    const sequence = this.sequence();
    const groupId = this.groupToAdd();
    if (!sequence || !groupId || this.busy()) return;
    this.setGroups([...sequence.groupIds, groupId], () => this.groupToAdd.set(null));
  }

  unlinkGroup(groupId: number): void {
    const sequence = this.sequence();
    if (!sequence || this.busy()) return;
    this.setGroups(sequence.groupIds.filter((id) => id !== groupId));
  }

  startNewGroup(): void {
    this.newGroup.set({ name: '', diocese: '' });
  }

  cancelNewGroup(): void {
    this.newGroup.set(null);
  }

  updateNewGroup(patch: Partial<{ name: string; diocese: string }>): void {
    const draft = this.newGroup();
    if (draft) this.newGroup.set({ ...draft, ...patch });
  }

  /** Crée un groupe de rassemblement puis le lie à ce créneau. */
  createAndLinkGroup(): void {
    const sequence = this.sequence();
    const draft = this.newGroup();
    if (!sequence || !draft || this.busy()) return;
    const name = draft.name.trim();
    if (!name) {
      this.actionError.set('Le nom du groupe est obligatoire.');
      return;
    }
    this.busy.set(true);
    this.groupsApi
      .create({
        name,
        diocese: draft.diocese.trim(),
        arrivalDatetime: '',
        departureDatetime: '',
        notes: '',
      })
      .subscribe({
        next: (group) => {
          this.groups.set([...this.groups(), group]);
          this.newGroup.set(null);
          this.setGroups([...this.sequence()!.groupIds, group.id]);
        },
        error: () => this.fail('La création du groupe a échoué.'),
      });
  }

  // ---- Onglet Documents ----

  addDocument(): void {
    const sequence = this.sequence();
    const draft = this.newDoc();
    if (!sequence || this.busy()) return;
    const label = draft.label.trim();
    const url = draft.url.trim();
    if (!label || !url) {
      this.docFormError.set('Le libellé et le lien sont obligatoires.');
      return;
    }
    this.docFormError.set(null);
    this.patchSequence({ documentLinks: [...sequence.documentLinks, { label, url }] }, () =>
      this.newDoc.set({ label: '', url: '' }),
    );
  }

  removeDocument(doc: ProgramDocumentLink): void {
    const sequence = this.sequence();
    if (!sequence || this.busy()) return;
    this.patchSequence({
      documentLinks: sequence.documentLinks.filter((d) => d !== doc),
    });
  }

  // ---- Onglet Historique ----

  actionLabel(action: ProgramChangeLogAction): string {
    return ACTION_LABELS[action];
  }

  logDateLabel(entry: ProgramChangeLogEntry): string {
    return this.dateTimeLabel(entry.createdAt);
  }

  dateTimeLabel(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  // ---- Internes ----

  private setGroups(groupIds: number[], after?: () => void): void {
    const sequence = this.sequence();
    if (!sequence) return;
    this.busy.set(true);
    this.api.setSequenceGroups(sequence.id, groupIds).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.sequence.set(updated);
        after?.();
      },
      error: () => this.fail('La mise à jour des groupes a échoué.'),
    });
  }

  private patchSequence(
    payload: Parameters<ProgramApiService['updateSequence']>[1],
    after?: () => void,
  ): void {
    const sequence = this.sequence();
    if (!sequence) return;
    this.busy.set(true);
    this.api.updateSequence(sequence.id, payload).subscribe({
      next: () => {
        this.busy.set(false);
        after?.();
        this.reloadSequence();
      },
      error: () => this.fail("L'enregistrement a échoué."),
    });
  }

  private reloadSequence(): void {
    const id = this.sequenceId();
    if (!id) return;
    this.api.getSequence(id).subscribe({
      next: (sequence) => this.sequence.set(sequence),
      error: () => undefined,
    });
  }

  private fail(message: string): void {
    this.busy.set(false);
    this.actionError.set(message);
  }

  dismissError(): void {
    this.actionError.set(null);
  }
}
