import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { PROGRAM_PLACEHOLDER_NOTICE, programDays } from '../../core/content/programme.content';

@Component({
  selector: 'app-programme',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './programme.html',
})
export class Programme implements OnInit {
  private readonly seo = inject(SeoService);

  protected readonly days = programDays;
  protected readonly placeholderNotice = PROGRAM_PLACEHOLDER_NOTICE;
  protected readonly blockTypeLabels: Record<string, string> = {
    collectif: 'Temps collectif',
    atelier: 'Atelier',
    spirituel: 'Temps spirituel',
    repas: 'Repas',
    libre: 'Temps libre',
    pratique: 'Information pratique',
  };

  ngOnInit(): void {
    this.seo.apply({
      title: 'Programme',
      description:
        'Le déroulé prévisionnel des quatre jours d’Alegria 2027 : temps collectifs, ateliers, temps spirituels et repas.',
      canonicalPath: '/programme',
    });
  }
}
