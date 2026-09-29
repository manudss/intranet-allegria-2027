import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Badge signalant qu'une information n'est pas encore confirmée.
 * Le mot « provisoire » est toujours présent en texte (jamais uniquement une couleur).
 */
@Component({
  selector: 'app-provisional-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge-provisional">🕓 Information provisoire</span>`,
})
export class ProvisionalBadge {}
