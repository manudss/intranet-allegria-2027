import { GatheringGroupsApiService } from '../gathering-groups/gathering-groups.api';
import {
  CATEGORY_LABELS,
  GatheringGroupSummary,
  GatheringRepartition,
} from '../gathering-groups/gathering-groups.models';
import { EventQuickEditorComponent } from './event-mission-links/event-quick-editor';
import { ShiftChangesComponent } from './event-mission-links/shift-changes';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  ProgramChangeLogEntry,
  ProgramPreview,
  ProgramSequence,
  ProgramSequenceDiff,
  ProgramSequenceDraft,
  ProgramSequenceStatus,
  ProgramSequenceTrack,
  ProgramSequenceVisibility,
} from '../../models/models';
import {
  ProgramApiService,
} from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { buildChain, PROGRAM_EVENT_DAYS } from './schedule-chain.util';
import { minutesToTime, timeToMinutes } from './schedule-time.util';

const MAIN_LOCATION = 'Grande salle';

/** Couleurs de branche, identiques à l'impression des badges (badge-print.logic.ts). */
const TRACK_COLORS: Record<ProgramSequenceTrack, string> = {
  [ProgramSequenceTrack.TA]: '#fe0002',
  [ProgramSequenceTrack.ES]: '#00b2b2',
  [ProgramSequenceTrack.COMMON]: '#6b5f52',
};

const TRACK_LABELS: Record<ProgramSequenceTrack, string> = {
  [ProgramSequenceTrack.TA]: 'TA',
  [ProgramSequenceTrack.ES]: 'ES',
  [ProgramSequenceTrack.COMMON]: 'Commun',
};

type TrackFilter = 'ALL' | ProgramSequenceTrack;

/**
 * Marqueur explicite d'un temps commun « cadre de scission » dans les notes (posé par le seed,
 * SPLIT_NOTE côté API) : le créneau n'est qu'un repère horaire, le programme réel est
 * dans les lieux « Groupe TA » / « Groupe ES ».
 */
const SPLIT_FRAME_NOTE = 'Temps séparé';

const TRACK_FILTERS: { value: TrackFilter; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: ProgramSequenceTrack.TA, label: 'TA' },
  { value: ProgramSequenceTrack.ES, label: 'ES' },
  { value: ProgramSequenceTrack.COMMON, label: 'Temps communs' },
];

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
  track: ProgramSequenceTrack.COMMON,
  volunteerTeamId: null,
  notes: null,
  visibility: ProgramSequenceVisibility.INTERNAL,
});

interface CreateDraft {
  location: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  track: ProgramSequenceTrack;
  visibility: ProgramSequenceVisibility;
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
  /** État face à la recherche : surligné, estompé, ou recherche inactive. */
  searchState: 'none' | 'hit' | 'dim';
}

/** Une ligne de la vue « Par piste » : temps commun pleine largeur, ou paire TA / ES côte à côte. */
interface TrackRow {
  key: string;
  common: ProgramSequence | null;
  ta: ProgramSequence | null;
  es: ProgramSequence | null;
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
  imports: [
    EventQuickEditorComponent,
    ShiftChangesComponent,
    ...SHARED_IMPORTS,
    RouterLink,
  ],
  templateUrl: './programme.html',
  styleUrls: ['./programme.scss', './programme-groups.scss'],
})
export class ProgrammePage {
  private readonly api = inject(ProgramApiService);
  private readonly gatheringApi = inject(GatheringGroupsApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly ProgramSequenceStatus = ProgramSequenceStatus;
  readonly ProgramSequenceTrack = ProgramSequenceTrack;
  readonly ProgramSequenceVisibility = ProgramSequenceVisibility;
  readonly publicExportStatus = signal<
    { eventDate: string; generatedAt: string; sequenceCount: number }[] | null
  >(null);
  readonly publishingPublic = signal(false);
  readonly days = PROGRAM_EVENT_DAYS;
  readonly trackFilters = TRACK_FILTERS;
  readonly trackOptions = TRACK_FILTERS.filter(
    (option): option is { value: ProgramSequenceTrack; label: string } => option.value !== 'ALL',
  );
  readonly trackFilter = signal<TrackFilter>('ALL');

  /** Disposition de la vue jour : calendrier par lieu (existant) ou deux colonnes TA / ES (maquette validée). */
  readonly dayLayout = signal<'locations' | 'tracks' | 'groups'>('locations');

  setDayLayout(mode: 'locations' | 'tracks' | 'groups'): void {
    this.dayLayout.set(mode);
    if (mode === 'groups') this.loadGroupsOnce();
  }

  /** Répartitions de groupes de rassemblement (nouveaux groupes), chargées à l'ouverture de la vue. */
  readonly repartitions = signal<GatheringRepartition[]>([]);
  private groupsLoaded = false;

  private loadGroupsOnce(): void {
    if (this.groupsLoaded) return;
    this.groupsLoaded = true;
    this.gatheringApi.list().subscribe({
      next: (repartitions) => this.repartitions.set(repartitions),
      error: () => (this.groupsLoaded = false),
    });
  }

  protected readonly categoryLabels = CATEGORY_LABELS;

  /**
   * Lanes de la vue « Par groupe » : une lane par groupe de rassemblement des répartitions liées
   * aux créneaux du jour (un créneau lié à une répartition apparaît dans la lane de chacun de ses
   * groupes), puis les créneaux sans groupe. Le filtre de piste s'applique comme dans les autres
   * vues ; la recherche surligne et estompe sans retirer les créneaux.
   */
  readonly groupLanes = computed(() => {
    const byRepartition = new Map(this.repartitions().map((r) => [r.id, r]));
    const lanes = new Map<number, { group: GatheringGroupSummary; repartition: GatheringRepartition; sequences: ProgramSequence[] }>();
    const without: ProgramSequence[] = [];
    for (const sequence of this.daySequences()) {
      if (!this.matchesTrack(sequence)) continue;
      const linked = (sequence.gatheringRepartitionIds ?? [])
        .map((id) => byRepartition.get(id))
        .filter((r): r is GatheringRepartition => !!r);
      const groups = linked.flatMap((r) => r.groups.map((group) => ({ group, repartition: r })));
      if (groups.length === 0) {
        without.push(sequence);
        continue;
      }
      for (const entry of groups) {
        const lane = lanes.get(entry.group.id) ?? { ...entry, sequences: [] };
        lane.sequences.push(sequence);
        lanes.set(entry.group.id, lane);
      }
    }
    const sorted = (list: ProgramSequence[]) => [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const result = Array.from(lanes.values())
      .map((lane) => ({ ...lane, sequences: sorted(lane.sequences) }))
      .sort((a, b) => a.group.name.localeCompare(b.group.name, 'fr'));
    return { lanes: result, without: sorted(without) };
  });

  trackColor(track: ProgramSequenceTrack): string {
    return TRACK_COLORS[track] ?? TRACK_COLORS[ProgramSequenceTrack.COMMON];
  }

  trackLabel(track: ProgramSequenceTrack): string {
    return TRACK_LABELS[track] ?? TRACK_LABELS[ProgramSequenceTrack.COMMON];
  }

  /** Logos de branche (assets de l'impression des badges) ; les temps communs portent les deux. */
  trackLogos(track: ProgramSequenceTrack): string[] {
    if (track === ProgramSequenceTrack.TA) return ['/assets/branches/ta.jpg'];
    if (track === ProgramSequenceTrack.ES) return ['/assets/branches/es.jpg'];
    return ['/assets/branches/ta.jpg', '/assets/branches/es.jpg'];
  }

  setTrackFilter(value: TrackFilter): void {
    this.trackFilter.set(value);
  }

  /** Filtre d'affichage par piste (n'altère ni les chaînes ni les données). */
  private matchesTrack(sequence: ProgramSequence): boolean {
    const filter = this.trackFilter();
    return filter === 'ALL' || (sequence.track ?? ProgramSequenceTrack.COMMON) === filter;
  }

  // ─── Phase 3 : recherche, menu contextuel, chiffres du jour ──────

  /** Recherche libre dans le titre, le lieu et l'équipe responsable (affichage seul). */
  readonly searchQuery = signal('');

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  private matchesSearch(sequence: ProgramSequence): boolean {
    const term = this.searchQuery().trim().toLocaleLowerCase('fr');
    if (!term) return true;
    return `${sequence.title} ${sequence.location} ${sequence.volunteerTeamName ?? ''}`
      .toLocaleLowerCase('fr')
      .includes(term);
  }

  private matchesDisplay(sequence: ProgramSequence): boolean {
    return this.matchesTrack(sequence) && this.matchesSearch(sequence);
  }

  /** Recherche active : du texte est saisi dans le champ de recherche. */
  readonly searchActive = computed(() => this.searchQuery().trim().length > 0);

  /**
   * État visuel d'un créneau face à la recherche : les correspondants sont surlignés,
   * les autres estompés, mais tous restent affichés (le planning garde sa structure).
   */
  searchStateOf(sequence: ProgramSequence): 'none' | 'hit' | 'dim' {
    if (!this.searchActive()) return 'none';
    return this.matchesSearch(sequence) ? 'hit' : 'dim';
  }

  /** Menu d'actions ouvert au clic sur un créneau, positionné près du pointeur. */
  readonly sequenceMenu = signal<{ sequence: ProgramSequence; x: number; y: number } | null>(null);
  private suppressMenuClick = false;

  private static readonly MENU_WIDTH = 260;
  private static readonly MENU_HEIGHT = 330;

  onSequenceClick(event: MouseEvent, sequence: ProgramSequence): void {
    if (this.suppressMenuClick) {
      this.suppressMenuClick = false;
      return;
    }
    event.stopPropagation();
    this.selectLocation(sequence.location);
    this.openSequenceMenuAt(sequence, event.clientX, event.clientY, event);
  }

  /** Ouvre le menu au clavier (Entrée/Espace sur un bloc focusable), positionné sur le bloc. */
  onBlockKey(event: Event, block: BlockView): void {
    if (!block.sequence) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.openSequenceMenuAt(
      block.sequence,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      event,
    );
  }

  /** Élément déclencheur du menu (bloc cliqué) : le focus y revient quand le menu se ferme. */
  private menuTrigger: HTMLElement | null = null;

  private openSequenceMenuAt(
    sequence: ProgramSequence,
    x: number,
    y: number,
    event?: Event,
  ): void {
    const maxX = Math.max(8, window.innerWidth - ProgrammePage.MENU_WIDTH - 8);
    const maxY = Math.max(8, window.innerHeight - ProgrammePage.MENU_HEIGHT - 8);
    this.menuTrigger =
      event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.sequenceMenu.set({
      sequence,
      x: Math.min(Math.max(x, 8), maxX),
      y: Math.min(Math.max(y, 8), maxY),
    });
    // Déplace le focus dans le menu (navigation clavier / lecteur d'écran).
    setTimeout(() => {
      const first = document.querySelector<HTMLElement>('.sequence-menu .menu-item');
      first?.focus({ preventScroll: true });
    }, 0);
  }

  onBlockClick(event: MouseEvent, block: BlockView): void {
    if (!block.sequence) return;
    this.onSequenceClick(event, block.sequence);
  }

  closeSequenceMenu(restoreFocus = false): void {
    if (!this.sequenceMenu()) return;
    this.sequenceMenu.set(null);
    if (restoreFocus && this.menuTrigger?.isConnected) {
      this.menuTrigger.focus({ preventScroll: true });
    }
    this.menuTrigger = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSequenceMenu(true);
  }

  /** Le menu est positionné près du pointeur : il se ferme si la fenêtre change de taille. */
  @HostListener('window:resize')
  onWindowResize(): void {
    this.closeSequenceMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.sequenceMenu()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.sequence-menu, .sequence-block, .track-card')) return;
    this.closeSequenceMenu();
  }

  private menuSequence(): ProgramSequence | null {
    return this.sequenceMenu()?.sequence ?? null;
  }

  menuQuickEdit(): void {
    const sequence = this.menuSequence();
    this.closeSequenceMenu();
    if (sequence) this.openEditForm(sequence);
  }

  menuInsertAfter(): void {
    const sequence = this.menuSequence();
    this.closeSequenceMenu();
    if (sequence) this.openInsertForm(sequence.id);
  }

  menuResize(): void {
    const sequence = this.menuSequence();
    this.closeSequenceMenu();
    if (sequence) this.openResizeForm(sequence);
  }

  menuToggleFreeze(): void {
    const sequence = this.menuSequence();
    this.closeSequenceMenu();
    if (sequence) this.toggleFreeze(sequence);
  }

  menuDelete(): void {
    const sequence = this.menuSequence();
    this.closeSequenceMenu();
    if (sequence) this.deleteSequence(sequence);
  }

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
    const map = new Map<number, ProgramSequenceDiff['after']>();
    for (const diff of this.previewDiffs()) map.set(diff.sequenceId, diff.after);
    return map;
  });

  /**
   * Changements de l'aperçu, cible comprise. L'API ne liste que les créneaux impactés : pour un
   * redimensionnement, le créneau redimensionné lui-même est ajouté ici (avant -> après).
   */
  readonly previewDiffs = computed<ProgramSequenceDiff[]>(() => {
    const current = this.preview();
    if (!current) return [];
    if (
      current.kind !== 'resize' ||
      current.affected.some((d) => d.sequenceId === current.sequenceId)
    ) {
      return current.affected;
    }
    const target = this.allSequences().find((s) => s.id === current.sequenceId);
    if (!target) return current.affected;
    const endTime = minutesToTime(timeToMinutes(target.startTime) + current.newDurationMinutes);
    const targetDiff: ProgramSequenceDiff = {
      sequenceId: target.id,
      title: target.title,
      before: {
        startTime: target.startTime,
        endTime: target.endTime,
        durationMinutes: target.durationMinutes,
      },
      after: { startTime: target.startTime, endTime, durationMinutes: current.newDurationMinutes },
    };
    return [targetDiff, ...current.affected];
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
      end: Math.max(
        Math.ceil(Math.max(...ends) / 60) * 60,
        Math.floor(Math.min(...starts) / 60) * 60 + 60,
      ),
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
    const blocked = !!current && current.outcome !== 'ok';
    const recent = this.recentlyChanged();
    const date = this.eventDate();
    const sequences = this.allSequences();

    return this.locationsForDay().map((name) => {
      const blocks: BlockView[] = buildChain(sequences, date, name)
        .filter((sequence) => this.matchesTrack(sequence))
        .map((sequence) => {
          const after = projected.get(sequence.id);
          const startTime = after?.startTime ?? sequence.startTime;
          const endTime = after?.endTime ?? sequence.endTime;
          const duration = after?.durationMinutes ?? sequence.durationMinutes;
          const changed =
            !!after &&
            (after.startTime !== sequence.startTime ||
              after.durationMinutes !== sequence.durationMinutes);
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
            searchState: this.searchStateOf(sequence),
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
          searchState: 'none',
        });
      }
      return { name, selected: name === this.location(), blocks };
    });
  });

  /** Nombre de créneaux que l'aperçu en cours déplace, redimensionne ou crée. */
  readonly pendingChangeCount = computed(() => {
    const current = this.preview();
    if (!current) return 0;
    const moved = this.previewDiffs().filter(
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
      this.preview() !== null,
  );

  readonly dragState = signal<DragState | null>(null);
  readonly resizeDragState = signal<ResizeDragState | null>(null);

  /** Chiffres du jour affiché (tous lieux, filtre piste appliqué), réduits à des pastilles. */
  readonly dayStats = computed(() => {
    const sequences = this.daySequences().filter((s) => this.matchesTrack(s));
    const frozenCount = sequences.filter(
      (s) => s.status === ProgramSequenceStatus.FROZEN,
    ).length;
    return {
      total: sequences.length,
      mobile: sequences.length - frozenCount,
      frozen: frozenCount,
      branches: sequences.filter((s) => s.anchorSequenceId !== null).length,
    };
  });

  /** Entrées du journal du jour affiché (le bouton « Journal » porte ce compteur). */
  readonly journalCount = computed(
    () => this.changeLog().filter((entry) => entry.eventDate === this.eventDate()).length,
  );

  /** Bandeau liste publique : jamais générée, à republier (N modifications depuis) ou à jour. */
  readonly exportBanner = computed(() => {
    const status = this.publicExportStatus();
    if (status === null) return null;
    if (!status.length) return { kind: 'never' as const, generatedAt: null, changesSince: 0 };
    const generatedAt = status
      .map((entry) => entry.generatedAt)
      .reduce((a, b) => (a > b ? a : b));
    const changesSince = this.changeLog().filter(
      (entry) => entry.createdAt > generatedAt,
    ).length;
    return {
      kind: changesSince > 0 ? ('stale' as const) : ('fresh' as const),
      generatedAt,
      changesSince,
    };
  });

  readonly canEdit = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));

  readonly preview = signal<ProgramPreview | null>(null);
  readonly actionMessage = signal<ActionMessage | null>(null);

  readonly insertAfterId = signal<number | null>(null);
  readonly insertDraft = signal<ProgramSequenceDraft>(EMPTY_DRAFT());

  readonly resizeSequenceId = signal<number | null>(null);
  readonly resizeDuration = signal<number | null>(null);

  readonly viewMode = signal<'day' | 'overview'>('day');
  readonly overview = signal<OverviewDay[]>([]);
  readonly overviewLoading = signal(false);

  /**
   * Lignes de la vue « Par piste » : les temps communs sur toute la largeur, les créneaux TA et ES
   * en deux colonnes, appariés quand ils partagent exactement le même horaire. Affichage seul.
   */
  readonly trackRows = computed<TrackRow[]>(() => {
    const date = this.eventDate();
    const sequences = this.allSequences()
      .filter((s) => s.eventDate === date)
      .filter((s) => this.matchesTrack(s));
    const byStart = (a: ProgramSequence, b: ProgramSequence) =>
      a.startTime.localeCompare(b.startTime);
    // Cadre de scission : temps commun portant la note explicite « Temps séparé » (seed)
    // ET repris par des créneaux de branche (ancrage, ou fenêtre horaire exactement égale).
    // Seuls ces cadres-là ne sont pas rendus en plus de la paire TA / ES : un vrai temps
    // commun, même au même horaire qu'un créneau de branche, n'est jamais masqué.
    const branchAnchorIds = new Set(
      sequences.map((s) => s.anchorSequenceId).filter((id): id is number => id !== null),
    );
    const branchWindows = sequences
      .filter((s) => s.track === ProgramSequenceTrack.TA || s.track === ProgramSequenceTrack.ES)
      .map((s) => `${s.startTime}-${s.endTime}`);
    const isSplitFrame = (s: ProgramSequence): boolean =>
      (s.notes ?? '').includes(SPLIT_FRAME_NOTE) &&
      (branchAnchorIds.has(s.id) || branchWindows.includes(`${s.startTime}-${s.endTime}`));
    const commons = sequences
      .filter((s) => (s.track ?? ProgramSequenceTrack.COMMON) === ProgramSequenceTrack.COMMON)
      .filter((s) => !isSplitFrame(s))
      .sort(byStart);
    const tas = sequences.filter((s) => s.track === ProgramSequenceTrack.TA).sort(byStart);
    const ess = sequences.filter((s) => s.track === ProgramSequenceTrack.ES).sort(byStart);

    const rows: TrackRow[] = commons.map((common) => ({
      key: `c${common.id}`,
      common,
      ta: null,
      es: null,
    }));
    const pairedEs = new Set<number>();
    for (const ta of tas) {
      const match = ess.find(
        (es) => !pairedEs.has(es.id) && es.startTime === ta.startTime && es.endTime === ta.endTime,
      );
      if (match) pairedEs.add(match.id);
      rows.push({ key: `t${ta.id}`, common: null, ta, es: match ?? null });
    }
    for (const es of ess.filter((e) => !pairedEs.has(e.id))) {
      rows.push({ key: `e${es.id}`, common: null, ta: null, es });
    }
    const firstTime = (row: TrackRow) => (row.common ?? row.ta ?? row.es)!.startTime;
    return rows.sort((a, b) => firstTime(a).localeCompare(firstTime(b)));
  });

  /** Vue d'ensemble filtrée par piste : lieux vidés par le filtre masqués. */
  readonly filteredOverview = computed<OverviewDay[]>(() =>
    this.overview().map((day) => ({
      ...day,
      locations: day.locations
        .map((loc) => ({
          ...loc,
          sequences: loc.sequences.filter((s) => this.matchesDisplay(s)),
        }))
        .filter((loc) => loc.sequences.length > 0),
    })),
  );

  readonly editingSequence = signal<ProgramSequence | null>(null);
  readonly quickEditor = viewChild(EventQuickEditorComponent);
  canDeactivate() {
    return this.quickEditor()?.confirmNavigation() ?? true;
  }
  refreshAfterQuickEdit() {
    this.loadDay();
  }
  readonly editSequenceId = signal<number | null>(null);

  readonly createOpen = signal(false);
  readonly deleteTargetId = signal<number | null>(null);
  readonly closeGap = signal(false);
  readonly createDraft = signal<CreateDraft>({
    location: '',
    title: '',
    startTime: '09:00',
    durationMinutes: 30,
    track: ProgramSequenceTrack.COMMON,
    visibility: ProgramSequenceVisibility.INTERNAL,
  });

  constructor() {
    // Lien profond (ex. depuis la fiche événement) : /programme?date=YYYY-MM-DD&lieu=…
    this.applyQueryParams(this.route.snapshot.queryParamMap);
    this.loadDay();
    // Le menu contextuel est positionné près du pointeur : tout défilement (page ou grille)
    // le détacherait de son créneau, on le ferme donc. On écoute wheel/touchmove plutôt que
    // scroll : un défilement déclenché par le code (ex. mise au point d'un créneau avant clic)
    // ne doit pas fermer le menu qui vient de s'ouvrir.
    if (typeof window !== 'undefined') {
      const closeOnScroll = () => this.closeSequenceMenu();
      window.addEventListener('wheel', closeOnScroll, { capture: true, passive: true });
      window.addEventListener('touchmove', closeOnScroll, { capture: true, passive: true });
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('wheel', closeOnScroll, true);
        window.removeEventListener('touchmove', closeOnScroll, true);
      });
    }
  }

  /** Pré-positionne le jour et le lieu demandés par un lien profond, s'ils sont connus. */
  applyQueryParams(params: ParamMap): void {
    const date = params.get('date');
    const dayIndex = date ? this.days.indexOf(date) : -1;
    if (dayIndex >= 0) this.dayIndex.set(dayIndex);
    const lieu = params.get('lieu');
    if (lieu) this.location.set(lieu);
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
    const delta =
      block.sequence && resize?.sequenceId === block.sequence.id ? resize.deltaMinutes : 0;
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
      this.resizeDragState.set({
        ...resize,
        deltaMinutes: this.snappedDelta(event, resize.startClientY),
      });
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
    this.suppressMenuClick = true;
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
  endDrag(event?: PointerEvent): void {
    const state = this.dragState();
    this.dragState.set(null);
    if (!state) return;
    if (state.deltaMinutes === 0) {
      // Simple clic souris sur un créneau déplaçable : ouvrir le menu d'actions du créneau.
      const sequence = this.allSequences().find((s) => s.id === state.sequenceId);
      if (sequence && event) this.onSequenceClick(event, sequence);
      return;
    }
    this.suppressMenuClick = true;

    const newDuration = state.baseDuration + state.deltaMinutes;
    if (newDuration < DRAG_SNAP_MINUTES) return;

    this.insertAfterId.set(null);
    this.resizeSequenceId.set(state.previousId);
    this.resizeDuration.set(newDuration);
    this.previewResizeAction();
  }

  openInsertForm(afterSequenceId: number): void {
    this.editSequenceId.set(null);
    this.editingSequence.set(null);
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
    this.editingSequence.set(null);
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
    if (!current || current.outcome !== 'ok') return;

    const request =
      current.kind === 'insert'
        ? this.api.applyInsert(current.afterSequenceId, current.draft, current.version)
        : this.api.applyResize(current.sequenceId, current.newDurationMinutes, current.version);

    const touched = this.previewDiffs()
      .filter(
        (diff) =>
          diff.before.startTime !== diff.after.startTime ||
          diff.before.durationMinutes !== diff.after.durationMinutes,
      )
      .map((diff) => diff.sequenceId);
    if (current.kind === 'resize' && !touched.includes(current.sequenceId))
      touched.push(current.sequenceId);
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

  // ─── Création / édition / suppression ──────────────────────────────

  openCreateForm(): void {
    this.closeForms();
    const startTime = this.chain().length ? this.chain()[0].startTime : '09:00';
    this.createDraft.set({
      location: this.chain().length ? '' : this.location(),
      title: '',
      startTime,
      durationMinutes: 30,
      track: ProgramSequenceTrack.COMMON,
      visibility: ProgramSequenceVisibility.INTERNAL,
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
        track: draft.track,
        visibility: draft.visibility,
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
    this.editSequenceId.set(sequence.id);
    this.editingSequence.set(sequence);
    this.revealPanel();
  }

  /** Bouton « Mettre à jour la liste publique » : régénère l'instantané statique (jamais automatique). */
  publishPublicProgram(): void {
    if (this.publishingPublic()) return;
    this.publishingPublic.set(true);
    this.api.regeneratePublicExport().subscribe({
      next: (result) => {
        this.publishingPublic.set(false);
        this.actionMessage.set({
          appearance: 'positive',
          text: `Liste publique mise à jour (${result.dates.length} jour(s)).`,
        });
        this.loadPublicExportStatus();
      },
      error: (error: HttpErrorResponse) => {
        this.publishingPublic.set(false);
        this.showError(error);
      },
    });
  }

  loadPublicExportStatus(): void {
    this.api.getPublicExportStatus().subscribe({
      next: (status) => this.publicExportStatus.set(status),
      error: () => this.publicExportStatus.set(null),
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

  /** Affiche l'aperçu ; sur petit écran, ramène le panneau de validation à l'écran. */
  private showPreview(result: ProgramPreview): void {
    this.preview.set(result);
    this.recentlyChanged.set(new Set());
    this.revealPanel();
  }

  private revealPanel(): void {
    if (typeof window === 'undefined' || !window.matchMedia?.('(max-width: 960px)').matches) return;
    setTimeout(
      () =>
        document
          .querySelector('.pending-bar, .preview-panel')
          ?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }),
      0,
    );
  }

  private closeForms(): void {
    this.insertAfterId.set(null);
    this.resizeSequenceId.set(null);
    this.editSequenceId.set(null);
    this.editingSequence.set(null);
    this.createOpen.set(false);
    this.deleteTargetId.set(null);
    this.preview.set(null);
  }

  /** Recharge les séquences du jour affiché (source de vérité = serveur). */
  private loadDay(): void {
    this.loadPublicExportStatus();
    this.loadChangeLog();
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
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.showError(error);
      },
    });
  }

  /** Journal complet : compteur du bouton « Journal » et bandeau « N modifications depuis ». */
  private loadChangeLog(): void {
    this.api.getChangeLog().subscribe({
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
