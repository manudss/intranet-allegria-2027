import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig, resolveRegistrationLink } from '../../core/config/event.config';
import { familyJourneySteps } from '../../core/content/participation.content';

@Component({
  selector: 'app-inscription-familles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './inscription-familles.html',
})
export class InscriptionFamilles implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly event = eventConfig;
  protected readonly steps = familyJourneySteps;
  protected readonly registrationLink = resolveRegistrationLink(eventConfig.registrationLinks.families);
  protected readonly contactEmail = eventConfig.contacts.families;

  ngOnInit(): void {
    this.seo.apply({
      title: 'Inscription des familles',
      description:
        'Toutes les informations pratiques pour les familles souhaitant inscrire un ou plusieurs jeunes à Alegria 2027.',
      canonicalPath: '/inscription/familles',
    });
  }
}
