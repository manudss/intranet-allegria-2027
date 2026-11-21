import { Component } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { AppearanceControl } from './appearance-control';
import { APPEARANCE_STYLES } from './appearance-view';

@Component({
  selector: 'app-appearance-taiga',
  standalone: true,
  imports: [TuiButton],
  template: `<details class="appearance">
    <summary>Apparence : {{ labels[theme.mode()] }}</summary>
    <fieldset>
      <legend>Apparence sur cet appareil</legend>
      @for (choice of choices; track choice.value) {
        <button
          tuiButton
          appearance="secondary"
          size="s"
          type="button"
          [attr.aria-pressed]="theme.mode() === choice.value"
          (click)="theme.choose(choice.value)"
        >
          {{ choice.label }}
        </button>
      }
      <p>Automatique suit le thème de votre appareil.</p>
    </fieldset>
  </details>`,
  styles: [APPEARANCE_STYLES],
})
export class AppearanceTaigaControl extends AppearanceControl {}
