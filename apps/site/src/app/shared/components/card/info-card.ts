import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Carte éditoriale générique (thème, mission, chiffre, orientation...).
 * Le contenu principal passe par `ng-content` pour rester flexible.
 */
@Component({
  selector: 'app-info-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './info-card.html',
  styleUrl: './info-card.scss',
})
export class InfoCard {
  readonly title = input.required<string>();
  readonly badge = input<string>();
}
