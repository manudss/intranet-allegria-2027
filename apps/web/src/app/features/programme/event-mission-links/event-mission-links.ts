import { EventChoiceComponent } from './choice';
import { Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SHARED_IMPORTS } from '../../../shared/shared-imports';
import {
  ProgramApiService,
  VolunteerMissionsApiService,
  VolunteerTeamsApiService,
} from '../../../services/api.services';
import {
  EventBindingPreview,
  EventMissionPhase,
  EventMissionTiming,
  EventShiftBindingDraft,
  ProgramSequenceDetail,
  VolunteerMission,
  VolunteerMissionStatus,
  VolunteerShift,
  VolunteerTeam,
} from '../../../models/models';

export const EVENT_PHASES: { value: EventMissionPhase | null; label: string }[] = [
  { value: 'BEFORE', label: 'Avant' },
  { value: 'DURING', label: 'Pendant' },
  { value: 'AFTER', label: 'Après' },
  { value: null, label: 'À classer' },
];
@Component({
  selector: 'app-event-mission-links',
  imports: [...SHARED_IMPORTS, EventChoiceComponent],
  templateUrl: './event-mission-links.html',
  styleUrl: './event-mission-links.scss',
})
export class EventMissionLinksComponent implements OnChanges {
  private readonly api = inject(ProgramApiService);
  private readonly missionsApi = inject(VolunteerMissionsApiService);
  private readonly teamsApi = inject(VolunteerTeamsApiService);
  readonly sequenceId = input.required<number>();
  readonly editable = input(false);
  readonly changed = output<void>();
  readonly sequence = signal<ProgramSequenceDetail | null>(null);
  readonly missions = signal<VolunteerMission[]>([]);
  readonly teams = signal<VolunteerTeam[]>([]);
  readonly timing = signal<EventMissionTiming>({ phases: [], bindings: [] });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly loading = signal(false);
  readonly phases = EVENT_PHASES;
  readonly filter = signal('');
  readonly chosen = signal<number | null>(null);
  readonly addPhase = signal<EventMissionPhase | null>(null);
  readonly createOpen = signal(false);
  readonly newTitle = signal('');
  readonly newTeam = signal<number | null>(null);
  readonly addOpen = signal(false);
  readonly configMission = signal<VolunteerMission | null>(null);
  readonly shifts = signal<VolunteerShift[]>([]);
  readonly shiftId = signal<number | null>(null);
  readonly startAnchor = signal<'START' | 'END' | ''>('');
  readonly endAnchor = signal<'START' | 'END' | ''>('');
  readonly startOffset = signal<number | null>(null);
  readonly endOffset = signal<number | null>(null);
  readonly pilotConfirmed = signal(false);
  readonly preview = signal<EventBindingPreview | null>(null);
  readonly removeShift = signal<number | null>(null);
  readonly linked = computed(() => {
    const ids = new Set(this.sequence()?.missionIds ?? []);
    return [...new Map(this.missions().map((m) => [m.id, m])).values()].filter((m) =>
      ids.has(m.id),
    );
  });
  readonly available = computed(() => {
    const ids = new Set(this.sequence()?.missionIds ?? []),
      term = this.filter().toLocaleLowerCase('fr');
    return [...new Map(this.missions().map((m) => [m.id, m])).values()].filter(
      (m) =>
        !ids.has(m.id) &&
        `${m.title} ${m.volunteerTeam?.name ?? ''}`.toLocaleLowerCase('fr').includes(term),
    );
  });
  readonly currentBinding = computed(
    () => this.timing().bindings.find((b) => b.shiftId === this.shiftId()) ?? null,
  );
  readonly phaseChoices = EVENT_PHASES.filter((p) => p.value !== null).map((p) => ({
    value: p.value,
    label: p.label,
  }));
  readonly missionChoices = computed(() =>
    this.available().map((m) => ({
      value: m.id,
      label: m.title + ' · ' + (m.volunteerTeam?.name ?? 'Sans équipe'),
    })),
  );
  readonly teamChoices = computed(() => [
    { value: null, label: 'Aucune' },
    ...this.teams().map((t) => ({ value: t.id, label: t.name })),
  ]);
  readonly shiftChoices = computed(() =>
    this.shifts().map((s) => ({
      value: s.id,
      label: this.date(s.startAt) + ' → ' + this.date(s.endAt),
    })),
  );
  readonly anchorChoices = [
    { value: 'START', label: 'Début de l’événement' },
    { value: 'END', label: 'Fin de l’événement' },
  ];
  ngOnChanges() {
    this.load();
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      sequence: this.api.getSequence(this.sequenceId()),
      missions: this.missionsApi.list(),
      timing: this.api.missionTiming(this.sequenceId()),
      teams: this.teamsApi.list(),
    }).subscribe({
      next: (r) => {
        this.sequence.set(r.sequence);
        this.missions.set(r.missions);
        this.timing.set(r.timing);
        this.teams.set(r.teams);
        this.loading.set(false);
      },
      error: (e) => {
        this.fail(e);
        this.loading.set(false);
      },
    });
  }
  phaseOf(id: number) {
    return this.timing().phases.find((p) => p.missionId === id)?.phase ?? null;
  }
  inPhase(phase: EventMissionPhase | null) {
    return this.linked().filter((m) => this.phaseOf(m.id) === phase);
  }
  setPhase(missionId: number, phase: EventMissionPhase) {
    if (!phase || !this.editable() || this.busy()) return;
    this.busy.set(true);
    this.api.setMissionPhase(this.sequenceId(), missionId, phase).subscribe({
      next: (r) => {
        this.timing.set(r);
        this.busy.set(false);
        this.changed.emit();
      },
      error: (e) => this.fail(e),
    });
  }
  add(missionId = this.chosen()) {
    const sequence = this.sequence(),
      phase = this.addPhase();
    if (!sequence || !missionId || !phase || this.busy() || !this.editable()) return;
    this.busy.set(true);
    this.error.set('');
    this.api
      .updateSequence(sequence.id, {
        missionIds: [...new Set([...sequence.missionIds, missionId])],
      })
      .subscribe({
        next: () => {
          this.api.setMissionPhase(sequence.id, missionId, phase).subscribe({
            next: () => {
              this.busy.set(false);
              this.chosen.set(null);
              this.addOpen.set(false);
              this.createOpen.set(false);
              this.newTitle.set('');
              this.load();
              this.changed.emit();
            },
            error: (e) => {
              this.fail(e);
              this.load();
            },
          });
        },
        error: (e) => this.fail(e),
      });
  }
  create() {
    if (!this.newTitle().trim() || !this.addPhase() || this.busy() || !this.editable()) return;
    this.busy.set(true);
    this.missionsApi
      .create({
        title: this.newTitle().trim(),
        volunteerTeamId: this.newTeam(),
        location: this.sequence()?.location ?? '',
        status: VolunteerMissionStatus.TODO,
        isOptional: false,
        description: '',
        responsibleVolunteerId: null,
      })
      .subscribe({
        next: (m) => {
          this.missions.update((ms) => [...ms, m]);
          this.chosen.set(m.id);
          this.busy.set(false);
          this.createOpen.set(false);
          this.add(m.id);
        },
        error: (e) => this.fail(e),
      });
  }
  unlink(mission: VolunteerMission) {
    const s = this.sequence();
    if (!s || !this.editable() || this.busy()) return;
    this.busy.set(true);
    this.api
      .updateSequence(s.id, { missionIds: s.missionIds.filter((id) => id !== mission.id) })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.load();
          this.changed.emit();
        },
        error: (e) => this.fail(e),
      });
  }
  configure(mission: VolunteerMission) {
    this.configMission.set(mission);
    this.shifts.set([]);
    this.shiftId.set(null);
    this.resetFields();
    this.busy.set(true);
    this.missionsApi.get(mission.id).subscribe({
      next: (m) => {
        this.shifts.set(m.shifts ?? []);
        this.busy.set(false);
      },
      error: (e) => this.fail(e),
    });
  }
  resetFields() {
    this.preview.set(null);
    this.startAnchor.set('');
    this.endAnchor.set('');
    this.startOffset.set(null);
    this.endOffset.set(null);
    this.pilotConfirmed.set(false);
    this.removeShift.set(null);
  }
  selectShift(id: number | null) {
    this.shiftId.set(id);
    this.resetFields();
    const b = this.currentBinding();
    if (b) {
      this.startAnchor.set(b.startAnchor);
      this.endAnchor.set(b.endAnchor);
      this.startOffset.set(b.startOffset);
      this.endOffset.set(b.endOffset);
    }
  }
  draft(): EventShiftBindingDraft | null {
    const shiftId = this.shiftId(),
      startAnchor = this.startAnchor(),
      endAnchor = this.endAnchor(),
      startOffset = this.startOffset(),
      endOffset = this.endOffset(),
      b = this.currentBinding();
    if (!shiftId || !startAnchor || !endAnchor || startOffset === null || endOffset === null)
      return null;
    if (b && b.sequenceId !== this.sequenceId() && !this.pilotConfirmed()) return null;
    return {
      shiftId,
      startAnchor,
      endAnchor,
      startOffset,
      endOffset,
      previousSequenceId: b?.sequenceId ?? null,
    };
  }
  previewTiming() {
    const draft = this.draft();
    if (!draft || !this.editable() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api.previewBinding(this.sequenceId(), draft).subscribe({
      next: (r) => {
        this.preview.set(r);
        this.busy.set(false);
      },
      error: (e) => this.fail(e),
    });
  }
  applyTiming() {
    const draft = this.draft(),
      p = this.preview();
    if (!draft || !p || p.conflicts.length || this.busy() || !this.editable()) return;
    this.busy.set(true);
    this.api.applyBinding(this.sequenceId(), draft, p.version).subscribe({
      next: () => {
        this.busy.set(false);
        this.configMission.set(null);
        this.load();
        this.changed.emit();
      },
      error: (e) => {
        this.preview.set(null);
        this.fail(e);
      },
    });
  }
  detach() {
    const b = this.currentBinding();
    if (
      !b ||
      this.removeShift() !== b.shiftId ||
      b.sequenceId !== this.sequenceId() ||
      this.busy() ||
      !this.editable()
    )
      return;
    this.busy.set(true);
    this.api.removeBinding(this.sequenceId(), b.shiftId).subscribe({
      next: () => {
        this.busy.set(false);
        this.configMission.set(null);
        this.load();
        this.changed.emit();
      },
      error: (e) => this.fail(e),
    });
  }
  fail(e: unknown) {
    this.busy.set(false);
    const error = e as { error?: { message?: string } };
    this.error.set(
      error.error?.message ?? 'Impossible de terminer cette action. Vos saisies sont conservées.',
    );
  }
  date(value: string) {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
