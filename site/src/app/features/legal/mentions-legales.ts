import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-mentions-legales',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './mentions-legales.html',
})
export class MentionsLegales implements OnInit {
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.apply({
      title: 'Mentions légales',
      description: 'Mentions légales du site public Alegria 2027.',
      canonicalPath: '/mentions-legales',
      noIndex: true,
    });
  }
}
