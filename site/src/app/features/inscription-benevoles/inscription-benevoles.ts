import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig, resolveRegistrationLink } from '../../core/config/event.config';
import { volunteerMissions } from '../../core/content/volunteer-missions.content';

@Component({
  selector: 'app-inscription-benevoles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './inscription-benevoles.html',
})
export class InscriptionBenevoles implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly missions = volunteerMissions;
  protected readonly registrationLink = resolveRegistrationLink(eventConfig.registrationLinks.volunteers);
  protected readonly contactEmail = eventConfig.contacts.volunteers;

  ngOnInit(): void {
    this.seo.apply({
      title: 'Inscription des bénévoles',
      description:
        'Étapes, informations à préparer et calendrier prévisionnel pour candidater comme bénévole à Alegria 2027.',
      canonicalPath: '/inscription/benevoles',
    });
  }
}
