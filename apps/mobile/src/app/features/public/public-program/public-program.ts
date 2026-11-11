import { Component, computed, inject, signal } from '@angular/core';
import { TuiLoader } from '@taiga-ui/core';
import { catchError, of } from 'rxjs';
import {
  PublicProgramDay,
  StaticContentService,
} from '../../../services/static-content.service';
import { dayLabel, defaultDay, eventDays } from '../../../core/event-dates';

@Component({
  selector: 'app-public-program',
  standalone: true,
  imports: [TuiLoader],
  templateUrl: './public-program.html',
  styleUrl: './public-program.scss',
})
export class PublicProgramComponent {
  private readonly content = inject(StaticContentService);

  readonly days = eventDays();
  readonly dayLabel = dayLabel;
  readonly selectedDay = signal(defaultDay());
  readonly day = signal<PublicProgramDay | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  readonly sequences = computed(() =>
    [...(this.day()?.sequences ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime)),
  );

  constructor() {
    this.loadDay(this.selectedDay());
  }

  selectDay(day: string) {
    if (day === this.selectedDay()) return;
    this.selectedDay.set(day);
    this.loadDay(day);
  }

  private loadDay(date: string) {
    this.loading.set(true);
    this.failed.set(false);
    this.content
      .getPublicProgramDay(date)
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
  }
}
