import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiComparator, TuiReorder, TuiTable } from '@taiga-ui/addon-table';
import { TuiContext, TuiStringHandler } from '@taiga-ui/cdk';
import {
  TuiButton,
  TuiDataList,
  TuiDropdown,
  TuiIcon,
  TuiInput,
  TuiLink,
  TuiSelectLike,
  TuiTextfield,
} from '@taiga-ui/core';
import {
  TuiAutoColorPipe,
  TuiAvatar,
  TuiBadge,
  TuiChevron,
  TuiChip,
  TuiInputChip,
  TuiMultiSelect,
  TuiSelect,
} from '@taiga-ui/kit';

export type DataTableColumnType = 'text' | 'list' | 'number' | 'date' | 'boolean';
export type DataTableValue = string | number | boolean | null | undefined;
export type DataTableCellType =
  'text' | 'person' | 'badge' | 'chip' | 'chips' | 'icon' | 'date' | 'number' | 'boolean';

export interface DataTableCellPresentation<T> {
  readonly type: DataTableCellType;
  readonly subtitle?: (row: T) => DataTableValue;
  readonly icon?: (row: T) => string;
  readonly iconColor?: (row: T) => string;
  readonly appearance?: (row: T) => string;
  readonly autoColor?: boolean;
  /** For 'chips' type: returns an array of string values to display as chips. */
  readonly values?: (row: T) => readonly string[];
}

export interface DataTableColumn<T> {
  readonly key: string;
  readonly label: string;
  readonly type?: DataTableColumnType;
  readonly value: (row: T) => DataTableValue;
  /** Raw value used when the displayed value is formatted. */
  readonly filterValue?: (row: T) => DataTableValue;
  readonly presentation?: DataTableCellPresentation<T>;
  /** Navigation is independent from presentation: any cell type can be linked. */
  readonly link?: (row: T) => string | readonly (string | number)[];
  readonly href?: (row: T) => string;
  readonly sorter?: TuiComparator<T>;
  /** If true, the column is hidden by default and must be enabled by the user. */
  readonly hidden?: boolean;
}

export interface DataTableAction<T> {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly appearance?: string;
  readonly disabled?: (row: T) => boolean;
}

export interface DataTableActionEvent<T> {
  readonly action: DataTableAction<T>;
  readonly row: T;
}

interface ColumnFilterState {
  readonly text?: string;
  readonly list?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly from?: string;
  readonly to?: string;
  readonly boolean?: '' | 'true' | 'false';
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    RouterLink,
    TuiAutoColorPipe,
    TuiAvatar,
    TuiBadge,
    TuiButton,
    TuiChevron,
    TuiChip,
    TuiDataList,
    TuiDropdown,
    TuiIcon,
    ...TuiInput,
    TuiInputChip,
    TuiLink,
    TuiMultiSelect,
    TuiReorder,
    TuiSelect,
    TuiSelectLike,
    TuiTable,
    TuiTextfield,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.html',
  styleUrls: ['./data-table.scss'],
})
export class DataTableComponent<T extends { readonly id: number }> implements OnInit {
  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  readonly lineActions = input<readonly DataTableAction<T>[]>([]);
  readonly rowSelected = output<T>();
  readonly actionSelected = output<DataTableActionEvent<T>>();

  readonly orderedColumns = signal<readonly DataTableColumn<T>[]>([]);
  readonly enabledColumns = signal<readonly DataTableColumn<T>[]>([]);
  readonly filterValues = signal<Readonly<Record<string, ColumnFilterState>>>({});
  readonly optionSearch = signal<Readonly<Record<string, string>>>({});
  readonly hasFilters = computed(() =>
    Object.values(this.filterValues()).some((filter) =>
      Boolean(
        filter.text ||
        filter.list?.length ||
        filter.min != null ||
        filter.max != null ||
        filter.from ||
        filter.to ||
        filter.boolean,
      ),
    ),
  );
  readonly listValues = computed(
    () =>
      Object.fromEntries(
        this.columns()
          .filter((column) => column.type === 'list')
          .map((column) => [
            column.key,
            [
              ...new Set(
                this.rows()
                  .map((row) => this.rawValue(column, row))
                  .filter((value) => value != null)
                  .map(String),
              ),
            ]
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })),
          ]),
      ) as Readonly<Record<string, readonly string[]>>,
  );
  readonly filteredRows = computed(() => {
    const filters = this.filterValues();
    return this.rows().filter((row) =>
      this.columns().every((column) => this.matchesFilter(column, row, filters[column.key])),
    );
  });
  readonly columnKeys = () => this.enabledColumns().map(({ key }) => key);
  readonly tableColumnKeys = () => [...this.columnKeys(), 'actions'];
  readonly tableActions = computed<readonly DataTableAction<T>[]>(() => [
    { id: 'details', label: 'Détails', icon: '@tui.eye' },
    ...this.lineActions(),
  ]);
  readonly trackBy = (row: T): number => row.id;
  readonly columnLabel: TuiStringHandler<TuiContext<DataTableColumn<T>>> = ({ $implicit }) =>
    $implicit.label;
  readonly standaloneModel = { standalone: true } as const;
  readonly booleanOptions = ['Tous', 'Oui', 'Non'] as const;

  ngOnInit(): void {
    this.orderedColumns.set(this.columns());
    this.enabledColumns.set(this.columns().filter((c) => !c.hidden));
  }

  defaultSorter(column: DataTableColumn<T>): TuiComparator<T> {
    return (a, b) =>
      String(this.rawValue(column, a)).localeCompare(String(this.rawValue(column, b)), 'fr', {
        numeric: true,
      });
  }

  reorder(columns: readonly DataTableColumn<T>[]): void {
    this.orderedColumns.set(columns);
    const enabled = new Set(this.enabledColumns());
    this.enabledColumns.set(columns.filter((column) => enabled.has(column)));
  }

  setTextFilter(key: string, text: string): void {
    this.updateFilter(key, { text });
  }
  setListFilter(key: string, list: readonly string[]): void {
    this.updateFilter(key, { list });
  }
  setOptionSearch(key: string, value: string): void {
    this.optionSearch.update((searches) => ({ ...searches, [key]: value }));
  }
  filteredListValues(key: string): readonly string[] {
    const search = this.normalize(this.optionSearch()[key] || '');
    return search
      ? (this.listValues()[key] || []).filter((value) => this.normalize(value).includes(search))
      : this.listValues()[key] || [];
  }
  setNumberFilter(key: string, bound: 'min' | 'max', value: string): void {
    this.updateFilter(key, { [bound]: value === '' ? undefined : Number(value) });
  }
  setDateFilter(key: string, bound: 'from' | 'to', value: string): void {
    this.updateFilter(key, { [bound]: value });
  }
  setBooleanFilter(key: string, label: string): void {
    this.updateFilter(key, { boolean: label === 'Oui' ? 'true' : label === 'Non' ? 'false' : '' });
  }
  booleanLabel(key: string): string {
    const value = this.filterValues()[key]?.boolean;
    return value === 'true' ? 'Oui' : value === 'false' ? 'Non' : 'Tous';
  }

  initials(value: DataTableValue): string {
    return String(value ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toLocaleUpperCase('fr');
  }
  cellAppearance(column: DataTableColumn<T>, row: T): string {
    return column.presentation?.appearance?.(row) || 'neutral';
  }
  cellText(column: DataTableColumn<T>, row: T): string {
    return String(column.value(row) ?? '');
  }
  cellIcon(column: DataTableColumn<T>, row: T): string {
    return column.presentation?.icon?.(row) || '';
  }
  cellIconColor(column: DataTableColumn<T>, row: T): string {
    return column.presentation?.iconColor?.(row) || 'var(--tui-text-action)';
  }
  cellLink(column: DataTableColumn<T>, row: T): string | readonly (string | number)[] | null {
    return column.link?.(row) || null;
  }
  cellHref(column: DataTableColumn<T>, row: T): string {
    return column.href?.(row) || '';
  }

  runAction(event: Event, action: DataTableAction<T>, row: T): void {
    event.stopPropagation();
    if (action.id === 'details') {
      this.rowSelected.emit(row);
    } else {
      this.actionSelected.emit({ action, row });
    }
  }

  clearFilters(): void {
    this.filterValues.set({});
  }

  selectFromKeyboard(event: Event, row: T): void {
    event.preventDefault();
    this.rowSelected.emit(row);
  }

  private updateFilter(key: string, patch: Partial<ColumnFilterState>): void {
    this.filterValues.update((filters) => ({ ...filters, [key]: { ...filters[key], ...patch } }));
  }

  private matchesFilter(column: DataTableColumn<T>, row: T, filter?: ColumnFilterState): boolean {
    if (!filter) return true;
    const raw = this.rawValue(column, row);

    switch (column.type || 'text') {
      case 'list':
        return (
          !filter.list?.length ||
          filter.list.some((value) => this.normalize(value) === this.normalize(raw))
        );
      case 'number': {
        const value = Number(raw);
        return (
          !Number.isNaN(value) &&
          (filter.min == null || value >= filter.min) &&
          (filter.max == null || value <= filter.max)
        );
      }
      case 'date': {
        const value = raw == null ? '' : String(raw).slice(0, 10);
        return (!filter.from || value >= filter.from) && (!filter.to || value <= filter.to);
      }
      case 'boolean':
        return !filter.boolean || String(Boolean(raw)) === filter.boolean;
      default:
        return !filter.text || this.normalize(raw).includes(this.normalize(filter.text));
    }
  }

  private rawValue(column: DataTableColumn<T>, row: T): DataTableValue {
    return column.filterValue?.(row) ?? column.value(row);
  }

  private normalize(value: DataTableValue): string {
    if (value == null) return '';
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  }
}
