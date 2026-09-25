import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { form, required, email, validate, requiredError, submit, FormField } from '@angular/forms/signals';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig, resolveRegistrationLink } from '../../core/config/event.config';
import { volunteerMissions } from '../../core/content/volunteer-missions.content';
import { RegistrationApiService } from '../../core/api/registration-api.service';

@Component({
  selector: 'app-inscription-benevoles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, FormField],
  templateUrl: './inscription-benevoles.html',
})
export class InscriptionBenevoles implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly registrationApi = inject(RegistrationApiService);

  protected readonly missions = volunteerMissions;
  protected readonly registrationLink = resolveRegistrationLink(eventConfig.registrationLinks.volunteers);
  protected readonly contactEmail = eventConfig.contacts.volunteers;

  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');
  protected readonly submitted = signal(false);

  protected readonly model = signal({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    missionsOfInterest: [] as string[],
    availability: '',
    motivation: '',
    consent: false,
    honeypot: '',
  });

  protected readonly applicationForm = form(this.model, (p) => {
    required(p.firstName, { message: 'Le prénom est obligatoire.' });
    required(p.lastName, { message: 'Le nom est obligatoire.' });
    required(p.email, { message: 'L’adresse e-mail est obligatoire.' });
    email(p.email, { message: 'Merci de saisir une adresse e-mail valide.' });
    required(p.phone, { message: 'Le numéro de téléphone est obligatoire.' });
    validate(p.consent, ({ value }) =>
      value() ? undefined : requiredError({ message: 'Merci d’accepter les conditions pour continuer.' }),
    );
  });

  ngOnInit(): void {
    this.seo.apply({
      title: 'Inscription des bénévoles',
      description:
        'Étapes, informations à préparer et calendrier prévisionnel pour candidater comme bénévole à Alegria 2027.',
      canonicalPath: '/inscription/benevoles',
    });
  }

  toggleMission(missionId: string, checked: boolean): void {
    this.model.update((m) => ({
      ...m,
      missionsOfInterest: checked
        ? [...m.missionsOfInterest, missionId]
        : m.missionsOfInterest.filter((id) => id !== missionId),
    }));
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    submit(this.applicationForm, async () => {
      this.submitError.set('');
      this.submitting.set(true);
      const m = this.model();
      this.registrationApi
        .submitVolunteerApplication({
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          phone: m.phone,
          missionsOfInterest: m.missionsOfInterest.length > 0 ? m.missionsOfInterest : undefined,
          availability: m.availability || undefined,
          motivation: m.motivation || undefined,
          honeypot: m.honeypot || undefined,
        })
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.submitted.set(true);
          },
          error: () => {
            this.submitting.set(false);
            this.submitError.set(
              "Une erreur est survenue lors de l'envoi de votre candidature. Merci de réessayer dans quelques instants, ou de nous contacter directement si le problème persiste.",
            );
          },
        });
    });
  }
}
