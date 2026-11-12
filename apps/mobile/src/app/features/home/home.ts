import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiLoader } from '@taiga-ui/core';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ProgramApiService } from '../../services/api.services';
import { ProgramDay, ProgramSequence } from '../../models/models';
import { dayLabel, defaultDay } from '../../core/event-dates';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, TuiLoader],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  private readonly auth = inject(AuthService);
  private readonly programApi = inject(ProgramApiService);

  readonly user = this.auth.currentUser;
  readonly day = signal<ProgramDay | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly date = defaultDay();
  readonly dateLabel = dayLabel(this.date);
  readonly changeCount = signal(0);

  /** Séquences du jour triées par heure de début. */
  readonly upcoming = computed<ProgramSequence[]>(() =>
    [...(this.day()?.sequences ?? [])].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    ),
  );

  constructor() {
    this.programApi
      .getDay(this.date)
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
      .getChangeLog(this.date)
      .pipe(catchError(() => of([])))
      .subscribe((entries) => this.changeCount.set(entries.length));
  }

  logout() {
    this.auth.logout();
  }
}
