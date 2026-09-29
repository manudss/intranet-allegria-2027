import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TuiBadge, TuiChip } from '@taiga-ui/kit';
import { HostFamilyMapItem } from './host-families-map.utils';

@Component({
  selector: 'app-host-family-map-cards',
  standalone: true,
  imports: [TuiBadge, TuiChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './host-family-map-cards.html',
  styleUrls: ['./host-family-map-cards.scss'],
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
