import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig, resolveRegistrationLink } from '../../core/config/event.config';
import { volunteerMissions } from '../../core/content/volunteer-missions.content';

@Component({
  selector: 'app-benevoles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './benevoles.html',
})
export class Benevoles implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly missions = volunteerMissions;
  protected readonly registrationLink = resolveRegistrationLink(eventConfig.registrationLinks.volunteers);

  ngOnInit(): void {
    this.seo.apply({
      title: 'Devenir bénévole',
      description:
        'Rejoignez l’équipe de bénévoles et volontaires d’Alegria 2027 : missions, engagement et accompagnement.',
      canonicalPath: '/benevoles',
    });
  }
}
