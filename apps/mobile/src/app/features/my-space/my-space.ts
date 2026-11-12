import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiLoader } from '@taiga-ui/core';
import { catchError, of } from 'rxjs';
import { dayLabel, defaultDay, eventDays } from '../../core/event-dates';
import { MySpaceApiService } from '../../services/api.services';
import { ShiftAssignment, TeamMembership, Volunteer } from '../../models/models';

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmé',
  PROVISIONAL: 'Prévisionnel',
  CANCELLED: 'Annulé',
};

const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

@Component({
  selector: 'app-my-space',
  standalone: true,
  imports: [RouterLink, TuiLoader],
  templateUrl: './my-space.html',
  styleUrl: './my-space.scss',
})
export class MySpaceComponent {
  private readonly api = inject(MySpaceApiService);

  readonly volunteer = signal<Volunteer | null>(null);
  readonly assignments = signal<ShiftAssignment[]>([]);
  readonly memberships = signal<TeamMembership[]>([]);
  readonly loading = signal(true);
  readonly noProfile = signal(false);

  readonly days = eventDays();
  readonly selectedDay = signal(defaultDay());

  readonly missions = computed<ShiftAssignment[]>(() =>
    [...this.assignments()]
      .filter((a) => a.status !== 'CANCELLED')
      .sort((a, b) => a.shift.startAt.localeCompare(b.shift.startAt)),
  );

  readonly dayAssignments = computed<ShiftAssignment[]>(() =>
    this.missions().filter((a) => a.shift.startAt.startsWith(this.selectedDay())),
  );

  readonly provisionalCount = computed(
    () => this.missions().filter((a) => a.status === 'PROVISIONAL').length,
  );

  readonly nextAssignment = computed<ShiftAssignment | null>(() => {
    const now = new Date().toISOString();
    return this.missions().find((a) => a.shift.endAt >= now) ?? this.missions()[0] ?? null;
  });

  readonly teamNames = computed(() =>
    this.memberships().map((membership) => membership.volunteerTeam.name),
  );

  constructor() {
    this.api
      .getVolunteer()
      .pipe(
        catchError(() => {
          this.noProfile.set(true);
          return of(null);
        }),
      )
      .subscribe((volunteer) => {
        this.volunteer.set(volunteer);
        if (!volunteer) {
          this.loading.set(false);
          return;
        }
        this.api
          .getShiftAssignments()
          .pipe(catchError(() => of([])))
          .subscribe((assignments) => this.assignments.set(assignments));
        this.api
          .getTeamMemberships()
          .pipe(catchError(() => of([])))
          .subscribe((memberships) => this.memberships.set(memberships));
        this.loading.set(false);
      });
  }

  selectDay(day: string): void {
    this.selectedDay.set(day);
  }

  dayLabel(day: string): string {
    return dayLabel(day);
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  shiftTime(assignment: ShiftAssignment): string {
    return `${time(assignment.shift.startAt)} - ${time(assignment.shift.endAt)}`;
  }

  timeShort(iso: string): string {
    return time(iso);
  }

  shiftDayLong(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  responsible(assignment: ShiftAssignment): string | null {
    const person = assignment.shift.mission.responsibleVolunteer;
    return person ? `${person.firstName} ${person.lastName}` : null;
  }
}
