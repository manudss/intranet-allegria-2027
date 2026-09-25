import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig, resolveRegistrationLink } from '../../core/config/event.config';
import { familyJourneySteps } from '../../core/content/participation.content';

@Component({
  selector: 'app-inscription-jeunes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './inscription-jeunes.html',
})
export class InscriptionJeunes implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly event = eventConfig;
  protected readonly steps = familyJourneySteps;
  protected readonly registrationLink = resolveRegistrationLink(eventConfig.registrationLinks.youngPeople);
  protected readonly contactEmail = eventConfig.contacts.families;

  ngOnInit(): void {
    this.seo.apply({
      title: 'Inscription des jeunes',
      description:
        'Tout savoir pour inscrire un jeune de 12 à 18 ans à Alegria 2027 : conditions, étapes, informations pratiques.',
      canonicalPath: '/inscription/jeunes',
    });
  }
}
