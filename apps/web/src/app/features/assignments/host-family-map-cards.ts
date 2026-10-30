import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TuiBadge, TuiChip } from '@taiga-ui/kit';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { HostFamilyMapItem, groupColor } from './host-families-map.utils';

@Component({
  selector: 'app-host-family-map-cards',
  standalone: true,
  imports: [TuiBadge, TuiChip, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './host-family-map-cards.html',
  styleUrls: ['./host-family-map-cards.scss'],
})
export class HostFamilyMapCardsComponent {
  readonly families = input.required<readonly HostFamilyMapItem[]>();
  readonly selectedFamilyId = input<number | null>(null);
  readonly checkedIds = input<ReadonlySet<number>>(new Set());
  readonly selectMode = input(false);
  readonly selectFamily = output<number>();
  /** Groupes proposés pour changer le groupe directement depuis la carte. */
  readonly groups = input<readonly { id: number; name: string }[] | null>(null);
  readonly groupChange = output<{ familyId: number; groupId: number | null }>();

  readonly groupOptions = computed<SelectOption<number>[]>(() => [
    { value: 0, label: 'Aucun groupe' },
    ...(this.groups() ?? []).map((g) => ({ value: g.id, label: g.name })),
  ]);

  onGroupPick(familyId: number, value: number | null): void {
    this.groupChange.emit({ familyId, groupId: value || null });
  }

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

  groupTone(item: HostFamilyMapItem): string {
    return groupColor(item.group);
  }

  formatDistance(distanceKm: number): string {
    return distanceKm.toFixed(1);
  }
}
