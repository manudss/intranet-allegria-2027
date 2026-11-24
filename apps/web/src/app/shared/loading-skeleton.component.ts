import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';

export type LoadingSkeletonVariant = 'table' | 'cards' | 'form' | 'page';

/**
 * Squelette de chargement commun (Taiga UI `tuiSkeleton`).
 * Affiché dès que la page s'ouvre, le temps que les données arrivent.
 */
@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [TuiSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skeleton" role="status" aria-live="polite" [attr.aria-label]="label()">
      <span class="visually-hidden">{{ label() }}</span>
      @if (variant() === 'page') {
        <div class="head" aria-hidden="true">
          <div class="title" [tuiSkeleton]="'Titre de la page en cours'">Titre de la page en cours</div>
          <div class="subtitle" [tuiSkeleton]="'Explication de ce que permet cette page, en une phrase'">
            Explication de ce que permet cette page, en une phrase
          </div>
        </div>
      }
      @switch (variant()) {
        @case ('cards') {
          <div class="cards" aria-hidden="true">
            @for (i of cardIndexes(); track i) {
              <div class="card">
                <div [tuiSkeleton]="'Nom de la carte'">Nom de la carte</div>
                <div [tuiSkeleton]="'Détail de la carte sur deux lignes'">Détail de la carte sur deux lignes</div>
                <div [tuiSkeleton]="'Statut'">Statut</div>
              </div>
            }
          </div>
        }
        @case ('form') {
          <div class="form" aria-hidden="true">
            @for (i of rowIndexes(); track i) {
              <div class="field">
                <div class="label" [tuiSkeleton]="'Libellé'">Libellé</div>
                <div class="input" [tuiSkeleton]="'Valeur du champ de saisie'">Valeur du champ de saisie</div>
              </div>
            }
          </div>
        }
        @default {
          <div class="table" aria-hidden="true">
            <div class="tools" [tuiSkeleton]="'Rechercher dans la liste des éléments affichés'">
              Rechercher dans la liste des éléments affichés
            </div>
            <div class="row header">
              @for (c of columns; track c) {
                <div [tuiSkeleton]="'Colonne'">Colonne</div>
              }
            </div>
            @for (i of rowIndexes(); track i) {
              <div class="row">
                @for (c of columns; track c) {
                  <div [tuiSkeleton]="widths[(i + c) % widths.length]">{{ widths[(i + c) % widths.length] }}</div>
                }
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .skeleton {
        display: grid;
        gap: 1rem;
        min-inline-size: 0;
      }
      .visually-hidden {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .head {
        display: grid;
        gap: 0.5rem;
      }
      .title {
        font: var(--tui-font-heading-h4, 1.5rem/2rem sans-serif);
        inline-size: fit-content;
        max-inline-size: 100%;
      }
      .subtitle {
        inline-size: fit-content;
        max-inline-size: 100%;
      }
      .tools {
        inline-size: fit-content;
        max-inline-size: 100%;
        padding-block: 0.5rem;
      }
      .table {
        display: grid;
        gap: 0.75rem;
      }
      .row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
        padding-block: 0.4rem;
        border-block-end: 1px solid var(--tui-border-normal, rgba(0, 0, 0, 0.1));
      }
      .row > div {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: clip;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
        gap: 1rem;
      }
      .card {
        display: grid;
        gap: 0.6rem;
        padding: 1rem;
        border-radius: 1rem;
        border: 1px solid var(--tui-border-normal, rgba(0, 0, 0, 0.1));
      }
      .form {
        display: grid;
        gap: 1rem;
        max-inline-size: 32rem;
      }
      .field {
        display: grid;
        gap: 0.35rem;
      }
      .input {
        padding-block: 0.6rem;
      }
      @media (max-width: 640px) {
        .row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .row > div:nth-child(n + 3) {
          display: none;
        }
      }
    `,
  ],
})
export class LoadingSkeletonComponent {
  readonly variant = input<LoadingSkeletonVariant>('table');
  readonly label = input('Chargement en cours…');
  readonly count = input(8);

  protected readonly columns = [0, 1, 2, 3];
  protected readonly widths = [
    'Nom Prénom exemple',
    'Valeur courte',
    'Adresse de courriel',
    'Statut',
    'Libellé plus long',
  ];
  protected readonly rowIndexes = computed(() => Array.from({ length: this.count() }, (_, i) => i));
  protected readonly cardIndexes = computed(() => Array.from({ length: Math.max(4, this.count()) }, (_, i) => i));
}
