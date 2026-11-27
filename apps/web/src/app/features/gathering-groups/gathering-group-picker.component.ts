import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import {
  CATEGORY_LABELS,
  GATHERING_CATEGORIES,
  GROUP_STATE_LABELS,
  GatheringCategory,
  GatheringGroupOption,
  GroupState,
  TRACK_LABELS,
  Track,
  groupState,
} from './gathering-groups.models';

type PisteFilter = Track | 'NONE' | 'ALL';

/**
 * Sélecteur évolué de groupe de rassemblement : recherche et filtres (type, piste du créneau lié,
 * répartition, état), chaque ligne affichant type, lieu, équipes, personnes, capacité et créneau
 * déjà lié. Le choix émet le groupe ; l'appelant décide de l'action.
 */
@Component({
  selector: 'app-gathering-group-picker',
  standalone: true,
  imports: [FormsModule, RouterLink, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <div class="filters">
        <label class="search">
          <span>Rechercher un groupe</span>
          <input type="text" [ngModel]="query()" (ngModelChange)="query.set($event)" name="picker-query" placeholder="Nom, lieu ou répartition…" />
        </label>
        <app-select-field label="Type" [options]="typeOptions" [value]="type()" (valueChange)="type.set($event ?? 'ALL')" />
        <app-select-field label="Piste du créneau lié" [options]="pisteOptions" [value]="piste()" (valueChange)="piste.set($event ?? 'ALL')" />
        <app-select-field label="Répartition" [options]="repartitionOptions()" [value]="repartition()" (valueChange)="repartition.set($event ?? 'ALL')" />
        <app-select-field label="État" [options]="stateOptions" [value]="state()" (valueChange)="state.set($event ?? 'ALL')" />
      </div>
      <p class="count">{{ filtered().length }} groupe{{ filtered().length > 1 ? 's' : '' }} sur {{ options().length }}</p>
      <ul class="results" role="listbox" aria-label="Groupes de rassemblement">
        @for (g of filtered(); track g.groupId) {
          <li class="row" [class.linked]="isLinked(g)">
            <div class="main">
              <span class="cat" [class]="'cat cat-' + g.category.toLowerCase()">{{ categoryLabels[g.category] }}</span>
              <strong>{{ g.name }}</strong>
              @if (g.location) { <span class="muted">{{ g.location }}</span> }
              <span class="muted">{{ g.repartitionName }}</span>
            </div>
            <div class="meta">
              <span>{{ g.teamCount }} équipe{{ g.teamCount > 1 ? 's' : '' }}</span>
              <span>{{ g.persons }}/{{ g.capacity ?? '∞' }} pers.</span>
              <span class="state" [class]="'state s-' + stateOf(g).toLowerCase()">{{ stateLabels[stateOf(g)] }}</span>
              @for (s of g.sequences; track s.id) {
                <span class="muted">Lié à {{ s.eventDate }} {{ s.startTime }} · {{ s.title }} ({{ trackLabels[s.track] }})</span>
              } @empty {
                <span class="muted">Aucun créneau lié</span>
              }
            </div>
            <div class="actions">
              <a [routerLink]="['/groupes-rassemblement', 'groupes', g.groupId]" target="_blank">Fiche</a>
              <button type="button" [disabled]="disabled() || isLinked(g)" (click)="pick.emit(g)">
                {{ isLinked(g) ? 'Déjà lié' : 'Lier ce groupe à ce créneau' }}
              </button>
            </div>
          </li>
        } @empty {
          <li class="empty">Aucun groupe ne correspond aux filtres.</li>
        }
      </ul>
    </div>
  `,
  styles: `
    .picker { display: grid; gap: .5rem; }
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: .5rem; align-items: end; }
    .search { display: grid; gap: .15rem; font-size: .8rem; }
    .search input { padding: .55rem .6rem; border-radius: .6rem; border: 1px solid var(--appearance-border, #ccc); font: inherit; }
    .count { margin: 0; font-size: .8rem; color: var(--appearance-muted, #666); }
    .results { list-style: none; margin: 0; padding: 0; display: grid; gap: .35rem; max-block-size: 22rem; overflow: auto; }
    .row { display: grid; gap: .25rem; padding: .5rem .6rem; border-radius: .6rem; background: var(--appearance-raised, #fafafa); border: 1px solid var(--appearance-border, #ddd); }
    .row.linked { opacity: .65; }
    .main, .meta, .actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; font-size: .85rem; }
    .actions { justify-content: flex-end; }
    .muted { color: var(--appearance-muted, #666); }
    .cat { font-weight: 700; font-size: .8rem; }
    .cat-ta { color: #fe0002; } .cat-es { color: #00b2b2; } .cat-mixte { color: #6b5f52; }
    .state { border-radius: 1rem; padding: .05rem .5rem; background: var(--appearance-surface, #eee); font-size: .75rem; }
    .s-full { color: #c62828; } .s-almost { color: #8a6d1a; }
    .empty { color: var(--appearance-muted, #666); padding: .5rem; }
    button { cursor: pointer; }
  `,
})
export class GatheringGroupPickerComponent {
  readonly options = input.required<GatheringGroupOption[]>();
  readonly currentSequenceId = input<number | null>(null);
  readonly disabled = input(false);
  readonly pick = output<GatheringGroupOption>();

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly trackLabels = TRACK_LABELS;
  protected readonly stateLabels = GROUP_STATE_LABELS;

  protected readonly query = signal('');
  protected readonly type = signal<GatheringCategory | 'ALL'>('ALL');
  protected readonly piste = signal<PisteFilter>('ALL');
  protected readonly repartition = signal<number | 'ALL'>('ALL');
  protected readonly state = signal<GroupState | 'ALL'>('ALL');

  protected readonly typeOptions: SelectOption<GatheringCategory | 'ALL'>[] = [
    { value: 'ALL', label: 'Tous les types' },
    ...GATHERING_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
  ];
  protected readonly pisteOptions: SelectOption<PisteFilter>[] = [
    { value: 'ALL', label: 'Toutes les pistes' },
    { value: 'TA', label: 'TA' },
    { value: 'ES', label: 'ES' },
    { value: 'COMMON', label: 'Temps commun' },
    { value: 'NONE', label: 'Non lié à un créneau' },
  ];
  protected readonly stateOptions: SelectOption<GroupState | 'ALL'>[] = [
    { value: 'ALL', label: 'Tous les états' },
    ...(Object.keys(GROUP_STATE_LABELS) as GroupState[]).map((s) => ({ value: s, label: GROUP_STATE_LABELS[s] })),
  ];
  protected readonly repartitionOptions = computed<SelectOption<number | 'ALL'>[]>(() => {
    const seen = new Map<number, string>();
    for (const o of this.options()) seen.set(o.repartitionId, o.repartitionName);
    return [
      { value: 'ALL', label: 'Toutes les répartitions' },
      ...[...seen].map(([value, label]) => ({ value, label })),
    ];
  });

  protected isLinked(g: GatheringGroupOption): boolean {
    return g.sequences.some((s) => s.id === this.currentSequenceId());
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const type = this.type();
    const piste = this.piste();
    const rep = this.repartition();
    const state = this.state();
    return this.options().filter(
      (g) =>
        (!q || `${g.name} ${g.location ?? ''} ${g.repartitionName}`.toLowerCase().includes(q)) &&
        (type === 'ALL' || g.category === type) &&
        (piste === 'ALL' || (piste === 'NONE' ? g.sequences.length === 0 : g.sequences.some((s) => s.track === piste))) &&
        (rep === 'ALL' || g.repartitionId === rep) &&
        (state === 'ALL' || groupState(g) === state),
    );
  });

  protected stateOf(g: GatheringGroupOption): GroupState {
    return groupState(g);
  }
}
