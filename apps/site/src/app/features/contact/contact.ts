import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { eventConfig } from '../../core/config/event.config';

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './contact.html',
})
export class Contact implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly event = eventConfig;

  ngOnInit(): void {
    this.seo.apply({
      title: 'Contact',
      description: 'Les contacts utiles pour vos questions sur Alegria 2027 : familles, bénévoles et organisation générale.',
      canonicalPath: '/contact',
    });
  }
}
