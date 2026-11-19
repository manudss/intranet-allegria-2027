import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgramChangeLogEntry } from '../../../models/models';
import { ProgramApiService } from '../../../services/api.services';
import { SHARED_IMPORTS } from '../../../shared/shared-imports';
import { PROGRAM_CHANGE_LOG_LABELS, PROGRAM_EVENT_DAYS } from '../schedule-chain.util';

/**
 * Page dédiée du journal des modifications du programme (phase 3 de la refonte planning) :
 * le bouton « Journal (n) » de la barre d'outils y mène au lieu d'ouvrir un panneau latéral.
 */
@Component({
  selector: 'app-programme-journal',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink, DatePipe],
  templateUrl: './programme-journal.html',
  styleUrl: './programme-journal.scss',
})
export class ProgrammeJournalPage {
  private readonly api = inject(ProgramApiService);

  readonly days = PROGRAM_EVENT_DAYS;
  readonly labels = PROGRAM_CHANGE_LOG_LABELS;

  /** Filtre par jour : null = tous les jours. */
  readonly dayFilter = signal<number | null>(null);
  readonly entries = signal<ProgramChangeLogEntry[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  readonly filtered = computed(() => {
    const filter = this.dayFilter();
    const all = this.entries();
    if (filter === null) return all;
    return all.filter((entry) => entry.eventDate === this.days[filter]);
  });

  dayCount(dayIndex: number): number {
    const date = this.days[dayIndex];
    return this.entries().filter((entry) => entry.eventDate === date).length;
  }

  setDayFilter(dayIndex: number | null): void {
    this.dayFilter.set(dayIndex);
  }

  constructor() {
    this.api.getChangeLog().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }
}
