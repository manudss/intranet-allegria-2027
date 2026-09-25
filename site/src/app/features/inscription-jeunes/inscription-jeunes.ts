import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { form, required, validate, requiredError, submit, FormField } from '@angular/forms/signals';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig, resolveRegistrationLink } from '../../core/config/event.config';
import { familyJourneySteps } from '../../core/content/participation.content';
import { RegistrationApiService } from '../../core/api/registration-api.service';
import { PARTICIPANT_SEX_OPTIONS, MEJ_AGE_GROUP_OPTIONS } from '../../core/content/registration-options.content';

@Component({
  selector: 'app-inscription-jeunes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, FormField],
  templateUrl: './inscription-jeunes.html',
})
export class InscriptionJeunes implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly registrationApi = inject(RegistrationApiService);

  protected readonly event = eventConfig;
  protected readonly steps = familyJourneySteps;
  protected readonly registrationLink = resolveRegistrationLink(eventConfig.registrationLinks.youngPeople);
  protected readonly contactEmail = eventConfig.contacts.families;
  protected readonly sexOptions = PARTICIPANT_SEX_OPTIONS;
  protected readonly ageGroupOptions = MEJ_AGE_GROUP_OPTIONS;

  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');
  protected readonly submitted = signal(false);

  protected readonly model = signal({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    sex: '' as string,
    mejAgeGroup: '' as string,
    diocese: '',
    city: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    consent: false,
    honeypot: '',
  });

  protected readonly registrationForm = form(this.model, (p) => {
    required(p.firstName, { message: 'Le prénom est obligatoire.' });
    required(p.lastName, { message: 'Le nom est obligatoire.' });
    required(p.dateOfBirth, { message: 'La date de naissance est obligatoire.' });
    required(p.sex, { message: 'Merci de préciser cette information.' });
    required(p.mejAgeGroup, { message: 'Merci de préciser la tranche d’âge MEJ.' });
    required(p.emergencyContactName, { message: 'Le nom d’un contact en cas d’urgence est obligatoire.' });
    required(p.emergencyContactPhone, {
      message: 'Un numéro de téléphone de contact en cas d’urgence est obligatoire.',
    });
    validate(p.consent, ({ value }) =>
      value() ? undefined : requiredError({ message: 'Merci d’accepter les conditions pour continuer.' }),
    );
  });

  ngOnInit(): void {
    this.seo.apply({
      title: 'Inscription des jeunes',
      description:
        'Tout savoir pour inscrire un jeune de 12 à 18 ans à Alegria 2027 : conditions, étapes, informations pratiques.',
      canonicalPath: '/inscription/jeunes',
    });
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    submit(this.registrationForm, async () => {
      this.submitError.set('');
      this.submitting.set(true);
      const m = this.model();
      this.registrationApi
        .submitParticipantRegistration({
          participants: [
            {
              firstName: m.firstName,
              lastName: m.lastName,
              dateOfBirth: m.dateOfBirth,
              sex: m.sex as never,
              mejAgeGroup: m.mejAgeGroup as never,
              diocese: m.diocese || undefined,
              city: m.city || undefined,
              emergencyContactName: m.emergencyContactName,
              emergencyContactPhone: m.emergencyContactPhone,
            },
          ],
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
              "Une erreur est survenue lors de l'envoi de votre inscription. Merci de réessayer dans quelques instants, ou de nous contacter directement si le problème persiste.",
            );
          },
        });
    });
  }
}
