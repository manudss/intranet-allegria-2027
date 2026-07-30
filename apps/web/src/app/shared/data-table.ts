import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TuiComparator, TuiReorder, TuiTable } from '@taiga-ui/addon-table';
import { TuiContext, TuiStringHandler } from '@taiga-ui/cdk';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';

export interface DataTableColumn<T> {
  readonly key: string;
  readonly label: string;
  readonly value: (row: T) => string | number;
  readonly sorter?: TuiComparator<T>;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [TuiButton, ...TuiInput, TuiReorder, TuiTable, TuiTextfield],
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
              <th
                *tuiHead="column.key"
                tuiTh
                [sorter]="column.sorter || defaultSorter(column)"
                [resizable]="true"
                [sticky]="true"
                [minWidth]="140"
              >
                <span>{{ column.label }}</span>
                <tui-textfield class="column-filter" (click)="$event.stopPropagation()">
                  <input
                    tuiInput
                    type="search"
                    [attr.aria-label]="'Filtrer la colonne ' + column.label"
                    [placeholder]="'Filtrer…'"
                    [value]="filterValues()[column.key] || ''"
                    (input)="setFilter(column.key, $any($event.target).value)"
                  />
                </tui-textfield>
              </th>
            }
          </tr>
        </thead>
        @let sortedRows = filteredRows() | tuiTableSort;
        <tbody tuiTbody [data]="sortedRows">
          @for (row of sortedRows; track trackBy(row)) {
            <tr
              tuiTr
              tabindex="0"
              (click)="rowSelected.emit(row)"
              (keydown.enter)="rowSelected.emit(row)"
              (keydown.space)="selectFromKeyboard($event, row)"
            >
              @for (column of enabledColumns(); track column.key) {
                <td *tuiCell="column.key" tuiTd>{{ column.value(row) }}</td>
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
    .column-filter { min-inline-size: 8rem; font-weight: normal; }
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
  readonly filterValues = signal<Readonly<Record<string, string>>>({});
  readonly hasFilters = computed(() => Object.values(this.filterValues()).some(Boolean));
  readonly filteredRows = computed(() => {
    const filters = this.filterValues();

    return this.rows().filter((row) =>
      this.columns().every((column) => {
        const filter = this.normalize(filters[column.key] || '');

        return !filter || this.normalize(column.value(row)).includes(filter);
      }),
    );
  });
  readonly columnKeys = () => this.enabledColumns().map(({ key }) => key);
  readonly trackBy = (row: T): number => row.id;
  readonly columnLabel: TuiStringHandler<TuiContext<DataTableColumn<T>>> = ({ $implicit }) =>
    $implicit.label;

  ngOnInit(): void {
    this.orderedColumns.set(this.columns());
    this.enabledColumns.set(this.columns());
  }

  defaultSorter(column: DataTableColumn<T>): TuiComparator<T> {
    return (a, b) => String(column.value(a)).localeCompare(String(column.value(b)), 'fr', { numeric: true });
  }

  reorder(columns: readonly DataTableColumn<T>[]): void {
    this.orderedColumns.set(columns);
    const enabled = new Set(this.enabledColumns());
    this.enabledColumns.set(columns.filter((column) => enabled.has(column)));
  }

  setFilter(key: string, value: string): void {
    this.filterValues.update((filters) => ({ ...filters, [key]: value }));
  }

  clearFilters(): void {
    this.filterValues.set({});
  }

  selectFromKeyboard(event: Event, row: T): void {
    event.preventDefault();
    this.rowSelected.emit(row);
  }

  private normalize(value: string | number): string {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  }
}
