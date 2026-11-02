import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { TuiDataListWrapper } from '@taiga-ui/kit';
import { AuthService } from '../../core/auth.service';
import {
  ProgramChangeLogAction,
  ProgramChangeLogEntry,
  ProgramDocumentLink,
  ProgramPreview,
  ProgramSequence,
  ProgramSequenceDiff,
  ProgramSequenceDraft,
  ProgramSequenceStatus,
  VolunteerMission,
  VolunteerTeam,
} from '../../models/models';
import { ProgramApiService, VolunteerMissionsApiService, VolunteerTeamsApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { buildChain, PROGRAM_EVENT_DAYS } from './schedule-chain.util';
import { minutesToTime, timeToMinutes } from './schedule-time.util';

const MAIN_LOCATION = 'Grande salle';

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
  sequenceId: number;
  previousId: number;
  baseDuration: number;
  startClientY: number;
  deltaMinutes: number;
}

interface ResizeDragState {
  sequenceId: number;
  baseDuration: number;
  startClientY: number;
  deltaMinutes: number;
}

type ActionMessage = { appearance: 'positive' | 'negative' | 'warning'; text: string };

const EMPTY_DRAFT = (): ProgramSequenceDraft => ({
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
  UPDATE: 'Modification',
};

interface EditDraft {
  title: string;
  notes: string;
  volunteerTeamId: number | null;
  missionIds: number[];
  documentLinks: ProgramDocumentLink[];
}

interface CreateDraft {
  location: string;
  title: string;
  startTime: string;
  durationMinutes: number;
}

interface BlockView {
  key: string;
  /** null pour un créneau en cours de création (aperçu d'insertion). */
  sequence: ProgramSequence | null;
  title: string;
  startTime: string;
  endTime: string;
  topPx: number;
  heightPx: number;
  change: 'none' | 'changed' | 'blocked' | 'new';
  ghost: { topPx: number; heightPx: number; label: string } | null;
  justChanged: boolean;
  frozen: boolean;
  category: number;
}

interface CalendarColumn {
  name: string;
  selected: boolean;
  blocks: BlockView[];
}

/** Vue d'ensemble en lecture seule : un jour = des lieux = des séquences ordonnées par heure. */
interface OverviewDay {
  date: string;
  dayIndex: number;
  locations: { name: string; isBranch: boolean; sequences: ProgramSequence[] }[];
}

@Component({
  selector: 'app-programme',
  standalone: true,
  imports: [...SHARED_IMPORTS, TuiDataListWrapper],
  templateUrl: './programme.html',
  styleUrl: './programme.scss',
})
export class ProgrammePage {
  private readonly api = inject(ProgramApiService);
  private readonly teamsApi = inject(VolunteerTeamsApiService);
  private readonly missionsApi = inject(VolunteerMissionsApiService);
  private readonly auth = inject(AuthService);

  readonly ProgramSequenceStatus = ProgramSequenceStatus;
  readonly changeLogLabels = CHANGE_LOG_LABELS;
  readonly days = PROGRAM_EVENT_DAYS;

  readonly dayIndex = signal(0); // J1 par défaut
  readonly eventDate = computed(() => this.days[this.dayIndex()]);

  readonly allSequences = signal<ProgramSequence[]>([]);
  readonly changeLog = signal<ProgramChangeLogEntry[]>([]);
  readonly loading = signal(false);

  /** Tous les lieux du jour, branches parallèles comprises (chacun a sa propre chaîne éditable). */
  readonly locationsForDay = computed(() => {
    const date = this.eventDate();
    const locations = new Set(
      this.allSequences()
        .filter((sequence) => sequence.eventDate === date)
        .map((sequence) => sequence.location),
    );
    // Le lieu principal d'abord, puis les lieux parallèles par ordre alphabétique.
    return Array.from(locations).sort((a, b) =>
      a === MAIN_LOCATION ? -1 : b === MAIN_LOCATION ? 1 : a.localeCompare(b, 'fr'),
    );
  });

  readonly location = signal(MAIN_LOCATION);

  readonly chain = computed<ProgramSequence[]>(() =>
    buildChain(this.allSequences(), this.eventDate(), this.location()),
  );

  /** Séquences du jour affiché, tous lieux confondus. */
  private readonly daySequences = computed(() =>
    this.allSequences().filter((sequence) => sequence.eventDate === this.eventDate()),
  );

  /**
   * Horaires « après » annoncés par l'aperçu en cours (clé = id de séquence). Tant que l'aperçu
   * n'est ni confirmé ni annulé, le calendrier les affiche à la place des horaires actuels.
   */
  private readonly projectedTimes = computed(() => {
    const current = this.preview();
    const map = new Map<number, ProgramSequenceDiff['after']>();
    if (!current) return map;
    for (const diff of current.affected) map.set(diff.sequenceId, diff.after);
    return map;
  });

  /** Plage horaire de la grille : couvre tous les lieux, les horaires projetés et un éventuel nouveau créneau. */
  private readonly timeRange = computed(() => {
    const projected = this.projectedTimes();
    const starts: number[] = [];
    const ends: number[] = [];
    for (const sequence of this.daySequences()) {
      const after = projected.get(sequence.id);
      starts.push(timeToMinutes(sequence.startTime));
      ends.push(timeToMinutes(sequence.endTime));
      if (after) {
        starts.push(timeToMinutes(after.startTime));
        ends.push(timeToMinutes(after.endTime));
      }
    }
    const current = this.preview();
    if (current?.kind === 'insert') {
      starts.push(timeToMinutes(current.newSequence.startTime));
      ends.push(timeToMinutes(current.newSequence.endTime));
    }
    if (!starts.length) return { start: 8 * 60, end: 20 * 60 };
    return {
      start: Math.floor(Math.min(...starts) / 60) * 60,
      end: Math.max(Math.ceil(Math.max(...ends) / 60) * 60, Math.floor(Math.min(...starts) / 60) * 60 + 60),
    };
  });

  /** Origine de la grille calendrier : heure pleine arrondie en dessous du 1er créneau du jour. */
  readonly gridStartMinutes = computed(() => this.timeRange().start);

  /** Fin de la grille calendrier : heure pleine arrondie au-dessus du dernier créneau du jour. */
  readonly gridEndMinutes = computed(() => this.timeRange().end);

  readonly pxPerMinute = PX_PER_MINUTE;

  /** Hauteur totale (px) de la grille calendrier, échelle minute -> pixel fixe. */
  readonly calendarHeightPx = computed(
    () => (this.gridEndMinutes() - this.gridStartMinutes()) * this.pxPerMinute,
  );

  /** Repères horaires affichés sur l'axe de gauche (toutes les heures). */
  readonly hourMarks = computed(() => {
    const start = this.gridStartMinutes();
    const end = this.gridEndMinutes();
    const marks: { label: string; topPx: number; half: boolean }[] = [];
    for (let minute = start; minute <= end; minute += 30) {
      marks.push({
        label: minutesToTime(minute),
        topPx: (minute - start) * this.pxPerMinute,
        half: minute % 60 !== 0,
      });
    }
    return marks;
  });

  /** Créneaux touchés par la dernière modification confirmée : mis en évidence quelques secondes. */
  readonly recentlyChanged = signal<ReadonlySet<number>>(new Set());
  private recentTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Colonnes du calendrier (un lieu = une colonne, comme les agendas partagés). Chaque bloc est
   * positionné à son horaire projeté si un aperçu est en cours, avec l'ancien emplacement en
   * fantôme : l'écran montre ce qui va changer au lieu de rester à l'état initial.
   */
  readonly columns = computed<CalendarColumn[]>(() => {
    const start = this.gridStartMinutes();
    const px = this.pxPerMinute;
    const projected = this.projectedTimes();
    const current = this.preview();
    const blocked = current?.outcome === 'impossible';
    const recent = this.recentlyChanged();
    const date = this.eventDate();
    const sequences = this.allSequences();

    return this.locationsForDay().map((name) => {
      const blocks: BlockView[] = buildChain(sequences, date, name).map((sequence) => {
        const after = projected.get(sequence.id);
        const startTime = after?.startTime ?? sequence.startTime;
        const endTime = after?.endTime ?? sequence.endTime;
        const duration = after?.durationMinutes ?? sequence.durationMinutes;
        const changed =
          !!after &&
          (after.startTime !== sequence.startTime || after.durationMinutes !== sequence.durationMinutes);
        const topPx = (timeToMinutes(startTime) - start) * px;
        return {
          key: `s${sequence.id}`,
          sequence,
          title: sequence.title,
          startTime,
          endTime,
          topPx,
          heightPx: Math.max(duration * px, MIN_BLOCK_HEIGHT_PX),
          change: changed ? (blocked ? 'blocked' : 'changed') : 'none',
          ghost: changed
            ? {
                topPx: (timeToMinutes(sequence.startTime) - start) * px,
                heightPx: Math.max(sequence.durationMinutes * px, MIN_BLOCK_HEIGHT_PX),
                label: `${sequence.startTime} – ${minutesToTime(timeToMinutes(sequence.startTime) + sequence.durationMinutes)}`,
              }
            : null,
          justChanged: recent.has(sequence.id),
          frozen: sequence.status === ProgramSequenceStatus.FROZEN,
          category: this.categoryIndex(sequence),
        } satisfies BlockView;
      });

      if (current?.kind === 'insert' && current.newSequence.location === name) {
        const created = current.newSequence;
        blocks.push({
          key: 'new',
          sequence: null,
          title: created.title,
          startTime: created.startTime,
          endTime: created.endTime,
          topPx: (timeToMinutes(created.startTime) - start) * px,
          heightPx: Math.max(created.durationMinutes * px, MIN_BLOCK_HEIGHT_PX),
          change: 'new',
          ghost: null,
          justChanged: false,
          frozen: false,
          category: 0,
        });
      }
      return { name, selected: name === this.location(), blocks };
    });
  });

  /** Nombre de créneaux que l'aperçu en cours déplace, redimensionne ou crée. */
  readonly pendingChangeCount = computed(() => {
    const current = this.preview();
    if (!current) return 0;
    const moved = current.affected.filter(
      (diff) =>
        diff.before.startTime !== diff.after.startTime ||
        diff.before.durationMinutes !== diff.after.durationMinutes,
    ).length;
    return moved + (current.kind === 'insert' ? 1 : 0);
  });

  /** Un formulaire ou un aperçu est ouvert : sur mobile, le panneau passe au-dessus du calendrier. */
  readonly panelActive = computed(
    () =>
      this.createOpen() ||
      this.deleteTargetId() !== null ||
      this.editSequenceId() !== null ||
      this.insertAfterId() !== null ||
      this.resizeSequenceId() !== null ||
      this.preview() !== null ||
      this.changeLogOpen(),
  );

  readonly dragState = signal<DragState | null>(null);
  readonly resizeDragState = signal<ResizeDragState | null>(null);

  branchesFor(sequenceId: number): ProgramSequence[] {
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

  readonly insertAfterId = signal<number | null>(null);
  readonly insertDraft = signal<ProgramSequenceDraft>(EMPTY_DRAFT());

  readonly resizeSequenceId = signal<number | null>(null);
  readonly resizeDuration = signal<number | null>(null);

  readonly viewMode = signal<'day' | 'overview'>('day');
  readonly overview = signal<OverviewDay[]>([]);
  readonly overviewLoading = signal(false);

  readonly teams = signal<VolunteerTeam[]>([]);
  readonly teamItems = computed(() => [null, ...this.teams().map((team) => team.id)]);

  stringifyTeam = (id: number | null): string =>
    id === null ? 'Aucune' : (this.teams().find((team) => team.id === id)?.name ?? `Équipe ${id}`);
  private teamsLoaded = false;

  readonly missions = signal<VolunteerMission[]>([]);
  readonly missionFilter = signal('');
  private missionsLoaded = false;

  /** Missions proposées dans le formulaire : filtrées par texte, les missions déjà liées restent visibles. */
  readonly filteredMissions = computed(() => {
    const term = this.missionFilter().trim().toLocaleLowerCase('fr');
    const selected = new Set(this.editDraft().missionIds);
    return this.missions().filter(
      (mission) =>
        selected.has(mission.id) ||
        !term ||
        `${mission.title} ${mission.location ?? ''}`.toLocaleLowerCase('fr').includes(term),
    );
  });

  readonly editSequenceId = signal<number | null>(null);
  readonly editDraft = signal<EditDraft>({
    title: '',
    notes: '',
    volunteerTeamId: null,
    missionIds: [],
    documentLinks: [],
  });

  readonly createOpen = signal(false);
  readonly deleteTargetId = signal<number | null>(null);
  readonly closeGap = signal(false);
  readonly createDraft = signal<CreateDraft>({
    location: '',
    title: '',
    startTime: '09:00',
    durationMinutes: 30,
  });

  constructor() {
    this.loadDay();
  }

  setDay(index: number): void {
    this.dayIndex.set(index);
    this.closeForms();
    this.loadDay();
  }

  setLocation(location: string): void {
    this.location.set(location);
    this.closeForms();
  }

  /** Hauteur (px) d'un bloc pendant un redimensionnement à la souris (retour visuel immédiat). */
  liveHeight(block: BlockView): number {
    const resize = this.resizeDragState();
    const delta = block.sequence && resize?.sequenceId === block.sequence.id ? resize.deltaMinutes : 0;
    return Math.max(block.heightPx + delta * this.pxPerMinute, MIN_BLOCK_HEIGHT_PX);
  }

  /** Sélectionne la colonne (le lieu) touchée par l'utilisateur. */
  selectLocation(name: string): void {
    if (name !== this.location()) this.location.set(name);
  }

  /**
   * Catégorie de couleur d'un bloc. Heuristique (hash du titre) en attendant un véritable
   * champ "type" de séquence côté modèle (à introduire en phase 1/2 si le besoin se confirme).
   */
  categoryIndex(sequence: ProgramSequence): number {
    return hashString(sequence.title) % CATEGORY_COUNT;
  }

  private previousOf(sequence: ProgramSequence): ProgramSequence | null {
    const chain = buildChain(this.allSequences(), sequence.eventDate, sequence.location);
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
    // Au doigt, seule la poignée déplace le créneau : le reste du bloc laisse défiler la page.
    const viaGrip = !!(event.target as HTMLElement).closest('.drag-grip');
    if (event.pointerType !== 'mouse' && !viaGrip) return;
    if (!this.canEdit() || sequence.status === ProgramSequenceStatus.FROZEN) return;
    this.selectLocation(sequence.location);
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
    const resize = this.resizeDragState();
    if (resize) {
      this.resizeDragState.set({ ...resize, deltaMinutes: this.snappedDelta(event, resize.startClientY) });
      return;
    }
    const state = this.dragState();
    if (!state) return;
    this.dragState.set({ ...state, deltaMinutes: this.snappedDelta(event, state.startClientY) });
  }

  private snappedDelta(event: PointerEvent, startClientY: number): number {
    const rawMinutes = (event.clientY - startClientY) / this.pxPerMinute;
    return Math.round(rawMinutes / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
  }

  /**
   * Redimensionnement à la souris par la poignée basse d'un bloc : la durée change, la fin glisse
   * et la suite de la chaîne est recalculée côté serveur. Comme pour le drag, seul un aperçu
   * (avant/après) est demandé : rien n'est appliqué sans confirmation.
   */
  startResize(event: PointerEvent, sequence: ProgramSequence): void {
    event.stopPropagation(); // ne pas déclencher le drag du bloc
    if (!this.canEdit() || sequence.status === ProgramSequenceStatus.FROZEN) return;
    this.selectLocation(sequence.location);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.resizeDragState.set({
      sequenceId: sequence.id,
      baseDuration: sequence.durationMinutes,
      startClientY: event.clientY,
      deltaMinutes: 0,
    });
    event.preventDefault();
  }

  endResize(): void {
    const state = this.resizeDragState();
    this.resizeDragState.set(null);
    if (!state || state.deltaMinutes === 0) return;
    const newDuration = state.baseDuration + state.deltaMinutes;
    if (newDuration < DRAG_SNAP_MINUTES) return;

    this.insertAfterId.set(null);
    this.resizeSequenceId.set(state.sequenceId);
    this.resizeDuration.set(newDuration);
    this.previewResizeAction();
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

  openInsertForm(afterSequenceId: number): void {
    this.editSequenceId.set(null);
    this.createOpen.set(false);
    this.resizeSequenceId.set(null);
    this.insertAfterId.set(afterSequenceId);
    this.insertDraft.set(EMPTY_DRAFT());
    this.preview.set(null);
    this.revealPanel();
  }

  updateInsertDraft(patch: Partial<ProgramSequenceDraft>): void {
    this.insertDraft.update((draft) => ({ ...draft, ...patch }));
  }

  previewInsertAction(): void {
    const afterId = this.insertAfterId();
    if (!afterId) return;
    this.api.previewInsert(afterId, this.insertDraft()).subscribe({
      next: (result) => this.showPreview(result),
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  openResizeForm(sequence: ProgramSequence): void {
    this.editSequenceId.set(null);
    this.createOpen.set(false);
    this.insertAfterId.set(null);
    this.resizeSequenceId.set(sequence.id);
    this.resizeDuration.set(sequence.durationMinutes);
    this.preview.set(null);
    this.revealPanel();
  }

  previewResizeAction(): void {
    const sequenceId = this.resizeSequenceId();
    const duration = this.resizeDuration();
    if (!sequenceId || duration == null) return;
    this.api.previewResize(sequenceId, duration).subscribe({
      next: (result) => this.showPreview(result),
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  confirmPreview(): void {
    const current = this.preview();
    if (!current || current.outcome === 'impossible') return;

    const request =
      current.kind === 'insert'
        ? this.api.applyInsert(current.afterSequenceId, current.draft, current.version)
        : this.api.applyResize(current.sequenceId, current.newDurationMinutes, current.version);

    const touched = current.affected
      .filter(
        (diff) =>
          diff.before.startTime !== diff.after.startTime ||
          diff.before.durationMinutes !== diff.after.durationMinutes,
      )
      .map((diff) => diff.sequenceId);
    if (current.kind === 'resize' && !touched.includes(current.sequenceId)) touched.push(current.sequenceId);
    const count = this.pendingChangeCount();

    request.subscribe({
      next: () => {
        this.actionMessage.set({
          appearance: 'positive',
          text: `Modification appliquée et journalisée : ${count} créneau${count > 1 ? 'x' : ''} concerné${count > 1 ? 's' : ''} (surligné${count > 1 ? 's' : ''} dans le planning).`,
        });
        this.closeForms();
        this.flashChanged(touched);
        this.loadDay();
      },
      error: (error: HttpErrorResponse) => {
        this.showError(error);
        // Chaîne modifiée entre-temps (409) : l'aperçu est périmé, on recharge l'état réel.
        if (error.status === 409) {
          this.closeForms();
          this.loadDay();
        }
      },
    });
  }

  cancelPreview(): void {
    this.closeForms();
  }

  /** Met en évidence quelques secondes les créneaux qui viennent d'être modifiés. */
  private flashChanged(ids: number[]): void {
    if (this.recentTimer) clearTimeout(this.recentTimer);
    this.recentlyChanged.set(new Set(ids));
    this.recentTimer = setTimeout(() => this.recentlyChanged.set(new Set()), 12000);
  }

  /** Réinitialise le jour affiché avec le programme de démonstration (admin, après confirmation). */
  readonly demoResetOpen = signal(false);
  readonly canResetDemo = computed(() => this.auth.hasAnyRole(['ADMIN']));

  confirmDemoReset(): void {
    this.api.resetDayToDemo(this.eventDate()).subscribe({
      next: (result) => {
        this.demoResetOpen.set(false);
        this.actionMessage.set({
          appearance: 'positive',
          text: `Programme de démonstration chargé : ${result.sequences} séquences.`,
        });
        this.location.set(MAIN_LOCATION);
        this.loadDay();
      },
      error: (error: HttpErrorResponse) => {
        this.demoResetOpen.set(false);
        this.showError(error);
      },
    });
  }

  toggleFreeze(sequence: ProgramSequence): void {
    if (!this.canEdit()) return;
    const request =
      sequence.status === ProgramSequenceStatus.FROZEN
        ? this.api.unfreeze(sequence.id)
        : this.api.freeze(sequence.id);

    request.subscribe({
      next: () => this.loadDay(),
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  toggleChangeLog(): void {
    this.viewMode.set('day');
    this.changeLogOpen.update((value) => !value);
    if (this.changeLogOpen()) this.loadChangeLog();
  }

  // ─── Création / édition / suppression ──────────────────────────────

  openCreateForm(): void {
    this.closeForms();
    const startTime = this.chain().length ? this.chain()[0].startTime : '09:00';
    this.createDraft.set({
      location: this.chain().length ? '' : this.location(),
      title: '',
      startTime,
      durationMinutes: 30,
    });
    this.createOpen.set(true);
    this.revealPanel();
  }

  updateCreateDraft(patch: Partial<CreateDraft>): void {
    this.createDraft.update((draft) => ({ ...draft, ...patch }));
  }

  submitCreate(): void {
    const draft = this.createDraft();
    this.api
      .createSequence({
        eventDate: this.eventDate(),
        location: draft.location.trim(),
        title: draft.title,
        startTime: draft.startTime,
        durationMinutes: draft.durationMinutes,
      })
      .subscribe({
        next: (created) => {
          this.actionMessage.set({ appearance: 'positive', text: 'Séquence créée.' });
          this.closeForms();
          this.location.set(created.location);
          this.loadDay();
        },
        error: (error: HttpErrorResponse) => this.showError(error),
      });
  }

  openEditForm(sequence: ProgramSequence): void {
    this.closeForms();
    this.loadTeamsOnce();
    this.loadMissionsOnce();
    this.missionFilter.set('');
    this.editDraft.set({
      title: sequence.title,
      notes: sequence.notes ?? '',
      volunteerTeamId: sequence.volunteerTeamId,
      missionIds: [...sequence.missionIds],
      documentLinks: sequence.documentLinks.map((link) => ({ ...link })),
    });
    this.editSequenceId.set(sequence.id);
    this.revealPanel();
  }

  toggleMission(missionId: number): void {
    const current = this.editDraft().missionIds;
    this.updateEditDraft({
      missionIds: current.includes(missionId)
        ? current.filter((id) => id !== missionId)
        : [...current, missionId],
    });
  }

  updateEditDraft(patch: Partial<EditDraft>): void {
    this.editDraft.update((draft) => ({ ...draft, ...patch }));
  }

  addDocumentLink(): void {
    this.updateEditDraft({
      documentLinks: [...this.editDraft().documentLinks, { label: '', url: '' }],
    });
  }

  updateDocumentLink(index: number, patch: Partial<ProgramDocumentLink>): void {
    this.updateEditDraft({
      documentLinks: this.editDraft().documentLinks.map((link, i) =>
        i === index ? { ...link, ...patch } : link,
      ),
    });
  }

  removeDocumentLink(index: number): void {
    this.updateEditDraft({
      documentLinks: this.editDraft().documentLinks.filter((_, i) => i !== index),
    });
  }

  submitEdit(): void {
    const id = this.editSequenceId();
    if (!id) return;
    const draft = this.editDraft();
    this.api
      .updateSequence(id, {
        title: draft.title,
        notes: draft.notes,
        volunteerTeamId: draft.volunteerTeamId,
        missionIds: draft.missionIds,
        documentLinks: draft.documentLinks,
      })
      .subscribe({
        next: () => {
          this.actionMessage.set({ appearance: 'positive', text: 'Séquence mise à jour.' });
          this.closeForms();
          this.loadDay();
        },
        error: (error: HttpErrorResponse) => this.showError(error),
      });
  }

  deleteSequence(sequence: ProgramSequence): void {
    if (!this.canEdit() || sequence.status === ProgramSequenceStatus.FROZEN) return;
    this.closeForms();
    this.closeGap.set(false);
    this.deleteTargetId.set(sequence.id);
  }

  /** Séquences qui seraient avancées si l'on comble le trou après la suppression. */
  readonly deleteHasFollowing = computed(() => {
    const id = this.deleteTargetId();
    return id !== null && this.chain().some((sequence) => sequence.previousSequenceId === id);
  });

  readonly deleteTarget = computed(
    () => this.chain().find((sequence) => sequence.id === this.deleteTargetId()) ?? null,
  );

  confirmDelete(): void {
    const id = this.deleteTargetId();
    if (!id) return;
    this.api.deleteSequence(id, this.closeGap()).subscribe({
      next: (result) => {
        this.actionMessage.set({
          appearance: 'positive',
          text: result.shiftedMinutes
            ? `Séquence supprimée ; séquences suivantes avancées de ${result.shiftedMinutes} min.`
            : 'Séquence supprimée.',
        });
        this.closeForms();
        this.loadDay();
      },
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  // ─── Vue d'ensemble 4 jours (lecture seule) ────────────────────────

  showOverview(): void {
    this.viewMode.set('overview');
    this.closeForms();
    this.overviewLoading.set(true);
    forkJoin(this.days.map((date) => this.api.getDay(date))).subscribe({
      next: (daysData) => {
        this.overview.set(
          daysData.map((day, dayIndex) => {
            const byLocation = new Map<string, ProgramSequence[]>();
            for (const sequence of day.sequences) {
              byLocation.set(sequence.location, [
                ...(byLocation.get(sequence.location) ?? []),
                sequence,
              ]);
            }
            return {
              date: day.date,
              dayIndex,
              locations: Array.from(byLocation.entries()).map(([name, sequences]) => ({
                name,
                isBranch: sequences.some((s) => s.anchorSequenceId !== null),
                sequences: [...sequences].sort((a, b) => a.startTime.localeCompare(b.startTime)),
              })),
            };
          }),
        );
        this.overviewLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.overviewLoading.set(false);
        this.showError(error);
      },
    });
  }

  /** Quitte la vue d'ensemble vers l'éditeur du jour/lieu choisi. */
  openDay(dayIndex: number, location: string): void {
    this.viewMode.set('day');
    this.dayIndex.set(dayIndex);
    this.location.set(location);
    this.closeForms();
    this.loadDay();
  }

  showDayView(): void {
    this.viewMode.set('day');
  }

  private loadTeamsOnce(): void {
    if (this.teamsLoaded) return;
    this.teamsLoaded = true;
    this.teamsApi.list().subscribe({
      next: (teams) => this.teams.set(teams.filter((team) => team.isActive)),
      error: () => (this.teamsLoaded = false),
    });
  }

  private loadMissionsOnce(): void {
    if (this.missionsLoaded) return;
    this.missionsLoaded = true;
    this.missionsApi.list().subscribe({
      next: (missions) =>
        this.missions.set([...missions].sort((a, b) => a.title.localeCompare(b.title, 'fr'))),
      error: () => (this.missionsLoaded = false),
    });
  }

  /** Affiche l'aperçu ; sur petit écran, ramène le panneau de validation à l'écran. */
  private showPreview(result: ProgramPreview): void {
    this.preview.set(result);
    this.recentlyChanged.set(new Set());
    this.revealPanel();
  }

  private revealPanel(): void {
    if (typeof window === 'undefined' || !window.matchMedia?.('(max-width: 960px)').matches) return;
    setTimeout(() => document.querySelector('.pending-bar, .preview-panel')?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }), 0);
  }

  private closeForms(): void {
    this.insertAfterId.set(null);
    this.resizeSequenceId.set(null);
    this.editSequenceId.set(null);
    this.createOpen.set(false);
    this.deleteTargetId.set(null);
    this.demoResetOpen.set(false);
    this.preview.set(null);
  }

  /** Recharge les séquences du jour affiché (source de vérité = serveur). */
  private loadDay(): void {
    const date = this.eventDate();
    this.loading.set(true);
    this.api.getDay(date).subscribe({
      next: (day) => {
        // Ignore une réponse tardive si l'utilisateur a changé de jour entre-temps.
        if (day.date !== this.eventDate()) return;
        this.allSequences.set(day.sequences);
        this.loading.set(false);
        const locations = this.locationsForDay();
        if (locations.length && !locations.includes(this.location())) {
          this.location.set(locations[0]);
        }
        if (this.changeLogOpen()) this.loadChangeLog();
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.showError(error);
      },
    });
  }

  private loadChangeLog(): void {
    this.api.getChangeLog(this.eventDate()).subscribe({
      next: (entries) => this.changeLog.set(entries),
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  private showError(error: HttpErrorResponse): void {
    const message = error.error?.message;
    const text = Array.isArray(message)
      ? message.join(' ')
      : (message ?? 'Une erreur est survenue. Réessayez.');
    this.actionMessage.set({ appearance: 'negative', text });
  }
}
