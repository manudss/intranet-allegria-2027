import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig, resolveRegistrationLink } from '../../core/config/event.config';
import {
  eventValues,
  participationProfiles,
  previousEditionFigures,
} from '../../core/content/participation.content';
import { faqCategories } from '../../core/content/faq.content';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly event = eventConfig;
  protected readonly values = eventValues;
  protected readonly profiles = participationProfiles;
  protected readonly figures = previousEditionFigures;
  protected readonly faqPreview = faqCategories.slice(0, 3);

  protected readonly youngLink = resolveRegistrationLink(eventConfig.registrationLinks.youngPeople);
  protected readonly volunteerLink = resolveRegistrationLink(
    eventConfig.registrationLinks.volunteers,
  );

  ngOnInit(): void {
    this.seo.apply({
      title: 'Accueil',
      description:
        'Alegria 2027 : le rassemblement national du MEJ du 30 octobre au 2 novembre 2027 au Centre de Congrès de Saint-Étienne. Jeunes, familles et bénévoles, découvrez comment participer.',
      canonicalPath: '/',
    });
  }
}
