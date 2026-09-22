import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TuiBadge, TuiChip } from '@taiga-ui/kit';
import { HostFamilyMapItem } from './host-families-map.utils';

@Component({
  selector: 'app-host-family-map-cards',
  standalone: true,
  imports: [TuiBadge, TuiChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cards">
      @for (item of families(); track item.family.id) {
        <button
          type="button"
          class="family-card"
          [class.family-card--active]="item.family.id === selectedFamilyId()"
          [id]="'family-card-' + item.family.id"
          (click)="selectFamily.emit(item.family.id)"
        >
          <header>
            <strong>{{ item.family.familyName }}</strong>
            <span size="s" tuiBadge [appearance]="badgeAppearance(item.capacityState)">
              {{ capacityLabel(item.capacityState) }}
            </span>
          </header>
          <p class="meta">
            {{ item.family.city }} · {{ item.family.parish || 'Sans paroisse' }} · {{ item.sector }}
          </p>
          <p class="meta">
            {{ item.assignmentsCount }}/{{ item.family.maxCapacity }} places ·
            {{ item.under18Count }}/{{ item.family.maxUnder18 }}
            mineurs
          </p>
          @if (item.distanceKm !== null) {
            <p class="meta">Distance: {{ formatDistance(item.distanceKm) }} km</p>
          }
          <div class="chips">
            @for (tag of item.family.tags || []; track tag) {
              <span size="s" tuiChip>{{ tag }}</span>
            }
            @for (constraint of item.family.constraints || []; track constraint) {
              <span size="s" tuiChip appearance="warning">{{ constraint }}</span>
            }
          </div>
        </button>
      } @empty {
        <p class="empty">Aucune famille ne correspond aux filtres.</p>
      }
    </div>
  `,
  styles: `
    .cards {
      display: grid;
      gap: 0.75rem;
      align-content: start;
    }
    .family-card {
      display: grid;
      gap: 0.35rem;
      text-align: start;
      border: 1px solid var(--tui-border-normal);
      background: var(--tui-background-base);
      border-radius: 0.9rem;
      padding: 0.8rem 0.9rem;
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.2s ease;
    }
    .family-card:hover {
      box-shadow: var(--tui-shadow-small);
      transform: translateY(-1px);
    }
    .family-card--active {
      border-color: var(--tui-status-info);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--tui-status-info) 20%, transparent);
    }
    .family-card > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .meta {
      margin: 0;
      color: var(--tui-text-secondary);
      font-size: 0.875rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-top: 0.3rem;
    }
    .empty {
      margin: 0.2rem 0;
      color: var(--tui-text-secondary);
    }
  `,
})
export class HostFamilyMapCardsComponent {
  readonly families = input.required<readonly HostFamilyMapItem[]>();
  readonly selectedFamilyId = input<number | null>(null);
  readonly selectFamily = output<number>();

  capacityLabel(state: HostFamilyMapItem['capacityState']): string {
    if (state === 'FULL') return 'Pleine';
    if (state === 'UNDER_USED') return 'Sous-utilisee';
    return 'Disponible';
  }

  badgeAppearance(state: HostFamilyMapItem['capacityState']): 'positive' | 'warning' | 'negative' {
    if (state === 'FULL') return 'negative';
    if (state === 'UNDER_USED') return 'warning';
    return 'positive';
  }

  formatDistance(distanceKm: number): string {
    return distanceKm.toFixed(1);
  }
}
