import { Component, computed, inject } from '@angular/core';
import { AppearanceService } from '@mej-allegria/appearance';
import { TuiButton } from '@taiga-ui/core';

const ORDER = ['auto', 'light', 'dark'] as const;
const LABELS = { auto: 'Automatique', light: 'Clair', dark: 'Sombre' } as const;
const ICONS = { auto: '@tui.monitor', light: '@tui.sun', dark: '@tui.moon' } as const;

/** Bouton discret : une icône (auto, clair, sombre). Un clic passe au mode suivant. */
@Component({
  selector: 'app-appearance-toggle',
  standalone: true,
  imports: [TuiButton],
  template: `
    <button
      tuiIconButton
      type="button"
      appearance="flat"
      size="s"
      class="appearance-toggle"
      [iconStart]="icon()"
      [attr.aria-label]="'Apparence : ' + label() + '. Passer au mode ' + nextLabel()"
      [title]="'Apparence : ' + label()"
      (click)="next()"
    ></button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .appearance-toggle {
        color: inherit;
        opacity: 0.85;
      }
      .appearance-toggle:hover,
      .appearance-toggle:focus-visible {
        opacity: 1;
      }
    `,
  ],
})
export class AppearanceToggleComponent {
  private readonly appearance = inject(AppearanceService);
  readonly label = computed(() => LABELS[this.appearance.mode()]);
  readonly icon = computed(() => ICONS[this.appearance.mode()]);
  readonly nextLabel = computed(() => LABELS[this.nextMode()]);

  private nextMode() {
    const i = ORDER.indexOf(this.appearance.mode());
    return ORDER[(i + 1) % ORDER.length];
  }

  next(): void {
    this.appearance.choose(this.nextMode());
  }
}
