import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig } from '../../core/config/event.config';
import { eventQuote, eventValues, previousEditionFigures } from '../../core/content/participation.content';

@Component({
  selector: 'app-event',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './event.html',
})
export class EventPage implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly event = eventConfig;
  protected readonly values = eventValues;
  protected readonly figures = previousEditionFigures;
  protected readonly quote = eventQuote;

  ngOnInit(): void {
    this.seo.apply({
      title: 'L’événement',
      description:
        'Découvrez ce qu’est Alegria 2027, pourquoi le MEJ organise ce rassemblement national et l’esprit qui l’anime.',
      canonicalPath: '/evenement',
    });
  }
}
