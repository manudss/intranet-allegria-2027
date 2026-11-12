import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiLoader } from '@taiga-ui/core';
import { catchError, forkJoin, of } from 'rxjs';
import { MySpaceApiService } from '../../services/api.services';
import { Teammate, TeamMembership } from '../../models/models';

export interface TeamWithMates {
  membership: TeamMembership;
  teammates: Teammate[];
}

const formatDate = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

@Component({
  selector: 'app-my-teams',
  standalone: true,
  imports: [RouterLink, TuiLoader],
  templateUrl: './my-teams.html',
  styleUrl: './my-teams.scss',
})
export class MyTeamsComponent {
  private readonly api = inject(MySpaceApiService);

  readonly teams = signal<TeamWithMates[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.api
      .getTeamMemberships()
      .pipe(catchError(() => of([] as TeamMembership[])))
      .subscribe((memberships) => {
        if (memberships.length === 0) {
          this.loading.set(false);
          return;
        }
        forkJoin(
          memberships.map((membership) =>
            this.api.getTeammates(membership.id).pipe(catchError(() => of([] as Teammate[]))),
          ),
        ).subscribe((teammates) => {
          this.teams.set(
            memberships.map((membership, index) => ({
              membership,
              teammates: teammates[index],
            })),
          );
          this.loading.set(false);
        });
      });
  }

  period(membership: TeamMembership): string | null {
    if (!membership.startAt) {
      return null;
    }
    const end = membership.endAt ? ` au ${formatDate(membership.endAt)}` : '';
    return `Du ${formatDate(membership.startAt)}${end}`;
  }

  initials(teammate: Teammate): string {
    return `${teammate.volunteer.firstName[0] ?? ''}${teammate.volunteer.lastName[0] ?? ''}`;
  }
}
