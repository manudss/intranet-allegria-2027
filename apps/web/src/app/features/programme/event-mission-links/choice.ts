import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiTextfield, TuiLabel } from '@taiga-ui/core';
import { TuiSelect, TuiChevron, TuiDataListWrapper } from '@taiga-ui/kit';
export interface EventChoice {
  value: string | number | null;
  label: string;
}
let choiceIndex = 0;
@Component({
  selector: 'app-event-choice',
  imports: [FormsModule, TuiTextfield, TuiLabel, TuiSelect, TuiChevron, TuiDataListWrapper],
  template: ` <tui-textfield [tuiTextfieldCleaner]="false" tuiChevron [stringify]="stringify"
    ><label tuiLabel [for]="controlId">{{ label() }}</label
    ><input
      tuiSelect
      [id]="controlId"
      [disabled]="disabled()"
      [ngModel]="selected()"
      (ngModelChange)="valueChange.emit($event?.value ?? null)" /><tui-data-list-wrapper
      *tuiDropdown
      [items]="choices()"
  /></tui-textfield>`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
    `,
  ],
})
export class EventChoiceComponent {
  readonly controlId = 'event-choice-' + ++choiceIndex;
  readonly label = input.required<string>();
  readonly choices = input<EventChoice[]>([]);
  readonly value = input<string | number | null>(null);
  readonly disabled = input(false);
  readonly valueChange = output<any>(); // value types vary across identifiers, enum keys and null.
  readonly selected = computed(() => this.choices().find((c) => c.value === this.value()) ?? null);
  readonly stringify = (c: EventChoice) => c.label;
}
