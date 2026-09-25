import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { form, required, applyEach, validate, requiredError, submit, FormField } from '@angular/forms/signals';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig, resolveRegistrationLink } from '../../core/config/event.config';
import { familyJourneySteps } from '../../core/content/participation.content';
import { RegistrationApiService } from '../../core/api/registration-api.service';
import { PARTICIPANT_SEX_OPTIONS, MEJ_AGE_GROUP_OPTIONS } from '../../core/content/registration-options.content';

function emptyChild() {
  return {
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    sex: '' as string,
    mejAgeGroup: '' as string,
    diocese: '',
    city: '',
  };
}

@Component({
  selector: 'app-inscription-familles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, FormField],
  templateUrl: './inscription-familles.html',
})
export class InscriptionFamilles implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly registrationApi = inject(RegistrationApiService);

  protected readonly event = eventConfig;
  protected readonly steps = familyJourneySteps;
  protected readonly registrationLink = resolveRegistrationLink(eventConfig.registrationLinks.families);
  protected readonly contactEmail = eventConfig.contacts.families;
  protected readonly sexOptions = PARTICIPANT_SEX_OPTIONS;
  protected readonly ageGroupOptions = MEJ_AGE_GROUP_OPTIONS;

  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');
  protected readonly submitted = signal(false);

  protected readonly model = signal({
    parentContact: { name: '', phone: '', email: '' },
    children: [emptyChild()],
    consent: false,
    honeypot: '',
  });

  protected readonly registrationForm = form(this.model, (p) => {
    required(p.parentContact.name, { message: 'Le nom du parent ou représentant légal est obligatoire.' });
    required(p.parentContact.phone, { message: 'Un numéro de téléphone de contact est obligatoire.' });
    applyEach(p.children, (child) => {
      required(child.firstName, { message: 'Le prénom est obligatoire.' });
      required(child.lastName, { message: 'Le nom est obligatoire.' });
      required(child.dateOfBirth, { message: 'La date de naissance est obligatoire.' });
      required(child.sex, { message: 'Merci de préciser cette information.' });
      required(child.mejAgeGroup, { message: 'Merci de préciser la tranche d’âge MEJ.' });
    });
    validate(p.consent, ({ value }) =>
      value() ? undefined : requiredError({ message: 'Merci d’accepter les conditions pour continuer.' }),
    );
  });

  ngOnInit(): void {
    this.seo.apply({
      title: 'Inscription des familles',
      description:
        'Toutes les informations pratiques pour les familles souhaitant inscrire un ou plusieurs jeunes à Alegria 2027.',
      canonicalPath: '/inscription/familles',
    });
  }

  addChild(): void {
    this.model.update((m) => ({ ...m, children: [...m.children, emptyChild()] }));
  }

  removeChild(index: number): void {
    this.model.update((m) => ({ ...m, children: m.children.filter((_, i) => i !== index) }));
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    submit(this.registrationForm, async () => {
      this.submitError.set('');
      this.submitting.set(true);
      const m = this.model();
      this.registrationApi
        .submitParticipantRegistration({
          parentContact: {
            name: m.parentContact.name,
            phone: m.parentContact.phone,
            email: m.parentContact.email || undefined,
          },
          participants: m.children.map((child) => ({
            firstName: child.firstName,
            lastName: child.lastName,
            dateOfBirth: child.dateOfBirth,
            sex: child.sex as never,
            mejAgeGroup: child.mejAgeGroup as never,
            diocese: child.diocese || undefined,
            city: child.city || undefined,
          })),
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
