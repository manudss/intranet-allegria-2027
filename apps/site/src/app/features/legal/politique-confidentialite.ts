import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-politique-confidentialite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './politique-confidentialite.html',
})
export class PolitiqueConfidentialite implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.apply({
      title: 'Politique de confidentialité',
      description: 'Politique de confidentialité et de protection des données du site public Alegria 2027.',
      canonicalPath: '/politique-confidentialite',
      noIndex: true,
    });
  }
}
