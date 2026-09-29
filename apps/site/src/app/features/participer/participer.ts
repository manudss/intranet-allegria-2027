import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { participationProfiles } from '../../core/content/participation.content';

@Component({
  selector: 'app-participer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './participer.html',
})
export class Participer implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly profiles = participationProfiles;

  ngOnInit(): void {
    this.seo.apply({
      title: 'Participer',
      description:
        'Jeune, famille, animateur, bénévole ou responsable diocésain : découvrez comment participer à Alegria 2027.',
      canonicalPath: '/participer',
    });
  }
}
