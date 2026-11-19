import {
  Component,
  OnChanges,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TuiTime } from '@taiga-ui/cdk';
import { TuiInputTime } from '@taiga-ui/kit';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SHARED_IMPORTS } from '../../../shared/shared-imports';
import { EventMissionLinksComponent } from './event-mission-links';
import { ShiftChangesComponent } from './shift-changes';
import { EventChoiceComponent } from './choice';
import {
  GroupsApiService,
  ProgramApiService,
  VolunteerTeamsApiService,
} from '../../../services/api.services';
import {
  Group,
  ProgramSequence,
  ProgramSequenceDetail,
  ProgramSequenceTrack,
  ProgramSequenceVisibility,
  ProgramResizePreview,
  VolunteerTeam,
} from '../../../models/models';
import { timeToMinutes } from '../schedule-time.util';
@Component({
  selector: 'app-event-quick-editor',
  imports: [
    ...SHARED_IMPORTS,
    TuiInputTime,
    EventMissionLinksComponent,
    ShiftChangesComponent,
    EventChoiceComponent,
  ],
  templateUrl: './event-quick-editor.html',
  styleUrl: './event-quick-editor.scss',
})
export class EventQuickEditorComponent implements OnChanges {
  private readonly api = inject(ProgramApiService);
  private readonly groupsApi = inject(GroupsApiService);
  private readonly teamsApi = inject(VolunteerTeamsApiService);
  private readonly router = inject(Router);
  readonly event = input.required<ProgramSequence>();
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly sequence = signal<ProgramSequenceDetail | null>(null);
  readonly groups = signal<Group[]>([]);
  readonly teams = signal<VolunteerTeam[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly title = signal('');
  readonly notes = signal('');
  readonly track = signal<ProgramSequenceTrack>(ProgramSequenceTrack.COMMON);
  readonly visibility = signal<ProgramSequenceVisibility>(ProgramSequenceVisibility.INTERNAL);
  readonly teamId = signal<number | null>(null);
  readonly start = signal('');
  readonly end = signal('');
  readonly startTimeValue = computed(() => this.timeValue(this.start()));
  readonly endTimeValue = computed(() => this.timeValue(this.end()));
  readonly preview = signal<ProgramResizePreview | null>(null);
  readonly timeTarget = signal<number | null>(null);
  readonly documents = signal<{ label: string; url: string }[]>([]);
  readonly groupId = signal<number | null>(null);
  readonly newGroupOpen = signal(false);
  readonly groupName = signal('');
  readonly diocese = signal('');
  readonly confirmExit = signal<'close' | 'fiche' | 'navigation' | null>(null);
  private initial = '';
  readonly trackChoices = [
    { value: 'TA', label: 'TA' },
    { value: 'ES', label: 'ES' },
    { value: 'COMMON', label: 'Temps communs' },
  ];
  readonly visibilityChoices = [
    { value: 'PUBLIC', label: 'Public · grand temps' },
    { value: 'INTERNAL', label: 'Bénévoles-coordinateurs' },
  ];
  readonly teamChoices = computed(() => [
    { value: null, label: 'Aucune' },
    ...this.teams().map((t) => ({ value: t.id, label: t.name })),
  ]);
  readonly groupChoices = computed(() =>
    this.groups()
      .filter((g) => !this.sequence()?.groupIds.includes(g.id))
      .map((g) => ({ value: g.id, label: g.name })),
  );
  timeValue(value: string): TuiTime | null {
    return /^\d{2}:\d{2}$/.test(value) ? TuiTime.fromString(value) : null;
  }
  setTime(field: 'start' | 'end', value: TuiTime | null) {
    this[field].set(value?.toString('HH:MM') ?? '');
    this.preview.set(null);
  }
  snapshot() {
    return JSON.stringify([
      this.title(),
      this.notes(),
      this.track(),
      this.visibility(),
      this.teamId(),
      this.documents(),
    ]);
  }
  dirty() {
    const base = this.sequence() ?? this.event();
    return (
      this.initial !== this.snapshot() ||
      this.start() !== base.startTime ||
      this.end() !== base.endTime
    );
  }
  private navigationResolve: ((allow: boolean) => void) | null = null;
  confirmNavigation(): boolean | Promise<boolean> {
    if (!this.dirty()) return true;
    this.confirmExit.set('navigation');
    return new Promise((resolve) => (this.navigationResolve = resolve));
  }
  stay() {
    this.confirmExit.set(null);
    this.navigationResolve?.(false);
    this.navigationResolve = null;
  }
  ngOnChanges() {
    const s = this.event();
    this.title.set(s.title);
    this.notes.set(s.notes ?? '');
    this.track.set(s.track);
    this.visibility.set(s.visibility);
    this.teamId.set(s.volunteerTeamId);
    this.start.set(s.startTime);
    this.end.set(s.endTime);
    this.documents.set(s.documentLinks.map((d) => ({ ...d })));
    this.initial = this.snapshot();
    this.load();
  }
  load() {
    forkJoin({
      sequence: this.api.getSequence(this.event().id),
      groups: this.groupsApi.list(),
      teams: this.teamsApi.list(),
    }).subscribe({
      next: (r) => {
        this.sequence.set(r.sequence);
        this.groups.set(r.groups);
        this.teams.set(r.teams);
      },
      error: (e) => this.fail(e),
    });
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(e: BeforeUnloadEvent) {
    if (this.dirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
  requestExit(kind: 'close' | 'fiche') {
    if (this.busy()) return;
    if (this.dirty()) {
      this.confirmExit.set(kind);
      return;
    }
    this.exit(kind);
  }
  exit(kind: 'close' | 'fiche' | 'navigation') {
    if (kind === 'navigation') {
      this.navigationResolve?.(true);
      this.navigationResolve = null;
      return;
    }
    this.initial = this.snapshot();
    const base = this.sequence() ?? this.event();
    this.start.set(base.startTime);
    this.end.set(base.endTime);
    if (kind === 'fiche') void this.router.navigate(['/programme/evenements', this.event().id]);
    else this.closed.emit();
  }
  save() {
    if (this.busy() || !this.title().trim()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .updateSequence(this.event().id, {
        title: this.title(),
        notes: this.notes(),
        track: this.track(),
        visibility: this.visibility(),
        volunteerTeamId: this.teamId(),
        documentLinks: this.documents(),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          const s = this.sequence();
          if (s) {
            this.sequence.set({
              ...s,
              title: this.title(),
              notes: this.notes(),
              track: this.track(),
              visibility: this.visibility(),
              volunteerTeamId: this.teamId(),
              documentLinks: this.documents(),
            });
          }
          this.initial = this.snapshot();
          this.saved.emit();
          if (
            this.start() !== this.sequence()?.startTime ||
            this.end() !== this.sequence()?.endTime
          ) {
            this.error.set(
              'Retouches enregistrées. Les horaires saisis restent à prévisualiser et confirmer séparément.',
            );
          } else this.closed.emit();
        },
        error: (e) => this.fail(e),
      });
  }
  previewTime() {
    const s = this.sequence();
    if (!s || this.busy()) return;
    this.error.set('');
    this.preview.set(null);
    const startChanged = this.start() !== s.startTime,
      endChanged = this.end() !== s.endTime;
    if (startChanged === endChanged) {
      this.error.set('Modifier le début ou la fin, un seul à la fois.');
      return;
    }
    if (startChanged && !s.previousSequenceId) {
      this.error.set('Le premier créneau conserve son heure de début.');
      return;
    }
    this.busy.set(true);
    this.api.getDay(s.eventDate).subscribe({
      next: (day) => {
        const target = startChanged ? day.sequences.find((e) => e.id === s.previousSequenceId) : s;
        if (!target) {
          this.fail({ error: { message: 'Créneau précédent introuvable.' } });
          return;
        }
        const duration = startChanged
          ? target.durationMinutes + timeToMinutes(this.start()) - timeToMinutes(s.startTime)
          : (timeToMinutes(this.end()) - timeToMinutes(s.startTime) + 1440) % 1440;
        if (duration < 5) {
          this.fail({ error: { message: 'Durée minimale : 5 minutes.' } });
          return;
        }
        this.timeTarget.set(target.id);
        this.api.previewResize(target.id, duration).subscribe({
          next: (p) => {
            this.preview.set(p);
            this.busy.set(false);
          },
          error: (e) => this.fail(e),
        });
      },
      error: (e) => this.fail(e),
    });
  }
  applyTime() {
    const p = this.preview(),
      target = this.timeTarget();
    if (!p || !target || p.outcome !== 'ok' || this.busy()) return;
    this.busy.set(true);
    this.api.applyResize(target, p.newDurationMinutes, p.version).subscribe({
      next: () => {
        this.busy.set(false);
        this.preview.set(null);
        this.api.getSequence(this.event().id).subscribe({
          next: (s) => {
            this.sequence.set(s);
            this.start.set(s.startTime);
            this.end.set(s.endTime);
            this.saved.emit();
          },
          error: (e) => this.fail(e),
        });
      },
      error: (e) => {
        this.preview.set(null);
        this.fail(e);
      },
    });
  }
  addDocument() {
    this.documents.update((ds) => [...ds, { label: '', url: '' }]);
  }
  updateDocument(i: number, key: 'label' | 'url', value: string) {
    this.documents.update((ds) => ds.map((d, j) => (j === i ? { ...d, [key]: value } : d)));
  }
  removeDocument(i: number) {
    this.documents.update((ds) => ds.filter((_, j) => j !== i));
  }
  setGroups(ids: number[]) {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.setSequenceGroups(this.event().id, ids).subscribe({
      next: (s) => {
        this.sequence.set(s);
        this.groupId.set(null);
        this.busy.set(false);
        this.saved.emit();
      },
      error: (e) => this.fail(e),
    });
  }
  linkGroup() {
    const s = this.sequence(),
      id = this.groupId();
    if (s && id) this.setGroups([...s.groupIds, id]);
  }
  unlinkGroup(id: number) {
    const s = this.sequence();
    if (s) this.setGroups(s.groupIds.filter((g) => g !== id));
  }
  groupNameFor(id: number) {
    return this.groups().find((g) => g.id === id)?.name ?? `Groupe #${id}`;
  }
  createGroup() {
    if (!this.groupName().trim() || this.busy()) return;
    this.busy.set(true);
    this.groupsApi
      .create({
        name: this.groupName().trim(),
        diocese: this.diocese().trim(),
        arrivalDatetime: '',
        departureDatetime: '',
        notes: '',
      })
      .subscribe({
        next: (g) => {
          this.groups.update((gs) => [...gs, g]);
          this.groupId.set(g.id);
          this.newGroupOpen.set(false);
          this.busy.set(false);
          this.linkGroup();
        },
        error: (e) => this.fail(e),
      });
  }
  fail(e: unknown) {
    this.busy.set(false);
    this.error.set(
      (e as { error?: { message?: string } }).error?.message ??
        'Action impossible. Vos saisies sont conservées.',
    );
  }
}
