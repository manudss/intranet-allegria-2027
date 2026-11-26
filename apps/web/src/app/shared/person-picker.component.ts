import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TuiInput, TuiLabel } from '@taiga-ui/core';
import { EMPTY, Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { SelectFieldComponent, SelectOption } from './select-field.component';

export interface PersonSummary {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  roles: string[];
  teams: string[];
  teamTypes: string[];
}

interface PersonSearchPage {
  items: PersonSummary[];
  total: number;
  hasMore: boolean;
}

type FilterOpt = { code: string; label: string };
const ALL = '';
const MIN_CHARS = 2;
const PAGE = 10;
let nextId = 0;

/** Nom affiché : prénom nom si la fiche bénévole existe, sinon l'email. */
export function personLabel(p: Pick<PersonSummary, 'email' | 'firstName' | 'lastName'>): string {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  return name || p.email;
}

/**
 * Sélecteur de personne (compte) avec recherche côté serveur : rien n'est chargé à l'ouverture,
 * 10 résultats à la fois, filtres optionnels (rôle, type d'équipe, équipe, groupe) dans le même
 * composant. Remplace les listes déroulantes qui chargent tous les comptes.
 * Route : GET /api/users/search (administrateurs et gestionnaires de badges).
 */
@Component({
  selector: 'app-person-picker',
  imports: [FormsModule, TuiLabel, ...TuiInput, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value(); as p) {
      <div class="chosen" data-testid="person-chosen">
        <span class="chosen-label">{{ label() }}</span>
        <span class="chip">
          <span class="chip-text">
            <strong>{{ labelOf(p) }}</strong>
            @if (hasName(p)) {
              <small>{{ p.email }}</small>
            }
          </span>
          <button
            type="button"
            class="chip-clear"
            [attr.aria-label]="'Changer de personne : ' + labelOf(p)"
            data-testid="person-clear"
            (click)="clear()"
          >
            ✕
          </button>
        </span>
      </div>
    } @else {
      <div class="field">
        <tui-textfield iconStart="@tui.search">
          <label tuiLabel [attr.for]="inputId">{{ label() }}</label>
          <input
            tuiInput
            autocomplete="off"
            role="combobox"
            aria-autocomplete="list"
            [id]="inputId"
            [attr.aria-expanded]="open()"
            [attr.aria-controls]="listId"
            [attr.data-testid]="testId()"
            [placeholder]="placeholder()"
            [ngModel]="query()"
            (ngModelChange)="onQuery($event)"
            (focus)="onFocus()"
            (keydown)="onKey($event)"
          />
        </tui-textfield>
        @if (filters()) {
          <button
            type="button"
            class="filters-toggle"
            data-testid="person-filters-toggle"
            [attr.aria-expanded]="filtersOpen()"
            (click)="toggleFilters()"
          >
            Filtres
            @if (activeCount() > 0) {
              ({{ activeCount() }})
            }
          </button>
        }
        @if (filtersOpen()) {
          <div class="filter-panel" data-testid="person-filter-panel">
            <app-select-field
              label="Type d'équipe"
              testId="person-filter-teamType"
              [options]="teamTypeOptions()"
              [value]="teamType()"
              (valueChange)="setFilter('teamType', $event)"
            />
            <app-select-field
              label="Équipe"
              testId="person-filter-team"
              [options]="teamOptions()"
              [value]="teamId()"
              (valueChange)="setFilter('teamId', $event)"
            />
            <app-select-field
              label="Rôle"
              testId="person-filter-role"
              [options]="roleOptions()"
              [value]="role()"
              (valueChange)="setFilter('role', $event)"
            />
            <app-select-field
              label="Groupe de rassemblement"
              testId="person-filter-group"
              [options]="groupOptions()"
              [value]="groupId()"
              (valueChange)="setFilter('groupId', $event)"
            />
            @if (activeCount() > 0) {
              <button type="button" class="link" (click)="resetFilters()">
                Effacer les filtres
              </button>
            }
          </div>
        }
        @if (open()) {
          <div class="list" role="listbox" [id]="listId" [attr.aria-label]="label()">
            @if (loading() && items().length === 0) {
              <div class="state" role="status">Recherche…</div>
            } @else if (error()) {
              <div class="state error" role="alert">{{ error() }}</div>
            } @else if (items().length === 0) {
              <div class="state" role="status">Aucune personne trouvée.</div>
            } @else {
              @for (p of items(); track p.id; let i = $index) {
                <button
                  type="button"
                  role="option"
                  class="row"
                  [class.active]="i === active()"
                  [attr.aria-selected]="i === active()"
                  data-testid="person-option"
                  (mousedown)="$event.preventDefault()"
                  (click)="choose(p)"
                >
                  <span class="who">
                    <strong>{{ labelOf(p) }}</strong>
                    @if (hasName(p)) {
                      <small>{{ p.email }}</small>
                    }
                  </span>
                  <span class="tags">
                    @for (t of tagsOf(p); track t) {
                      <span class="tag">{{ t }}</span>
                    }
                  </span>
                </button>
              }
              <div class="foot" role="status">
                {{ items().length }} sur {{ total() }}
                @if (hasMore()) {
                  ·
                  <button type="button" class="link" data-testid="person-more" (click)="more()">
                    Voir plus
                  </button>
                } @else if (total() > items().length) {
                  · affinez la recherche
                }
              </div>
            }
          </div>
        }
        @if (!open() && !filtersOpen()) {
          <span class="hint">Tapez au moins {{ minChars }} lettres ou utilisez les filtres.</span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      min-inline-size: 16rem;
    }
    .field {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .filters-toggle,
    .link {
      align-self: flex-start;
      background: none;
      border: 0;
      padding: 0;
      font: inherit;
      font-size: 0.8125rem;
      color: var(--tui-text-action, #1e5bd8);
      cursor: pointer;
    }
    .filter-panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 0.5rem;
    }
    .list {
      position: absolute;
      inset-inline: 0;
      inset-block-start: 3.25rem;
      z-index: 10;
      max-block-size: 22rem;
      overflow: auto;
      background: var(--tui-background-elevation-1, #fff);
      border: 1px solid var(--tui-border-normal, #ccc);
      border-radius: 0.75rem;
      box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 20%);
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      inline-size: 100%;
      padding: 0.5rem 0.75rem;
      background: none;
      border: 0;
      border-block-end: 1px solid var(--tui-border-normal, #eee);
      font: inherit;
      text-align: start;
      color: inherit;
      cursor: pointer;
    }
    .row:hover,
    .row.active {
      background: var(--tui-background-neutral-1-hover, #eef3ff);
    }
    .who,
    .chip-text {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    small {
      color: var(--tui-text-secondary, #666);
    }
    .tags {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .tag {
      font-size: 0.6875rem;
      padding: 0.125rem 0.5rem;
      border-radius: 99px;
      background: var(--tui-background-neutral-1, #eee);
    }
    .state,
    .foot {
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      color: var(--tui-text-secondary, #666);
    }
    .state.error {
      color: var(--tui-text-negative, #b00020);
    }
    .hint {
      font-size: 0.75rem;
      color: var(--tui-text-secondary, #666);
    }
    .chosen {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .chosen-label {
      font-size: 0.875rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      align-self: flex-start;
      padding: 0.375rem 0.5rem 0.375rem 0.875rem;
      border: 1px solid var(--tui-border-focus, #1e5bd8);
      border-radius: 99px;
      background: var(--tui-background-neutral-1, #eef3ff);
    }
    .chip-clear {
      background: none;
      border: 0;
      cursor: pointer;
      font: inherit;
      padding: 0.25rem;
    }
  `,
})
export class PersonPickerComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input('Personne');
  readonly placeholder = input('Nom ou email');
  readonly testId = input<string | null>('person-picker');
  /** Affiche le bouton « Filtres » (type d'équipe, équipe, rôle, groupe). */
  readonly filters = input(true);
  readonly value = input<PersonSummary | null>(null);
  readonly valueChange = output<PersonSummary | null>();

  protected readonly minChars = MIN_CHARS;
  protected readonly inputId = `app-person-picker-${nextId++}`;
  protected readonly listId = `${this.inputId}-list`;

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<PersonSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly active = signal(0);

  protected readonly filtersOpen = signal(false);
  protected readonly teamType = signal<string | number | null>(ALL);
  protected readonly teamId = signal<string | number | null>(ALL);
  protected readonly role = signal<string | number | null>(ALL);
  protected readonly groupId = signal<string | number | null>(ALL);
  private readonly roles = signal<FilterOpt[]>([]);
  private readonly teamTypes = signal<FilterOpt[]>([]);
  private readonly teams = signal<{ id: number; name: string }[]>([]);
  private readonly groups = signal<{ id: number; name: string }[]>([]);
  private optionsLoaded = false;

  private readonly search$ = new Subject<{ offset: number }>();

  protected readonly activeCount = computed(
    () =>
      [this.teamType(), this.teamId(), this.role(), this.groupId()].filter(
        (v) => v !== ALL && v !== null,
      ).length,
  );
  protected readonly teamTypeOptions = computed(() =>
    this.withAll(this.teamTypes().map((t) => ({ value: t.code, label: t.label }))),
  );
  protected readonly roleOptions = computed(() =>
    this.withAll(this.roles().map((r) => ({ value: r.code, label: r.label || r.code }))),
  );
  protected readonly teamOptions = computed(() =>
    this.withAll(this.teams().map((t) => ({ value: t.id, label: t.name }))),
  );
  protected readonly groupOptions = computed(() =>
    this.withAll(this.groups().map((g) => ({ value: g.id, label: g.name }))),
  );

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        tap(() => {
          this.error.set(null);
          this.loading.set(true);
        }),
        // switchMap annule la requête précédente : une réponse tardive n'écrase jamais la dernière.
        switchMap(({ offset }) => {
          if (!this.canSearch()) {
            this.loading.set(false);
            this.items.set([]);
            this.total.set(0);
            this.hasMore.set(false);
            return EMPTY;
          }
          return this.http
            .get<PersonSearchPage>('/api/users/search', { params: this.params(offset) })
            .pipe(
              tap((page) => {
                this.items.update((cur) => (offset === 0 ? page.items : [...cur, ...page.items]));
                this.total.set(page.total);
                this.hasMore.set(page.hasMore);
                if (offset === 0) this.active.set(0);
                this.loading.set(false);
              }),
              catchError(() => {
                this.loading.set(false);
                this.error.set('Recherche impossible. Réessayez.');
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected labelOf(p: PersonSummary): string {
    return personLabel(p);
  }
  protected hasName(p: PersonSummary): boolean {
    return Boolean(p.firstName || p.lastName);
  }
  protected tagsOf(p: PersonSummary): string[] {
    return [...p.teamTypes, ...p.teams, ...p.roles].slice(0, 4);
  }

  protected onFocus(): void {
    this.open.set(this.canSearch());
    if (this.canSearch() && this.items().length === 0) this.run(0);
  }

  protected onQuery(text: string): void {
    this.query.set(text);
    this.refresh();
  }

  protected toggleFilters(): void {
    const next = !this.filtersOpen();
    this.filtersOpen.set(next);
    if (next) this.loadOptions();
  }

  protected setFilter(
    key: 'teamType' | 'teamId' | 'role' | 'groupId',
    v: string | number | null,
  ): void {
    this[key].set(v ?? ALL);
    this.refresh();
  }

  protected resetFilters(): void {
    this.teamType.set(ALL);
    this.teamId.set(ALL);
    this.role.set(ALL);
    this.groupId.set(ALL);
    this.refresh();
  }

  protected more(): void {
    this.run(this.items().length);
  }

  protected choose(p: PersonSummary): void {
    this.open.set(false);
    this.query.set('');
    this.items.set([]);
    this.filtersOpen.set(false);
    this.valueChange.emit(p);
  }

  protected clear(): void {
    this.valueChange.emit(null);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.items().length;
    if (e.key === 'ArrowDown' && n > 0) {
      e.preventDefault();
      this.open.set(true);
      this.active.set((this.active() + 1) % n);
    } else if (e.key === 'ArrowUp' && n > 0) {
      e.preventDefault();
      this.active.set((this.active() - 1 + n) % n);
    } else if (e.key === 'Enter' && this.open() && n > 0) {
      e.preventDefault();
      this.choose(this.items()[this.active()]);
    } else if (e.key === 'Escape') {
      this.open.set(false);
    }
  }

  private canSearch(): boolean {
    return this.query().trim().length >= MIN_CHARS || this.activeCount() > 0;
  }

  private refresh(): void {
    this.open.set(this.canSearch());
    if (!this.canSearch()) {
      this.items.set([]);
      this.total.set(0);
      this.hasMore.set(false);
    }
    this.run(0);
  }

  private run(offset: number): void {
    this.search$.next({ offset });
  }

  private params(offset: number): HttpParams {
    let p = new HttpParams().set('limit', PAGE).set('offset', offset);
    const q = this.query().trim();
    if (q.length >= MIN_CHARS) p = p.set('q', q);
    const add = (k: string, v: string | number | null) => {
      if (v !== ALL && v !== null) p = p.set(k, String(v));
    };
    add('teamType', this.teamType());
    add('teamId', this.teamId());
    add('role', this.role());
    add('groupId', this.groupId());
    return p;
  }

  private withAll<T extends string | number>(
    opts: SelectOption<T>[],
  ): SelectOption<string | number | null>[] {
    return [{ value: ALL, label: 'Tous' }, ...opts];
  }

  /** Listes de filtres : chargées seulement à la première ouverture du panneau. */
  private loadOptions(): void {
    if (this.optionsLoaded) return;
    this.optionsLoaded = true;
    const get = <T>(url: string, set: (v: T[]) => void) =>
      this.http.get<T[]>(url).subscribe({ next: set, error: () => undefined });
    get<FilterOpt & { isActive?: boolean }>('/api/volunteer-team-types', (v) =>
      this.teamTypes.set(v.filter((t) => t.isActive !== false)),
    );
    get<FilterOpt>('/api/roles', (v) => this.roles.set(v));
    get<{ id: number; name: string; isActive?: boolean }>('/api/volunteer-teams', (v) =>
      this.teams.set(v.filter((t) => t.isActive !== false)),
    );
    get<{ id: number; name: string }>('/api/groups', (v) => this.groups.set(v));
  }
}
