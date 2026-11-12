import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiLoader } from '@taiga-ui/core';
import { catchError, of } from 'rxjs';
import {
  PublicProgramDay,
  StaticContentService,
} from '../../../services/static-content.service';
import { dayLabel, defaultDay } from '../../../core/event-dates';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [RouterLink, TuiLoader],
  templateUrl: './public-home.html',
  styleUrl: './public-home.scss',
})
export class PublicHomeComponent {
  private readonly content = inject(StaticContentService);

  readonly day = signal<PublicProgramDay | null>(null);
  readonly loading = signal(true);
  readonly date = defaultDay();
  readonly dateLabel = dayLabel(this.date);

  readonly upcoming = computed(() =>
    [...(this.day()?.sequences ?? [])].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    ),
  );

  constructor() {
    this.content
      .getPublicProgramDay(this.date)
      .pipe(catchError(() => of(null)))
      .subscribe((day) => {
        this.day.set(day);
        this.loading.set(false);
      });
  }
}
