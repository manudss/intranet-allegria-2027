import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig } from '../../core/config/event.config';
import { youthJourneySteps } from '../../core/content/participation.content';
@Component({
  selector: 'app-inscription-jeunes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SHARED_IMPORTS],
  templateUrl: './inscription-jeunes.html',
})
export class InscriptionJeunes implements OnInit {
  private readonly seo = inject(SeoService);
  protected readonly steps = youthJourneySteps;
  protected readonly contactEmail = eventConfig.contacts.families;
  ngOnInit() {
    this.seo.apply({
      title: 'Inscription des jeunes',
      description:
        'Un espace famille pour compléter et suivre les inscriptions des jeunes à Alegria 2027.',
      canonicalPath: '/inscription/jeunes',
    });
  }
}
