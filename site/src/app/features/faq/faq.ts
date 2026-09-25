import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SeoService } from '../../core/seo/seo.service';
import { faqCategories } from '../../core/content/faq.content';

@Component({
  selector: 'app-faq',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SHARED_IMPORTS],
  templateUrl: './faq.html',
})
export class Faq implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);

  protected readonly categories = faqCategories;

  /** Identifiant de la question à ouvrir automatiquement, lu depuis le fragment d'URL (`#<categorie>-<id>`). */
  protected readonly initialOpenId = toSignal(
    this.route.fragment.pipe(map((fragment) => fragment ?? undefined)),
    { initialValue: undefined },
  );

  ngOnInit(): void {
    this.seo.apply({
      title: 'Foire aux questions',
      description:
        'Toutes les réponses aux questions fréquentes des familles sur Alegria 2027 : inscription, tarifs, transport, hébergement, santé et sécurité.',
      canonicalPath: '/faq',
    });
  }
}
