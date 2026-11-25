import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiSkeleton } from '@taiga-ui/kit';

/** Squelette de chargement (Taiga UI `tuiSkeleton`), affiché dès l'ouverture de l'écran. */
@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [TuiSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skeleton" role="status" aria-live="polite" [attr.aria-label]="label()">
      <span class="visually-hidden">{{ label() }}</span>
      @for (i of items; track i) {
        <div class="card" aria-hidden="true">
          <div class="line" [tuiSkeleton]="'Titre de la séquence'">Titre de la séquence</div>
          <div class="line" [tuiSkeleton]="'Horaire et lieu de la séquence'">Horaire et lieu de la séquence</div>
        </div>
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
        gap: 0.75rem;
      }
      .visually-hidden {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .card {
        display: grid;
        gap: 0.5rem;
        padding: 1rem;
        border-radius: 1rem;
        border: 1px solid var(--tui-border-normal, rgba(0, 0, 0, 0.1));
      }
      .line {
        inline-size: fit-content;
        max-inline-size: 100%;
      }
    `,
  ],
})
export class LoadingSkeletonComponent {
  readonly label = input('Chargement en cours…');
  protected readonly items = [0, 1, 2, 3];
}
