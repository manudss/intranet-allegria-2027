import {
  ChangeDetectionStrategy,
  Injector,
  afterNextRender,
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  form,
  required,
  email,
  maxLength,
  min,
  max,
  validate,
  requiredError,
  submit,
  FormField,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig } from '../../core/config/event.config';
import { familyJourneySteps } from '../../core/content/participation.content';
import { RegistrationApiService } from '../../core/api/registration-api.service';

@Component({
  selector: 'app-inscription-familles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS, FormField],
  templateUrl: './inscription-familles.html',
  styles: `
    .form-grid {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    }
    .form-field,
    .form-fieldset {
      min-width: 0;
    }
    .form-control {
      min-width: 0;
      max-width: 100%;
      border-color: var(--color-text-muted);
    }
    .form-legend,
    .form-error {
      color: var(--color-text);
    }
    a {
      color: inherit;
      text-decoration: underline;
    }
    :focus-visible {
      outline: 3px solid currentColor;
      outline-offset: 3px;
    }
    .form-error-link {
      font: inherit;
      color: inherit;
      background: transparent;
      border: 0;
      min-height: 44px;
      text-align: left;
      text-decoration: underline;
      cursor: pointer;
    }
    [tabindex='-1'],
    .form-control {
      scroll-margin-top: 8rem;
    }
  `,
})
export class InscriptionFamilles implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly registrationApi = inject(RegistrationApiService);
  private readonly injector = inject(Injector);
  private readonly errorSummary = viewChild<ElementRef<HTMLElement>>('errorSummary');
  private readonly confirmation = viewChild<ElementRef<HTMLElement>>('confirmation');

  protected readonly event = eventConfig;
  protected readonly steps = familyJourneySteps;
  protected readonly contactEmail = eventConfig.contacts.families;
  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');
  protected readonly submitted = signal(false);
  protected readonly attempted = signal(false);

  protected readonly model = signal({
    familyName: '',
    phone: '',
    email: '',
    address: '',
    postalCode: '',
    city: '',
    maxCapacity: Number.NaN,
    maxUnder18: Number.NaN,
    maxAnimators: Number.NaN,
    parish: '',
    constraints: '',
    notes: '',
    consent: false,
    honeypot: '',
  });

  protected readonly registrationForm = form(this.model, (p) => {
    for (const [path, limit] of [
      [p.familyName, 160],
      [p.phone, 40],
      [p.email, 255],
      [p.address, 255],
      [p.postalCode, 20],
      [p.city, 120],
    ] as const) {
      required(path, { message: 'Veuillez renseigner ce champ.' });
      validate(path, ({ value }) =>
        value().trim() ? undefined : requiredError({ message: 'Veuillez renseigner ce champ.' }),
      );
      maxLength(path, limit, { message: `Saisissez au maximum ${limit} caractères.` });
    }
    email(p.email, { message: 'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.' });
    for (const path of [p.maxCapacity, p.maxUnder18, p.maxAnimators]) {
      validate(path, ({ value }) => {
        const count = value();
        if (path === p.maxAnimators && Number.isNaN(count)) return undefined;
        return Number.isInteger(count)
          ? undefined
          : { kind: 'integer', message: 'Saisissez un nombre entier.' };
      });
    }
    required(p.maxCapacity, { message: 'Indiquez votre capacité totale.' });
    required(p.maxUnder18, { message: 'Indiquez le nombre maximal de mineurs (0 si aucun).' });
    min(p.maxCapacity, 1, { message: 'La capacité totale doit être au moins égale à 1.' });
    max(p.maxCapacity, 2147483647, { message: 'La capacité totale est trop élevée.' });
    for (const path of [p.maxUnder18, p.maxAnimators]) {
      min(path, 0, { message: 'Saisissez un nombre supérieur ou égal à 0.' });
      max(path, ({ valueOf }) => valueOf(p.maxCapacity), {
        message: 'Ce nombre ne peut pas dépasser la capacité totale.',
      });
    }
    maxLength(p.parish, 120, { message: 'Saisissez au maximum 120 caractères.' });
    maxLength(p.notes, 2000, { message: 'Saisissez au maximum 2 000 caractères.' });
    validate(p.constraints, ({ value }) => {
      const lines = this.constraintLines(value());
      return lines.length > 20 || lines.some((line) => line.length > 255)
        ? {
            kind: 'constraints',
            message: 'Indiquez au maximum 20 contraintes de 255 caractères chacune, une par ligne.',
          }
        : undefined;
    });
    required(p.consent, { message: 'Votre accord est nécessaire pour envoyer la proposition.' });
    validate(p.consent, ({ value }) =>
      value()
        ? undefined
        : requiredError({ message: 'Votre accord est nécessaire pour envoyer la proposition.' }),
    );
  });

  protected readonly errorFields = [
    {
      label: 'Nom de la famille ou de la personne référente',
      field: this.registrationForm.familyName,
    },
    { label: 'Téléphone', field: this.registrationForm.phone },
    { label: 'E-mail', field: this.registrationForm.email },
    { label: 'Adresse', field: this.registrationForm.address },
    { label: 'Code postal', field: this.registrationForm.postalCode },
    { label: 'Ville', field: this.registrationForm.city },
    { label: 'Capacité totale', field: this.registrationForm.maxCapacity },
    { label: 'Nombre maximal de mineurs', field: this.registrationForm.maxUnder18 },
    { label: 'Nombre maximal d’animateurs', field: this.registrationForm.maxAnimators },
    { label: 'Paroisse', field: this.registrationForm.parish },
    { label: 'Contraintes', field: this.registrationForm.constraints },
    { label: 'Remarques', field: this.registrationForm.notes },
    { label: 'Accord pour transmettre la proposition', field: this.registrationForm.consent },
  ];

  private constraintLines(value: string): string[] {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  ngOnInit(): void {
    this.seo.apply({
      title: 'Devenir famille d’accueil',
      description:
        'Proposez d’accueillir des jeunes pendant Alegria 2027. Renseignez vos coordonnées et vos possibilités d’hébergement pour la coordination.',
      canonicalPath: '/inscription/familles',
    });
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting() || this.submitted()) return;
    this.attempted.set(true);
    this.submitError.set('');
    await submit(this.registrationForm, async () => {
      this.submitting.set(true);
      const m = this.model();
      try {
        await firstValueFrom(
          this.registrationApi.submitHostFamilyRegistration({
            familyName: m.familyName.trim(),
            phone: m.phone.trim(),
            email: m.email.trim(),
            address: m.address.trim(),
            postalCode: m.postalCode.trim(),
            city: m.city.trim(),
            maxCapacity: m.maxCapacity,
            maxUnder18: m.maxUnder18,
            maxAnimators: Number.isNaN(m.maxAnimators) ? undefined : m.maxAnimators,
            parish: m.parish.trim() || undefined,
            constraints: this.constraintLines(m.constraints),
            notes: m.notes.trim() || undefined,
            honeypot: m.honeypot || undefined,
          }),
        );
        this.submitted.set(true);
      } catch (error) {
        this.submitError.set(
          error instanceof HttpErrorResponse && error.status === 429
            ? 'Trop de demandes ont été envoyées. Patientez dix minutes avant de réessayer.'
            : 'Votre proposition n’a pas pu être envoyée. Vos informations sont conservées dans le formulaire. Réessayez ou contactez l’organisation.',
        );
      } finally {
        this.submitting.set(false);
      }
    });
    afterNextRender(
      () => {
        if (this.submitted()) this.confirmation()?.nativeElement.focus();
        else if (this.registrationForm().invalid() || this.submitError())
          this.errorSummary()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }
}
