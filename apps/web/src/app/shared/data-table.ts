import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiComparator, TuiReorder, TuiTable } from '@taiga-ui/addon-table';
import { TuiContext, TuiStringHandler } from '@taiga-ui/cdk';
import { TuiButton, TuiDataList, TuiDropdown, TuiIcon, TuiInput, TuiLink, TuiSelectLike, TuiTextfield } from '@taiga-ui/core';
import { TuiAutoColorPipe, TuiAvatar, TuiBadge, TuiChevron, TuiChip, TuiInputChip, TuiMultiSelect, TuiSelect } from '@taiga-ui/kit';

export type DataTableColumnType = 'text' | 'list' | 'number' | 'date' | 'boolean';
export type DataTableValue = string | number | boolean | null | undefined;
export type DataTableCellType = 'text' | 'person' | 'badge' | 'chip' | 'icon' | 'link' | 'date' | 'number' | 'boolean';

export interface DataTableCellPresentation<T> {
  readonly type: DataTableCellType;
  readonly subtitle?: (row: T) => DataTableValue;
  readonly icon?: (row: T) => string;
  readonly iconColor?: (row: T) => string;
  readonly appearance?: (row: T) => string;
  readonly autoColor?: boolean;
  readonly link?: (row: T) => string | readonly (string | number)[];
  readonly href?: (row: T) => string;
}

export interface DataTableColumn<T> {
  readonly key: string;
  readonly label: string;
  readonly type?: DataTableColumnType;
  readonly value: (row: T) => DataTableValue;
  /** Raw value used when the displayed value is formatted. */
  readonly filterValue?: (row: T) => DataTableValue;
  readonly presentation?: DataTableCellPresentation<T>;
  readonly sorter?: TuiComparator<T>;
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
  template: `
    <div class="table-tools">
      @if (hasFilters()) {
        <button appearance="secondary" size="s" tuiButton type="button" (click)="clearFilters()">
          Effacer les filtres
        </button>
      }
      <details>
        <summary>Configurer les colonnes</summary>
        <tui-reorder
          [enabled]="enabledColumns()"
          [items]="orderedColumns()"
          [content]="columnLabel"
          (enabledChange)="enabledColumns.set($event)"
          (itemsChange)="reorder($event)"
        />
      </details>
    </div>
    <div class="table-scroll">
      <table tuiTable size="l" [columns]="columnKeys()">
        <thead>
          <tr tuiThGroup>
            @for (column of enabledColumns(); track column.key) {
              <th *tuiHead="column.key" tuiTh [sorter]="column.sorter || defaultSorter(column)" [resizable]="true" [sticky]="true" [minWidth]="140">
                <span>{{ column.label }}</span>
                <div class="column-filter" (click)="$event.stopPropagation()">
                  @switch (column.type || 'text') {
                    @case ('list') {
                      <tui-textfield multi tuiChevron>
                        <input tuiInputChip tuiSelectLike [attr.aria-label]="'Filtrer la colonne ' + column.label" [placeholder]="filterValues()[column.key]?.list?.length ? '' : 'Sélectionner'" [ngModel]="filterValues()[column.key]?.list || []" [ngModelOptions]="standaloneModel" (ngModelChange)="setListFilter(column.key, $event)" />
                        <ng-template tuiItem />
                        <ng-container *tuiDropdown>
                          <tui-textfield class="option-search">
                            <input tuiInput type="search" placeholder="Rechercher une option…" [attr.aria-label]="'Rechercher dans ' + column.label" [value]="optionSearch()[column.key] || ''" (input)="setOptionSearch(column.key, $any($event.target).value)" />
                          </tui-textfield>
                          <tui-data-list tuiMultiSelectGroup>
                            @for (option of filteredListValues(column.key); track option) {
                              <button tuiOption type="button" [value]="option">{{ option }}</button>
                            } @empty {
                              <p class="empty-options">Aucune option</p>
                            }
                          </tui-data-list>
                        </ng-container>
                      </tui-textfield>
                    }
                    @case ('number') {
                      <div class="range-filter">
                        <tui-textfield><input tuiInput type="number" placeholder="Min" [attr.aria-label]="column.label + ' minimum'" [value]="filterValues()[column.key]?.min ?? ''" (input)="setNumberFilter(column.key, 'min', $any($event.target).value)" /></tui-textfield>
                        <tui-textfield><input tuiInput type="number" placeholder="Max" [attr.aria-label]="column.label + ' maximum'" [value]="filterValues()[column.key]?.max ?? ''" (input)="setNumberFilter(column.key, 'max', $any($event.target).value)" /></tui-textfield>
                      </div>
                    }
                    @case ('date') {
                      <div class="range-filter">
                        <tui-textfield><input tuiInput type="date" [attr.aria-label]="column.label + ' depuis'" [value]="filterValues()[column.key]?.from || ''" (input)="setDateFilter(column.key, 'from', $any($event.target).value)" /></tui-textfield>
                        <tui-textfield><input tuiInput type="date" [attr.aria-label]="column.label + ' jusqu’à'" [value]="filterValues()[column.key]?.to || ''" (input)="setDateFilter(column.key, 'to', $any($event.target).value)" /></tui-textfield>
                      </div>
                    }
                    @case ('boolean') {
                      <tui-textfield tuiChevron>
                        <select tuiSelect [items]="booleanOptions" [ngModel]="booleanLabel(column.key)" [ngModelOptions]="standaloneModel" (ngModelChange)="setBooleanFilter(column.key, $event)"></select>
                      </tui-textfield>
                    }
                    @default {
                      <tui-textfield><input tuiInput type="search" [attr.aria-label]="'Filtrer la colonne ' + column.label" placeholder="Filtrer…" [value]="filterValues()[column.key]?.text || ''" (input)="setTextFilter(column.key, $any($event.target).value)" /></tui-textfield>
                    }
                  }
                </div>
              </th>
            }
          </tr>
        </thead>
        @let sortedRows = filteredRows() | tuiTableSort;
        <tbody tuiTbody [data]="sortedRows">
          @for (row of sortedRows; track trackBy(row)) {
            <tr tuiTr tabindex="0" (click)="rowSelected.emit(row)" (keydown.enter)="rowSelected.emit(row)" (keydown.space)="selectFromKeyboard($event, row)">
              @for (column of enabledColumns(); track column.key) {
                <td *tuiCell="column.key" tuiTd>
                  @switch (column.presentation?.type || 'text') {
                    @case ('person') {
                      <div class="person-cell">
                        <div appearance="secondary" size="s" [tuiAvatar]="initials(column.value(row))"></div>
                        <span class="cell-copy"><strong>{{ column.value(row) }}</strong>@if (column.presentation?.subtitle; as subtitle) { <small>{{ subtitle(row) }}</small> }</span>
                      </div>
                    }
                    @case ('badge') {
                      <span size="l" tuiBadge [appearance]="cellAppearance(column, row)" [iconStart]="cellIcon(column, row)">{{ column.value(row) }}</span>
                    }
                    @case ('chip') {
                      <span size="s" tuiChip [appearance]="column.presentation?.autoColor ? 'custom' : cellAppearance(column, row)" [iconStart]="cellIcon(column, row)" [style.background-color]="column.presentation?.autoColor ? (cellText(column, row) | tuiAutoColor) : null">{{ column.value(row) }}</span>
                    }
                    @case ('icon') {
                      <span class="icon-cell"><tui-icon [icon]="cellIcon(column, row)" [style.color]="cellIconColor(column, row)" />{{ column.value(row) }}</span>
                    }
                    @case ('link') {
                      @if (cellHref(column, row); as href) {
                        <a iconEnd="@tui.external-link" tuiLink target="_blank" rel="noopener noreferrer" [href]="href" (click)="$event.stopPropagation()">{{ column.value(row) }}</a>
                      } @else {
                        <a tuiLink [routerLink]="cellLink(column, row)" (click)="$event.stopPropagation()">{{ column.value(row) }}</a>
                      }
                    }
                    @case ('boolean') {
                      <span size="s" tuiBadge [appearance]="column.value(row) ? 'positive' : 'neutral'">{{ column.value(row) ? 'Oui' : 'Non' }}</span>
                    }
                    @case ('date') { <time class="data-value">{{ column.value(row) }}</time> }
                    @case ('number') { <span class="data-value number-value">{{ column.value(row) }}</span> }
                    @default {
                      <span class="cell-copy">{{ column.value(row) }}@if (column.presentation?.subtitle; as subtitle) { <small>{{ subtitle(row) }}</small> }</span>
                    }
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; }
    .table-tools { display: flex; justify-content: flex-end; align-items: center; gap: .75rem; margin-block-end: .75rem; }
    details { position: relative; }
    summary { color: var(--tui-text-secondary); cursor: pointer; }
    tui-reorder { position: absolute; z-index: 5; inset-inline-end: 0; inline-size: 15rem; padding: .75rem; border: 1px solid var(--tui-border-normal); border-radius: .75rem; background: var(--tui-background-base); box-shadow: var(--tui-shadow-medium); }
    .table-scroll { max-block-size: calc(100vh - 17rem); min-block-size: 24rem; overflow: auto; border-radius: .75rem; }
    table { inline-size: 100%; }
    [tuiTh] { z-index: 2; background: var(--tui-background-base); }
    [tuiTh] > span { display: block; margin-block-end: .375rem; }
    .column-filter { min-inline-size: 9rem; font-weight: normal; }
    .range-filter { display: grid; grid-template-columns: minmax(5.5rem, 1fr) minmax(5.5rem, 1fr); gap: .25rem; }
    .option-search { margin: .25rem; }
    .empty-options { padding: .75rem; margin: 0; color: var(--tui-text-secondary); text-align: center; }
    .person-cell, .icon-cell { display: flex; align-items: center; gap: .625rem; }
    .cell-copy { display: flex; min-inline-size: 0; flex-direction: column; }
    .cell-copy small { overflow: hidden; color: var(--tui-text-secondary); font-size: .75rem; text-overflow: ellipsis; }
    .icon-cell tui-icon { flex: 0 0 auto; }
    .data-value { font-variant-numeric: tabular-nums; }
    .number-value { display: block; text-align: end; }
    tr[tabindex] { cursor: pointer; }
    tr[tabindex]:hover td, tr[tabindex]:focus-visible td { background: var(--tui-background-neutral-1-hover); }
  `,
})
export class DataTableComponent<T extends { readonly id: number }> {
  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  readonly rowSelected = output<T>();

  readonly orderedColumns = signal<readonly DataTableColumn<T>[]>([]);
  readonly enabledColumns = signal<readonly DataTableColumn<T>[]>([]);
  readonly filterValues = signal<Readonly<Record<string, ColumnFilterState>>>({});
  readonly optionSearch = signal<Readonly<Record<string, string>>>({});
  readonly hasFilters = computed(() => Object.values(this.filterValues()).some((filter) =>
    Boolean(filter.text || filter.list?.length || filter.min != null || filter.max != null || filter.from || filter.to || filter.boolean),
  ));
  readonly listValues = computed(() => Object.fromEntries(
    this.columns().filter((column) => column.type === 'list').map((column) => [
      column.key,
      [...new Set(this.rows().map((row) => this.rawValue(column, row)).filter((value) => value != null).map(String))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })),
    ]),
  ) as Readonly<Record<string, readonly string[]>>);
  readonly filteredRows = computed(() => {
    const filters = this.filterValues();
    return this.rows().filter((row) => this.columns().every((column) =>
      this.matchesFilter(column, row, filters[column.key]),
    ));
  });
  readonly columnKeys = () => this.enabledColumns().map(({ key }) => key);
  readonly trackBy = (row: T): number => row.id;
  readonly columnLabel: TuiStringHandler<TuiContext<DataTableColumn<T>>> = ({ $implicit }) => $implicit.label;
  readonly standaloneModel = { standalone: true } as const;
  readonly booleanOptions = ['Tous', 'Oui', 'Non'] as const;

  ngOnInit(): void {
    this.orderedColumns.set(this.columns());
    this.enabledColumns.set(this.columns());
  }

  defaultSorter(column: DataTableColumn<T>): TuiComparator<T> {
    return (a, b) => String(this.rawValue(column, a)).localeCompare(String(this.rawValue(column, b)), 'fr', { numeric: true });
  }

  reorder(columns: readonly DataTableColumn<T>[]): void {
    this.orderedColumns.set(columns);
    const enabled = new Set(this.enabledColumns());
    this.enabledColumns.set(columns.filter((column) => enabled.has(column)));
  }

  setTextFilter(key: string, text: string): void { this.updateFilter(key, { text }); }
  setListFilter(key: string, list: readonly string[]): void { this.updateFilter(key, { list }); }
  setOptionSearch(key: string, value: string): void {
    this.optionSearch.update((searches) => ({ ...searches, [key]: value }));
  }
  filteredListValues(key: string): readonly string[] {
    const search = this.normalize(this.optionSearch()[key] || '');
    return search
      ? (this.listValues()[key] || []).filter((value) => this.normalize(value).includes(search))
      : (this.listValues()[key] || []);
  }
  setNumberFilter(key: string, bound: 'min' | 'max', value: string): void {
    this.updateFilter(key, { [bound]: value === '' ? undefined : Number(value) });
  }
  setDateFilter(key: string, bound: 'from' | 'to', value: string): void { this.updateFilter(key, { [bound]: value }); }
  setBooleanFilter(key: string, label: string): void {
    this.updateFilter(key, { boolean: label === 'Oui' ? 'true' : label === 'Non' ? 'false' : '' });
  }
  booleanLabel(key: string): string {
    const value = this.filterValues()[key]?.boolean;
    return value === 'true' ? 'Oui' : value === 'false' ? 'Non' : 'Tous';
  }

  initials(value: DataTableValue): string {
    return String(value ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr');
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
  cellLink(column: DataTableColumn<T>, row: T): string | readonly (string | number)[] {
    return column.presentation?.link?.(row) || [];
  }
  cellHref(column: DataTableColumn<T>, row: T): string {
    return column.presentation?.href?.(row) || '';
  }

  clearFilters(): void { this.filterValues.set({}); }

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
      case 'list': return !filter.list?.length || filter.list.some((value) => this.normalize(value) === this.normalize(raw));
      case 'number': {
        const value = Number(raw);
        return !Number.isNaN(value) && (filter.min == null || value >= filter.min) && (filter.max == null || value <= filter.max);
      }
      case 'date': {
        const value = raw == null ? '' : String(raw).slice(0, 10);
        return (!filter.from || value >= filter.from) && (!filter.to || value <= filter.to);
      }
      case 'boolean': return !filter.boolean || String(Boolean(raw)) === filter.boolean;
      default: return !filter.text || this.normalize(raw).includes(this.normalize(filter.text));
    }
  }

  private rawValue(column: DataTableColumn<T>, row: T): DataTableValue {
    return column.filterValue?.(row) ?? column.value(row);
  }

  private normalize(value: DataTableValue): string {
    if (value == null) return '';
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  }
}
