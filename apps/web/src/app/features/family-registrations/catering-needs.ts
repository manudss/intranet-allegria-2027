import { FOOD_ALLERGEN_LABELS } from '@mej-allegria/shared';
import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { FamilyRegistrationsApiService } from '../../services/api.services';
import type { CateringNeeds } from '../../models/models';
@Component({
  selector: 'app-catering-needs',
  imports: [...SHARED_IMPORTS],
  template: `<app-page-layout
    title="Restauration : besoins alimentaires"
    description="Synthèse limitée, sans identité ni accès au dossier médical."
    ><button actions tuiButton (click)="load()">Actualiser</button>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
    @if (data()) {
      <p>{{ data()!.notice }}</p>
      <p>
        Les catégories à moins de cinq personnes ne sont pas affichées. L'absence d'une ligne ne
        signifie pas l'absence d'allergie. Aucun filtre par petit groupe ni détail individuel n'est
        proposé.
      </p>
      <div class="needs">
        @for (item of data()!.items; track item.allergen) {
          <article>
            <h2>{{ labels[item.allergen] || item.allergen }}</h2>
            <p>
              Fourchette de besoins : <strong>{{ item.range }}</strong>
            </p>
          </article>
        } @empty {
          <p>
            Aucune synthèse affichable. Vérifiez les consignes autorisées auprès du référent santé,
            sans demander de liste médicale nominative.
          </p>
        }
      </div>
    }
    <aside>
      Cette synthèse aide à préparer les repas. Elle ne remplace pas les consignes confidentielles
      et individuelles de prise en charge d'une allergie.
    </aside></app-page-layout
  >`,
  styles: [
    `
      .needs {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }
      article,
      aside {
        padding: 1rem;
        border: 1px solid var(--tui-border-normal);
        border-radius: 12px;
        margin: 1rem 0;
      }
    `,
  ],
})
export class CateringNeedsPage implements OnInit {
  protected labels = FOOD_ALLERGEN_LABELS;
  private api = inject(FamilyRegistrationsApiService);
  protected data = signal<CateringNeeds | null>(null);
  protected error = signal('');
  async ngOnInit() {
    await this.load();
  }
  protected async load() {
    try {
      this.data.set(await firstValueFrom(this.api.catering()));
      this.error.set('');
    } catch {
      this.data.set(null);
      this.error.set(
        'Vue indisponible : habilitation restauration et circuit sanitaire validé nécessaires.',
      );
    }
  }
}
