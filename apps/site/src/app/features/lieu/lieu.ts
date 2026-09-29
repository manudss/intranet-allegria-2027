import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig } from '../../core/config/event.config';

@Component({
  selector: 'app-lieu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './lieu.html',
})
export class Lieu implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly event = eventConfig;

  ngOnInit(): void {
    this.seo.apply({
      title: 'Lieu et accès',
      description:
        'Le Centre de Congrès de Saint-Étienne accueille Alegria 2027 : adresse, accès en train, transports en commun, vélo et voiture.',
      canonicalPath: '/lieu',
    });
  }
}
