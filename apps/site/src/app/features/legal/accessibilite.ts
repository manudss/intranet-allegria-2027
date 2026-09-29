import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-accessibilite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './accessibilite.html',
})
export class Accessibilite implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.apply({
      title: 'Accessibilité',
      description: 'Déclaration d’accessibilité du site public Alegria 2027.',
      canonicalPath: '/accessibilite',
    });
  }
}
