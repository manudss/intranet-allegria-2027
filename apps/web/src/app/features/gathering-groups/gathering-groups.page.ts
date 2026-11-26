import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { ALLEGRIA_2027_EVENT_DATES } from '../../shared/event-date-selector/event-date.config';
import { ProgramApiService } from '../../services/api.services';
import { GatheringGroupsApiService } from './gathering-groups.api';
import {
  CATEGORY_LABELS,
  GatheringRepartition,
} from './gathering-groups.models';

type Notice = { kind: 'error' | 'info'; text: string };

/** Quatre jours du rassemblement (J1 à J4), dérivés des dates configurées. */
function eventDays(): { date: string; label: string }[] {
  const start = new Date(`${ALLEGRIA_2027_EVENT_DATES.startDate}T12:00:00`);
  return [0, 1, 2, 3].map((offset) => {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
      day.getDate(),
    ).padStart(2, '0')}`;
    return { date: iso, label: `J${offset + 1} · ${iso.split('-').reverse().slice(0, 2).join('/')}` };
  });
}

@Component({
  selector: 'app-gathering-groups',
  standalone: true,
  imports: [...SHARED_IMPORTS, SelectFieldComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gathering-groups.page.html',
  styleUrl: './gathering-groups.page.scss',
})
export class GatheringGroupsPage implements OnInit {
  private readonly api = inject(GatheringGroupsApiService);
  private readonly program = inject(ProgramApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly days = eventDays();
  protected readonly selectedDate = signal(this.days[0].date);
  protected readonly repartitions = signal<GatheringRepartition[]>([]);
  /** Événements du jour choisi (pour rattacher une nouvelle répartition). */
  protected readonly sequences = signal<{ id: number; title: string; startTime: string }[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly notice = signal<Notice | null>(null);
  protected readonly newName = signal('');
  protected readonly newSequenceId = signal<number>(0);
  protected readonly categoryLabels = CATEGORY_LABELS;

  /** Répartitions liées à un événement du jour, triées par horaire. */
  protected readonly eventRepartitions = computed(() =>
    this.repartitions()
      .filter((r) => r.sequence && r.sequence.eventDate === this.selectedDate())
      .sort((a, b) => (a.sequence!.startTime < b.sequence!.startTime ? -1 : 1)),
  );
  /** Répartitions autonomes, sans événement. */
  protected readonly autonomousRepartitions = computed(() =>
    this.repartitions().filter((r) => !r.sequence),
  );

  protected readonly sequenceOptions = computed<SelectOption<number>[]>(() => [
    { value: 0, label: 'Sans événement (répartition autonome)' },
    ...this.sequences().map((s) => ({
      value: s.id,
      label: `${s.startTime} · ${s.title}`,
    })),
  ]);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    forkJoin([
      this.api.list(this.selectedDate()),
      this.program.getDay(this.selectedDate()),
    ]).subscribe({
      next: ([repartitions, day]) => {
        this.repartitions.set(repartitions);
        this.sequences.set(
          day.sequences.map((s) => ({ id: s.id, title: s.title, startTime: s.startTime })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.notice.set({ kind: 'error', text: 'Chargement impossible. Réessayez.' });
        this.loading.set(false);
      },
    });
  }

  protected selectDate(date: string): void {
    this.selectedDate.set(date);
    this.load();
  }

  protected createRepartition(): void {
    const name = this.newName().trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    const sequenceId = this.newSequenceId() || null;
    this.api.createRepartition({ name, programSequenceId: sequenceId }).subscribe({
      next: () => {
        this.newName.set('');
        this.newSequenceId.set(0);
        this.busy.set(false);
        this.notice.set({ kind: 'info', text: `Répartition « ${name} » créée.` });
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.notice.set({ kind: 'error', text: this.readError(err, 'Création impossible.') });
      },
    });
  }

  protected duplicate(repartition: GatheringRepartition): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.duplicateRepartition(repartition.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notice.set({
          kind: 'info',
          text: `Répartition dupliquée (structure seule, sans les affectations).`,
        });
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.notice.set({ kind: 'error', text: this.readError(err, 'Duplication impossible.') });
      },
    });
  }

  protected toggleOverflow(repartition: GatheringRepartition): void {
    const target = !repartition.allowOverflow;
    const action = () =>
      this.api.setOverflow(repartition.id, target).subscribe({
        next: () => {
          this.notice.set({
            kind: 'info',
            text: target
              ? `Dérogation activée sur « ${repartition.name} » : les dépassements sont possibles.`
              : `Dépassement à nouveau bloquant sur « ${repartition.name} ».`,
          });
          this.load();
        },
        error: (err) =>
          this.notice.set({ kind: 'error', text: this.readError(err, 'Réglage impossible.') }),
      });
    if (target) {
      this.confirmDialog
        .ask({
          title: 'Activer la dérogation',
          message: `Autoriser les dépassements de capacité sur « ${repartition.name} » ? Cette dérogation reste visible sur la page.`,
          yes: 'Activer',
        })
        .subscribe((ok) => ok && action());
    } else {
      action();
    }
  }

  protected removeRepartition(repartition: GatheringRepartition): void {
    this.confirmDialog
      .askDelete(
        `la répartition « ${repartition.name} »`,
        `Ses ${repartition.groups.length} groupes et leurs affectations seront supprimés.`,
      )
      .subscribe((ok) => {
        if (!ok) return;
        this.api.removeRepartition(repartition.id).subscribe({
          next: () => {
            this.notice.set({ kind: 'info', text: `Répartition « ${repartition.name} » supprimée.` });
            this.load();
          },
          error: (err) =>
            this.notice.set({ kind: 'error', text: this.readError(err, 'Suppression impossible.') }),
        });
      });
  }

  protected gaugeRatio(group: { persons: number; capacity: number | null }): number {
    if (!group.capacity) return 0;
    return Math.min(1, group.persons / group.capacity);
  }

  private readError(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: string | string[] } })?.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || fallback;
  }
}
