import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { TuiLabel } from '@taiga-ui/core';
import { EventDateConfig } from './event-date.config';
import {
  DateValueProvider,
  EventDateOption,
  EventDateSelectorMode,
  SystemDateValueProvider,
  buildEventDateOptions,
  clampIsoDate,
  combineDateAndTime,
  extractIsoDate,
  extractTimeFromDateTimeLocal,
  formatFrenchEventDate,
  getEventDateBounds,
  isDateWithinRange,
} from './event-date.utils';

export const EVENT_DATE_VALUE_PROVIDER = new InjectionToken<DateValueProvider>(
  'EVENT_DATE_VALUE_PROVIDER',
  {
    factory: () => new SystemDateValueProvider(),
  },
);

const OTHER_DATE_OPTION = '__other_date__';

@Component({
  selector: 'app-event-date-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, TuiLabel],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EventDateSelectorComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => EventDateSelectorComponent),
      multi: true,
    },
  ],
  templateUrl: './event-date-selector.component.html',
  styleUrls: ['./event-date-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDateSelectorComponent implements ControlValueAccessor, Validator {
  readonly config = input.required<EventDateConfig>();
  readonly label = input('');
  readonly hint = input('');
  readonly required = input(false);
  readonly disabled = input(false);
  readonly id = input<string | undefined>(undefined);
  readonly name = input<string | undefined>(undefined);
  readonly ariaDescribedBy = input<string | undefined>(undefined);
  readonly mode = input<EventDateSelectorMode>('date');
  readonly value = model<string | null>(null);
  readonly dateChange = output<string | null>();

  protected readonly otherOptionValue = OTHER_DATE_OPTION;

  private readonly dateProvider = inject(EVENT_DATE_VALUE_PROVIDER);
  private readonly customDateInputRef = viewChild<ElementRef<HTMLInputElement>>('customDateInput');

  private readonly explicitDisabled = signal(false);
  private readonly internalValue = signal<string | null>(null);
  private readonly touched = signal(false);
  private readonly hydrateOnce = signal(false);
  private readonly onChangeCallbacks: Array<(value: string | null) => void> = [];
  private readonly onTouchedCallbacks: Array<() => void> = [];
  private readonly onValidatorChangeCallbacks: Array<() => void> = [];

  protected readonly priorityOptions = computed<readonly EventDateOption[]>(() =>
    buildEventDateOptions(this.config()),
  );
  protected readonly bounds = computed(() => getEventDateBounds(this.config(), this.dateProvider));
  protected readonly minDate = computed(() => this.bounds().minDate);
  protected readonly maxDate = computed(() => this.bounds().maxDate);
  protected readonly selectionValue = computed(() => {
    const date = extractIsoDate(this.internalValue());
    if (!date) {
      return '';
    }

    return this.isPriorityDate(date) ? date : OTHER_DATE_OPTION;
  });
  protected readonly isOtherDateSelected = computed(
    () => this.selectionValue() === OTHER_DATE_OPTION,
  );
  protected readonly selectedPriorityDate = computed(() => {
    const value = this.selectionValue();
    return value && value !== OTHER_DATE_OPTION ? value : null;
  });
  protected readonly customDateValue = computed(() => {
    const date = extractIsoDate(this.internalValue());
    return this.isOtherDateSelected() && date ? date : '';
  });
  protected readonly timeValue = computed(() => {
    if (!this.isDateTimeMode()) {
      return '';
    }

    return extractTimeFromDateTimeLocal(this.internalValue()) || '00:00';
  });
  protected readonly disabledState = computed(() => this.disabled() || this.explicitDisabled());
  protected readonly validationMessage = computed(() => {
    const validation = this.validateValue(this.internalValue());

    if (!validation) {
      return '';
    }

    if (validation['required']) {
      return 'Ce champ est obligatoire.';
    }

    if (validation['invalidDate']) {
      return this.isDateTimeMode()
        ? 'La date ou l heure saisie est invalide.'
        : 'La date saisie est invalide.';
    }

    if (validation['dateOutOfRange']) {
      return `La date doit etre comprise entre ${formatFrenchEventDate(this.minDate())} et ${formatFrenchEventDate(this.maxDate())}.`;
    }

    return '';
  });
  protected readonly isInvalid = computed(() => (this.validationMessage() ? 'true' : null));
  protected readonly defaultLabel = computed(() =>
    this.isDateTimeMode() ? 'Date et heure' : 'Date',
  );
  protected readonly otherDateLabel = computed(() =>
    this.isDateTimeMode() ? 'Autre date et heure' : 'Autre date',
  );
  protected readonly selectId = computed(() => this.id() ?? `event-date-selector-${this.uid}`);
  protected readonly timeInputId = computed(() => `${this.selectId()}-time`);
  protected readonly hintId = computed(() => `${this.selectId()}-hint`);
  protected readonly errorId = computed(() => `${this.selectId()}-error`);
  protected readonly describedByIds = computed(() => {
    const ids = new Set<string>();
    const custom = this.ariaDescribedBy();
    if (custom) {
      ids.add(custom);
    }
    if (this.hint()) {
      ids.add(this.hintId());
    }
    if (this.validationMessage()) {
      ids.add(this.errorId());
    }
    return [...ids].join(' ') || null;
  });

  private static nextId = 0;
  private readonly uid = ++EventDateSelectorComponent.nextId;

  constructor() {
    effect(() => {
      const validation = this.validateValue(this.internalValue());
      if (this.hydrateOnce()) {
        return;
      }
      if (validation?.['dateOutOfRange']) {
        const fallbackDate = clampIsoDate(
          extractIsoDate(this.internalValue()) ?? this.minDate(),
          this.minDate(),
          this.maxDate(),
        );
        this.hydrateOnce.set(true);
        this.setInternalValue(this.buildOutputValue(fallbackDate, this.timeValue()), false);
      }
    });

    effect(() => {
      this.config();
      this.mode();
      this.onValidatorChangeCallbacks.forEach((callback) => callback());
    });

    effect(() => {
      if (this.isOtherDateSelected()) {
        queueMicrotask(() => this.customDateInputRef()?.nativeElement.focus());
      }
    });
  }

  writeValue(value: string | null): void {
    const normalizedValue = value && value.trim() ? value : null;
    this.internalValue.set(normalizedValue);
    this.value.set(normalizedValue);
    this.hydrateOnce.set(true);
  }

  get currentValue(): string | null {
    return this.internalValue();
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChangeCallbacks.push(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedCallbacks.push(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this.explicitDisabled.set(isDisabled);
  }

  validate(): ValidationErrors | null {
    return this.validateValue(this.internalValue());
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChangeCallbacks.push(fn);
  }

  protected onSelectionChange(value: string): void {
    if (!value) {
      this.setInternalValue(null);
      return;
    }

    if (value === OTHER_DATE_OPTION) {
      const existingDate = extractIsoDate(this.internalValue());
      const fallbackDate = clampIsoDate(
        existingDate ?? this.priorityOptions()[0]?.value ?? this.minDate(),
        this.minDate(),
        this.maxDate(),
      );
      this.setInternalValue(this.buildOutputValue(fallbackDate, this.timeValue()));
      return;
    }

    this.setInternalValue(this.buildOutputValue(value, this.timeValue()));
  }

  protected onCustomDateInput(value: string): void {
    if (!value) {
      this.setInternalValue(null);
      return;
    }

    this.setInternalValue(this.buildOutputValue(value, this.timeValue()));
  }

  protected onTimeInput(value: string): void {
    const date =
      extractIsoDate(this.internalValue()) ?? this.selectedPriorityDate() ?? this.customDateValue();
    if (!date) {
      return;
    }

    this.setInternalValue(this.buildOutputValue(date, value));
  }

  protected markTouched(): void {
    if (this.touched()) {
      return;
    }

    this.touched.set(true);
    this.onTouchedCallbacks.forEach((callback) => callback());
  }

  protected isDateTimeMode(): boolean {
    return this.mode() === 'datetime-local';
  }

  private buildOutputValue(date: string, time: string): string {
    if (this.isDateTimeMode()) {
      return combineDateAndTime(date, time);
    }

    return date;
  }

  private isPriorityDate(date: string): boolean {
    return this.priorityOptions().some((option) => option.value === date);
  }

  private setInternalValue(value: string | null, emit = true): void {
    this.internalValue.set(value);
    this.value.set(value);

    if (!emit) {
      return;
    }

    this.onChangeCallbacks.forEach((callback) => callback(value));
    this.dateChange.emit(value);
    this.onValidatorChangeCallbacks.forEach((callback) => callback());
  }

  private validateValue(value: string | null): ValidationErrors | null {
    if (!value) {
      return this.required() ? { required: true } : null;
    }

    const date = extractIsoDate(value);
    if (!date) {
      return { invalidDate: true };
    }

    if (!isDateWithinRange(date, this.minDate(), this.maxDate())) {
      return { dateOutOfRange: true };
    }

    if (this.isDateTimeMode() && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return { invalidDate: true };
    }

    return null;
  }
}
