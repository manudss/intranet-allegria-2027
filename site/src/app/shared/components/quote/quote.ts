import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { QuoteContent } from '../../../core/models/content.models';

/** Citation mise en avant (esprit du rassemblement, témoignage...). */
@Component({
  selector: 'app-quote',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote.html',
  styleUrl: './quote.scss',
})
export class Quote {
  readonly quote = input.required<QuoteContent>();
}
