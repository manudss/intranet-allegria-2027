import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import {
  ProgramChangeLogAction,
  ProgramChangeLogEntry,
  ProgramPreview,
  ProgramSequence,
  ProgramSequenceDraft,
  ProgramSequenceStatus,
} from '../../models/models';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { PlanningMockDataService, PROGRAM_EVENT_DAYS } from './planning-mock-data.service';
import { ScheduleEngineService } from './schedule-engine.service';
import { minutesToTime, timeToMinutes } from './schedule-time.util';

/** Nombre de catégories de couleur disponibles pour les blocs du calendrier. */
const CATEGORY_COUNT = 6;

/** Nombre de pixels représentant une minute sur l'axe du calendrier. */
const PX_PER_MINUTE = 2;

/** Hauteur minimale (px) d'un bloc, pour qu'un créneau très court reste cliquable/lisible. */
const MIN_BLOCK_HEIGHT_PX = 28;

/** Pas de calage (minutes) appliqué lors du glisser-déposer d'un créneau. */
const DRAG_SNAP_MINUTES = 5;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

interface DragState {
  sequenceId: string;
  previousId: string;
  baseDuration: number;
  startClientY: number;
  deltaMinutes: number;
}

type ActionMessage = { appearance: 'positive' | 'negative' | 'warning'; text: string };

const EMPTY_DRAFT = (eventDate: string, location: string): ProgramSequenceDraft => ({
  eventDate,
  location,
  title: '',
  durationMinutes: 30,
  volunteerTeamId: null,
  notes: null,
});

const CHANGE_LOG_LABELS: Record<ProgramChangeLogAction, string> = {
  INSERT: 'Insertion',
  RESIZE: 'Redimensionnement',
  MOVE: 'Déplacement',
  FREEZE: 'Figement',
  UNFREEZE: 'Défigement',
  DELETE: 'Suppression',
};

@Component({
  selector: 'app-programme',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './programme.html',
  styleUrl: './programme.scss',
})
export class ProgrammePage {
  private readonly mockData = inject(PlanningMockDataService);
  private readonly engine = inject(ScheduleEngineService);
  private readonly auth = inject(AuthService);

  readonly ProgramSequenceStatus = ProgramSequenceStatus;
  readonly changeLogLabels = CHANGE_LOG_LABELS;
  readonly days = PROGRAM_EVENT_DAYS;

  readonly dayIndex = signal(1); // J2 par défaut (chaîne d'exemple du squelette métier)
  readonly eventDate = computed(() => this.days[this.dayIndex()]);

  readonly allSequences = this.mockData.sequences;
  readonly changeLog = this.mockData.changeLog;

  readonly locationsForDay = computed(() => {
    const date = this.eventDate();
    const locations = new Set(
      this.allSequences()
        .filter((sequence) => sequence.eventDate === date && !sequence.anchorSequenceId)
        .map((sequence) => sequence.location),
    );
    return Array.from(locations);
  });

  readonly location = signal('Grand Chapiteau');

  readonly chain = computed<ProgramSequence[]>(() =>
    this.engine.buildChain(this.allSequences(), this.eventDate(), this.location()),
  );

  /** Minute du jour (depuis minuit) à laquelle démarre la 1re séquence. */
  private readonly dayWindowStart = computed(() => {
    const chain = this.chain();
    return chain.length ? Math.min(...chain.map((s) => timeToMinutes(s.startTime))) : 0;
  });

  /** Origine de la grille calendrier : heure pleine arrondie en dessous de la 1re séquence. */
  readonly gridStartMinutes = computed(() => Math.floor(this.dayWindowStart() / 60) * 60);

  /** Fin de la grille calendrier : heure pleine arrondie au-dessus de la dernière séquence. */
  readonly gridEndMinutes = computed(() => {
    const chain = this.chain();
    const rawEnd = chain.length
      ? Math.max(...chain.map((s) => timeToMinutes(s.endTime)))
      : this.gridStartMinutes() + 60;
    return Math.ceil(rawEnd / 60) * 60;
  });

  readonly pxPerMinute = PX_PER_MINUTE;

  /** Hauteur totale (px) de la grille calendrier, échelle minute -> pixel fixe. */
  readonly calendarHeightPx = computed(() =>
    Math.max(420, (this.gridEndMinutes() - this.gridStartMinutes()) * this.pxPerMinute),
  );

  /** Repères horaires affichés sur l'axe de gauche (toutes les heures). */
  readonly hourMarks = computed(() => {
    const start = this.gridStartMinutes();
    const end = this.gridEndMinutes();
    const marks: { label: string; topPx: number }[] = [];
    for (let minute = start; minute <= end; minute += 60) {
      marks.push({ label: minutesToTime(minute), topPx: (minute - start) * this.pxPerMinute });
    }
    return marks;
  });

  readonly dragState = signal<DragState | null>(null);

  branchesFor(sequenceId: string): ProgramSequence[] {
    return this.allSequences().filter((s) => s.anchorSequenceId === sequenceId);
  }

  readonly kpis = computed(() => {
    const chain = this.chain();
    const frozenCount = chain.filter((s) => s.status === ProgramSequenceStatus.FROZEN).length;
    const branchesCount = chain.reduce((sum, s) => sum + this.branchesFor(s.id).length, 0);
    return {
      total: chain.length,
      mobile: chain.length - frozenCount,
      frozen: frozenCount,
      branches: branchesCount,
    };
  });

  readonly canEdit = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));

  readonly preview = signal<ProgramPreview | null>(null);
  readonly actionMessage = signal<ActionMessage | null>(null);
  readonly changeLogOpen = signal(false);

  readonly insertAfterId = signal<string | null>(null);
  readonly insertDraft = signal<ProgramSequenceDraft>(EMPTY_DRAFT(this.eventDate(), this.location()));

  readonly resizeSequenceId = signal<string | null>(null);
  readonly resizeDuration = signal<number | null>(null);

  setDay(index: number): void {
    this.dayIndex.set(index);
    this.closeForms();
  }

  setLocation(location: string): void {
    this.location.set(location);
    this.closeForms();
  }

  /** Position verticale (px) du bloc d'une séquence sur la grille calendrier. */
  blockTop(sequence: ProgramSequence): number {
    return (timeToMinutes(sequence.startTime) - this.gridStartMinutes()) * this.pxPerMinute;
  }

  /** Hauteur (px) du bloc d'une séquence, avec un plancher pour rester lisible/cliquable. */
  blockHeight(sequence: ProgramSequence): number {
    return Math.max(sequence.durationMinutes * this.pxPerMinute, MIN_BLOCK_HEIGHT_PX);
  }

  /**
   * Catégorie de couleur d'un bloc. Heuristique (hash du titre) en attendant un véritable
   * champ "type" de séquence côté modèle (à introduire en phase 1/2 si le besoin se confirme).
   */
  categoryIndex(sequence: ProgramSequence): number {
    return hashString(sequence.title) % CATEGORY_COUNT;
  }

  private previousOf(sequence: ProgramSequence): ProgramSequence | null {
    const chain = this.chain();
    const index = chain.findIndex((s) => s.id === sequence.id);
    return index > 0 ? chain[index - 1] : null;
  }

  /**
   * Démarre un glisser-déposer vertical sur un créneau mobile : déplacer un créneau revient à
   * redimensionner son prédécesseur direct dans la chaîne (le modèle est chaîné, startTime =
   * endTime du précédent), ce qui réutilise telles quelles les règles de previewResize (figement
   * bloquant, cascade sur la suite flexible).
   */
  startDrag(event: PointerEvent, sequence: ProgramSequence): void {
    if (!this.canEdit() || sequence.status === ProgramSequenceStatus.FROZEN) return;
    const previous = this.previousOf(sequence);
    if (!previous) return; // tête de chaîne : pas de prédécesseur à redimensionner

    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.dragState.set({
      sequenceId: sequence.id,
      previousId: previous.id,
      baseDuration: previous.durationMinutes,
      startClientY: event.clientY,
      deltaMinutes: 0,
    });
    event.preventDefault();
  }

  onDragMove(event: PointerEvent): void {
    const state = this.dragState();
    if (!state) return;
    const deltaPx = event.clientY - state.startClientY;
    const rawMinutes = deltaPx / this.pxPerMinute;
    const snapped = Math.round(rawMinutes / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
    this.dragState.set({ ...state, deltaMinutes: snapped });
  }

  /** Décalage visuel (transform) appliqué pendant le drag, nul pour les autres blocs. */
  dragTransform(sequence: ProgramSequence): string | null {
    const state = this.dragState();
    if (!state || state.sequenceId !== sequence.id || state.deltaMinutes === 0) return null;
    return `translateY(${state.deltaMinutes * this.pxPerMinute}px)`;
  }

  /**
   * Fin du glisser-déposer : convertit le delta en aperçu de redimensionnement du prédécesseur
   * (jamais d'application directe — l'utilisateur doit confirmer dans le panneau de prévisualisation).
   */
  endDrag(): void {
    const state = this.dragState();
    this.dragState.set(null);
    if (!state || state.deltaMinutes === 0) return;

    const newDuration = state.baseDuration + state.deltaMinutes;
    if (newDuration < DRAG_SNAP_MINUTES) return;

    this.insertAfterId.set(null);
    this.resizeSequenceId.set(state.previousId);
    this.resizeDuration.set(newDuration);
    this.previewResizeAction();
  }

  openInsertForm(afterSequenceId: string): void {
    this.resizeSequenceId.set(null);
    this.insertAfterId.set(afterSequenceId);
    this.insertDraft.set(EMPTY_DRAFT(this.eventDate(), this.location()));
    this.preview.set(null);
  }

  updateInsertDraft(patch: Partial<ProgramSequenceDraft>): void {
    this.insertDraft.update((draft) => ({ ...draft, ...patch }));
  }

  previewInsertAction(): void {
    const afterId = this.insertAfterId();
    if (!afterId) return;
    const result = this.engine.previewInsert(this.chain(), afterId, this.insertDraft());
    this.preview.set(result);
  }

  openResizeForm(sequence: ProgramSequence): void {
    this.insertAfterId.set(null);
    this.resizeSequenceId.set(sequence.id);
    this.resizeDuration.set(sequence.durationMinutes);
    this.preview.set(null);
  }

  previewResizeAction(): void {
    const sequenceId = this.resizeSequenceId();
    const duration = this.resizeDuration();
    if (!sequenceId || duration == null) return;
    const result = this.engine.previewResize(this.chain(), sequenceId, duration);
    this.preview.set(result);
  }

  confirmPreview(): void {
    const current = this.preview();
    if (!current || current.outcome === 'impossible') return;

    const updatedChain =
      current.kind === 'insert'
        ? this.engine.applyInsert(this.chain(), current)
        : this.engine.applyResize(this.chain(), current);

    this.commitChain(updatedChain);

    const affectedIds =
      current.kind === 'insert'
        ? [current.newSequence.id, ...current.affected.map((d) => d.sequenceId)]
        : [current.sequenceId, ...current.affected.map((d) => d.sequenceId)];

    this.appendChangeLog(current.kind === 'insert' ? 'INSERT' : 'RESIZE', affectedIds, current.message);
    this.actionMessage.set({ appearance: 'positive', text: 'Modification appliquée et journalisée.' });
    this.closeForms();
  }

  cancelPreview(): void {
    this.closeForms();
  }

  toggleFreeze(sequence: ProgramSequence): void {
    if (!this.canEdit()) return;
    const user = this.auth.currentUser();
    const updated =
      sequence.status === ProgramSequenceStatus.FROZEN
        ? this.engine.unfreeze(sequence)
        : this.engine.freeze(sequence, user?.id ?? 0, user?.email ?? 'Coordination');

    this.mockData.setSequences(
      this.allSequences().map((s) => (s.id === sequence.id ? updated : s)),
    );

    this.appendChangeLog(
      updated.status === ProgramSequenceStatus.FROZEN ? 'FREEZE' : 'UNFREEZE',
      [sequence.id],
      updated.status === ProgramSequenceStatus.FROZEN ? `« ${sequence.title} » figé.` : `« ${sequence.title} » défigé.`,
    );
  }

  toggleChangeLog(): void {
    this.changeLogOpen.update((value) => !value);
  }

  private closeForms(): void {
    this.insertAfterId.set(null);
    this.resizeSequenceId.set(null);
    this.preview.set(null);
  }

  private commitChain(updatedChain: ProgramSequence[]): void {
    const byId = new Map(updatedChain.map((s) => [s.id, s]));
    const existingIds = new Set(this.allSequences().map((s) => s.id));
    const merged = this.allSequences().map((s) => byId.get(s.id) ?? s);
    const newOnes = updatedChain.filter((s) => !existingIds.has(s.id));
    this.mockData.setSequences([...merged, ...newOnes]);
  }

  private appendChangeLog(action: ProgramChangeLogAction, affectedSequenceIds: string[], comment: string): void {
    const user = this.auth.currentUser();
    const entry: ProgramChangeLogEntry = {
      id: `log-${Date.now()}`,
      action,
      authorUserId: user?.id ?? null,
      authorName: user?.email ?? 'Coordination',
      createdAt: new Date().toISOString(),
      affectedSequenceIds,
      comment,
    };
    this.mockData.appendChangeLogEntry(entry);
  }
}
