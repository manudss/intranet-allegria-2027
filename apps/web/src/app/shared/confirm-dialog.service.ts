import { inject, Injectable } from '@angular/core';
import { TuiDialogService } from '@taiga-ui/core';
import { TUI_CONFIRM, type TuiConfirmData } from '@taiga-ui/kit';
import { map, type Observable } from 'rxjs';

export interface ConfirmOptions {
  /** Titre court de la boîte de dialogue. */
  readonly title: string;
  /** Phrase qui nomme l'objet concerné et la conséquence. */
  readonly message: string;
  readonly yes?: string;
  readonly no?: string;
}

/**
 * Confirmation dans une boîte de dialogue HTML (Taiga UI), à la place de `window.confirm`.
 * Émet `true` si l'utilisateur confirme, `false` sinon.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialogs = inject(TuiDialogService);

  ask(options: ConfirmOptions): Observable<boolean> {
    const data: TuiConfirmData = {
      content: options.message,
      yes: options.yes ?? 'Confirmer',
      no: options.no ?? 'Annuler',
      appearance: 'primary-destructive',
    };
    return this.dialogs
      .open<boolean>(TUI_CONFIRM, { label: options.title, size: 's', data })
      .pipe(map((result) => result === true));
  }

  /** Suppression : « Supprimer <objet> ? » avec un bouton rouge nommé « Supprimer ». */
  askDelete(objectName: string, consequence = 'Cette action est définitive.'): Observable<boolean> {
    return this.ask({
      title: `Supprimer ${objectName} ?`,
      message: consequence,
      yes: 'Supprimer',
    });
  }
}
