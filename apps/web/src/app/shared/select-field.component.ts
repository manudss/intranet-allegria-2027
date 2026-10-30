import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiLabel, TuiInput } from '@taiga-ui/core';
import { TuiChevron, TuiDataListWrapper, TuiSelect } from '@taiga-ui/kit';

export interface SelectOption<T> {
  value: T;
  label: string;
}

let nextId = 0;

/**
 * Liste déroulante au format Taiga UI (tui-textfield + tuiSelect + tui-data-list-wrapper),
 * cf. https://taiga-ui.dev/components/select. Remplace les <select> natifs.
 */
@Component({
  selector: 'app-select-field',
  imports: [FormsModule, TuiLabel, ...TuiInput, TuiChevron, TuiSelect, TuiDataListWrapper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tui-textfield tuiChevron [stringify]="stringify()" [iconStart]="icon()">
    <label tuiLabel [attr.for]="inputId">{{ label() }}</label>
    <input
      tuiSelect
      [id]="inputId"
      [attr.aria-label]="label()"
      [attr.data-testid]="testId()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [ngModel]="value()"
      (ngModelChange)="valueChange.emit($event)"
    />
    <tui-data-list-wrapper *tuiDropdown [items]="values()" />
  </tui-textfield>`,
  styles: `
    :host {
      display: block;
      min-inline-size: 12rem;
    }
  `,
})
export class SelectFieldComponent<T> {
  readonly label = input.required<string>();
  readonly options = input.required<readonly SelectOption<T>[]>();
  readonly value = input<T | null>(null);
  readonly placeholder = input('');
  readonly icon = input('');
  readonly testId = input<string | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<T | null>();
  protected readonly inputId = `app-select-field-${nextId++}`;
  protected readonly values = computed(() => this.options().map((o) => o.value));
  protected readonly stringify = computed(() => {
    const options = this.options();
    return (v: T | null): string => options.find((o) => o.value === v)?.label ?? '';
  });
}
