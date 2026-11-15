import { Component, computed, inject, signal } from '@angular/core';
import { TuiLoader } from '@taiga-ui/core';
import { catchError, of } from 'rxjs';
import { ProgramApiService } from '../../services/api.services';
import {
  ProgramDay,
  ProgramSequence,
  ProgramSequenceStatus,
  ProgramSequenceTrack,
} from '../../models/models';
import { dayLabel, defaultDay, eventDays } from '../../core/event-dates';

@Component({
  selector: 'app-program',
  standalone: true,
  imports: [TuiLoader],
  templateUrl: './program.html',
  styleUrl: './program.scss',
})
export class ProgramComponent {
  private readonly programApi = inject(ProgramApiService);

  readonly days = eventDays();
  readonly dayLabel = dayLabel;
  readonly status = ProgramSequenceStatus;

  readonly selectedDay = signal(defaultDay());
  readonly day = signal<ProgramDay | null>(null);
  readonly changeCount = signal(0);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly locationFilter = signal<string | null>(null);
  readonly trackFilter = signal<'ALL' | ProgramSequenceTrack>('ALL');
  readonly trackOptions: { value: 'ALL' | ProgramSequenceTrack; label: string }[] = [
    { value: 'ALL', label: 'Tous' },
    { value: ProgramSequenceTrack.TA, label: 'TA' },
    { value: ProgramSequenceTrack.ES, label: 'ES' },
    { value: ProgramSequenceTrack.COMMON, label: 'Communs' },
  ];

  /** Couleurs de branche, identiques à l'impression des badges. */
  trackColor(track: ProgramSequenceTrack): string {
    if (track === ProgramSequenceTrack.TA) return '#fe0002';
    if (track === ProgramSequenceTrack.ES) return '#00b2b2';
    return '#6b5f52';
  }

  /** Logos de branche ; les temps communs portent les deux. */
  trackLogos(track: ProgramSequenceTrack): string[] {
    if (track === ProgramSequenceTrack.TA) return ['/assets/branches/ta.jpg'];
    if (track === ProgramSequenceTrack.ES) return ['/assets/branches/es.jpg'];
    return ['/assets/branches/ta.jpg', '/assets/branches/es.jpg'];
  }

  setTrackFilter(value: 'ALL' | ProgramSequenceTrack) {
    this.trackFilter.set(value);
  }

  readonly locations = computed<string[]>(() => {
    const all = (this.day()?.sequences ?? []).map((s) => s.location);
    return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'fr'));
  });

  readonly sequences = computed<ProgramSequence[]>(() => {
    const filter = this.locationFilter();
    const track = this.trackFilter();
    return [...(this.day()?.sequences ?? [])]
      .filter((s) => !filter || s.location === filter)
      .filter((s) => track === 'ALL' || (s.track ?? ProgramSequenceTrack.COMMON) === track)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  constructor() {
    this.loadDay(this.selectedDay());
  }

  selectDay(day: string) {
    if (day === this.selectedDay()) return;
    this.selectedDay.set(day);
    this.locationFilter.set(null);
    this.loadDay(day);
  }

  toggleLocation(location: string) {
    this.locationFilter.update((current) => (current === location ? null : location));
  }

  private loadDay(date: string) {
    this.loading.set(true);
    this.failed.set(false);
    this.programApi
      .getDay(date)
      .pipe(
        catchError(() => {
          this.failed.set(true);
          return of(null);
        }),
      )
      .subscribe((day) => {
        this.day.set(day);
        this.loading.set(false);
      });
    this.programApi
      .getChangeLog(date)
      .pipe(catchError(() => of([])))
      .subscribe((entries) => this.changeCount.set(entries.length));
  }
}
