import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AlertVariant = 'info' | 'warning' | 'success' | 'error';

/**
 * Bandeau d'alerte accessible. Utilise `role="status"` ou `role="alert"` selon la variante
 * afin d'être annoncé correctement par les lecteurs d'écran, et n'utilise jamais la couleur
 * seule pour transmettre l'information (icône + texte).
 */
@Component({
  selector: 'app-alert-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alert-banner.html',
  styleUrl: './alert-banner.scss',
})
export class AlertBanner {
  readonly variant = input<AlertVariant>('info');
  readonly title = input<string>();

  protected readonly icons: Record<AlertVariant, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    success: '✅',
    error: '⛔',
  };

  protected readonly labels: Record<AlertVariant, string> = {
    info: 'Information',
    warning: 'Avertissement',
    success: 'Succès',
    error: 'Erreur',
  };
}
