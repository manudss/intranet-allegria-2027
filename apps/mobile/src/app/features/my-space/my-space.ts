import { Component, computed, inject, signal } from '@angular/core';
import { TuiLoader } from '@taiga-ui/core';
import { catchError, of } from 'rxjs';
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
  imports: [TuiLoader],
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

  readonly missions = computed<ShiftAssignment[]>(() =>
    [...this.assignments()]
      .filter((a) => a.status !== 'CANCELLED')
      .sort((a, b) => a.shift.startAt.localeCompare(b.shift.startAt)),
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

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  shiftTime(assignment: ShiftAssignment): string {
    return `${time(assignment.shift.startAt)} - ${time(assignment.shift.endAt)}`;
  }

  shiftDay(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
}
