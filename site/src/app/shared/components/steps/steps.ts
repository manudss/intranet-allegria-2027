import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { JourneyStep } from '../../../core/models/content.models';

/** Frise d'étapes numérotées (ex : parcours d'inscription). */
@Component({
  selector: 'app-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './steps.html',
  styleUrl: './steps.scss',
})
export class Steps {
  readonly steps = input.required<JourneyStep[]>();
}
