import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiLoader } from '@taiga-ui/core';
import { catchError, of } from 'rxjs';
import { MySpaceApiService } from '../../services/api.services';
import { Volunteer, VolunteerHosting } from '../../models/models';

const SKILL_LABELS: Record<string, string> = {
  SECURITY: 'Sécurité',
  ANIMATION: 'Animation',
  LITURGY: 'Liturgie',
  LOGISTICS: 'Logistique',
  HEALTH: 'Santé',
  RECEPTION: 'Accueil',
  TRANSPORT: 'Transport',
  ACCOMMODATION: 'Hébergement',
  COMMUNICATION: 'Communication',
  CATERING: 'Restauration',
  CLEANING: 'Entretien',
  MISCELLANEOUS: 'Divers',
  OTHER: 'Autre',
};

const formatDate = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [RouterLink, TuiLoader],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.scss',
})
export class MyProfileComponent {
  private readonly api = inject(MySpaceApiService);

  readonly volunteer = signal<Volunteer | null>(null);
  readonly hosting = signal<VolunteerHosting | null>(null);
  readonly loading = signal(true);
  readonly noProfile = signal(false);

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal(false);
  readonly editPhone = signal('');
  readonly editEmail = signal('');

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
        if (volunteer) {
          this.api
            .getHosting()
            .pipe(catchError(() => of(null)))
            .subscribe((hosting) => this.hosting.set(hosting));
        }
        this.loading.set(false);
      });
  }

  skillLabel(skill: string): string {
    return SKILL_LABELS[skill] ?? skill;
  }

  animatorLabel(animator: { firstName: string; lastName: string; role: string }): string {
    const suffix = animator.role === 'PRIMARY' ? 'animateur référent' : 'animateur';
    return `${animator.firstName} ${animator.lastName} (${suffix})`;
  }

  hostingPeriod(hosting: VolunteerHosting): string | null {
    if (!hosting.startAt) {
      return null;
    }
    const end = hosting.endAt ? ` au ${formatDate(hosting.endAt)}` : '';
    return `Du ${formatDate(hosting.startAt)}${end}`;
  }

  startEdit(): void {
    const volunteer = this.volunteer();
    if (!volunteer) {
      return;
    }
    this.editPhone.set(volunteer.phone ?? '');
    this.editEmail.set(volunteer.email ?? '');
    this.saveError.set(false);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.saveError.set(false);
  }

  onPhoneInput(event: Event): void {
    this.editPhone.set((event.target as HTMLInputElement).value);
  }

  onEmailInput(event: Event): void {
    this.editEmail.set((event.target as HTMLInputElement).value);
  }

  save(): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(false);
    this.api
      .updateVolunteer({
        phone: this.editPhone().trim() || null,
        email: this.editEmail().trim() || null,
      })
      .pipe(
        catchError(() => {
          this.saveError.set(true);
          this.saving.set(false);
          return of(null);
        }),
      )
      .subscribe((volunteer) => {
        this.saving.set(false);
        if (volunteer) {
          this.volunteer.set(volunteer);
          this.editing.set(false);
        }
      });
  }
}
