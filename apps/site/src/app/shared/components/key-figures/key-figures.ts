import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { KeyFigure } from '../../../core/models/content.models';

/** Grille de chiffres clés. */
@Component({
  selector: 'app-key-figures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './key-figures.html',
  styleUrl: './key-figures.scss',
})
export class KeyFigures {
  readonly figures = input.required<KeyFigure[]>();
}
