import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { HostFamily, HostFamilyPayload, HostFamilyStatus } from '../../models/models';
import { HostFamiliesApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { HostingPlacementApiService } from '../hosting-placement/hosting-placement.api';
import { DataTableColumn } from '../../shared/data-table';

const STATUS_LABELS: Record<HostFamilyStatus, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validée',
  INACTIVE: 'Inactive',
};

const STATUS_APPEARANCE: Record<HostFamilyStatus, string> = {
  DRAFT: 'neutral',
  VALIDATED: 'success',
  INACTIVE: 'danger',
};

const blank = (): HostFamilyPayload => ({
  familyName: '',
  address: '',
  postalCode: '',
  city: '',
  phone: '',
  email: '',
  maxCapacity: 1,
  maxUnder18: 0,
  parish: '',
  notes: '',
  latitude: null,
  longitude: null,
  maxAnimators: null,
  constraints: null,
  tags: null,
  status: 'DRAFT',
  accommodationType: 'FAMILY',
});
@Component({
  selector: 'app-host-families',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './host-families.html',
  styleUrl: '../../shared/crud.scss',
})
export class HostFamiliesPage implements OnInit {
  protected readonly tableColumns: readonly DataTableColumn<HostFamily>[] = [
    {
      key: 'family',
      label: 'Famille',
      type: 'text',
      value: (x) => x.familyName,
      presentation: { type: 'icon', icon: () => '@tui.users' },
      size: 'large',
    },
    {
      key: 'status',
      label: 'Statut',
      type: 'list',
      value: (x) => STATUS_LABELS[x.status],
      filterValue: (x) => x.status,
      presentation: {
        type: 'chip',
        appearance: (x) => STATUS_APPEARANCE[x.status],
      },
      size: 'small',
    },
    {
      key: 'city',
      label: 'Ville',
      type: 'list',
      value: (x) => `${x.postalCode} ${x.city}`,
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.map-pin' },
      size: 'medium',
    },
    {
      key: 'address',
      label: 'Adresse',
      type: 'text',
      value: (x) => x.address || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.home' },
      size: 'xlarge',
    },
    {
      key: 'phone',
      label: 'Téléphone',
      type: 'text',
      value: (x) => x.phone || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.phone' },
      size: 'small',
    },
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      value: (x) => x.email || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.mail' },
      size: 'large',
    },
    {
      key: 'accommodationType',
      label: 'Type',
      type: 'text',
      value: (x) => (x.accommodationType === 'COLLECTIVE' ? 'Collectif' : 'Famille'),
      size: 'small',
    },
    {
      key: 'hostingGroup',
      label: 'Groupe',
      type: 'text',
      value: (x) => (x.hostingGroupId != null ? (this.groupNames().get(x.hostingGroupId) ?? '—') : '—'),
      size: 'medium',
    },
    {
      key: 'maxCapacity',
      label: 'Capacité max',
      type: 'number',
      value: (x) => x.maxCapacity,
      sorter: (a, b) => a.maxCapacity - b.maxCapacity,
      hidden: true,
      presentation: { type: 'number' },
      size: 'xsmall',
    },
    {
      key: 'maxUnder18',
      label: 'Max -18 ans',
      type: 'number',
      value: (x) => x.maxUnder18,
      sorter: (a, b) => a.maxUnder18 - b.maxUnder18,
      hidden: true,
      presentation: { type: 'number' },
      size: 'xsmall',
    },
    {
      key: 'maxAnimators',
      label: 'Max animateurs',
      type: 'number',
      value: (x) => x.maxAnimators ?? '—',
      sorter: (a, b) => (a.maxAnimators ?? 0) - (b.maxAnimators ?? 0),
      hidden: true,
      presentation: { type: 'number' },
      size: 'xsmall',
    },
    {
      key: 'parish',
      label: 'Paroisse',
      type: 'text',
      value: (x) => x.parish || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.map-pin' },
      size: 'medium',
    },
    {
      key: 'latitude',
      label: 'Latitude',
      type: 'number',
      value: (x) => x.latitude ?? '—',
      hidden: true,
      size: 'xsmall',
    },
    {
      key: 'longitude',
      label: 'Longitude',
      type: 'number',
      value: (x) => x.longitude ?? '—',
      hidden: true,
      size: 'xsmall',
    },
    {
      key: 'constraints',
      label: 'Contraintes',
      type: 'text',
      value: (x) => (x.constraints ? x.constraints.join(', ') : '—'),
      hidden: true,
      presentation: { type: 'chips', autoColor: true, values: (x) => x.constraints || [] },
      size: 'xlarge',
    },
    {
      key: 'tags',
      label: 'Tags',
      type: 'text',
      value: (x) => (x.tags ? x.tags.join(', ') : '—'),
      hidden: true,
      presentation: { type: 'chips', autoColor: true, values: (x) => x.tags || [] },
      size: 'xlarge',
    },
    {
      key: 'notes',
      label: 'Notes',
      type: 'text',
      value: (x) => x.notes || '—',
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.note' },
      size: 'xlarge',
    },
  ];
  private api = inject(HostFamiliesApiService);
  private hostingApi = inject(HostingPlacementApiService);
  protected groupNames = signal(new Map<number, string>());
  items = signal<HostFamily[]>([]);
  query = signal('');
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit'>('detail');
  selected = signal<HostFamily | null>(null);
  model = signal<HostFamilyPayload>(blank());
  familyForm = form(this.model, (p) => {
    required(p.familyName);
    required(p.address);
    required(p.postalCode);
    required(p.city);
    min(p.maxCapacity, 1);
    min(p.maxUnder18, 0);
  });
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    return this.items().filter((x) =>
      `${x.familyName} ${x.city} ${x.postalCode}`.toLowerCase().includes(q),
    );
  });
  ngOnInit() {
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((x) => this.items.set(x));
    this.hostingApi.listGroups().subscribe({
      next: (groups) => this.groupNames.set(new Map(groups.map((g) => [g.id, g.name]))),
      error: () => undefined,
    });
  }

  protected groupNameOf(x: HostFamily | null): string {
    const id = x?.hostingGroupId;
    return typeof id === 'number' ? (this.groupNames().get(id) ?? '—') : '—';
  }

  protected setType(value: string): void {
    const type = value === 'COLLECTIVE' ? 'COLLECTIVE' : 'FAMILY';
    this.model.update((m) => ({ ...m, accommodationType: type }));
  }
  open(x: HostFamily) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
  }
  create() {
    this.model.set(blank());
    this.mode.set('create');
    this.opened.set(true);
  }
  edit() {
    const x = this.requireSelectedFamily();
    // hostingGroupId est en lecture seule ici (le groupe se gère depuis la carte ou le placement).
    const { hostingGroupId: _ignored, ...rest } = x;
    void _ignored;
    this.model.set({
      ...rest,
      phone: x.phone ?? '',
      email: x.email ?? '',
      parish: x.parish ?? '',
      notes: x.notes ?? '',
    });
    this.mode.set('edit');
  }
  save() {
    submit(this.familyForm, async () => {
      const req =
        this.mode() === 'create'
          ? this.api.create(this.model())
          : this.api.update(this.requireSelectedFamily().id, this.model());
      req.subscribe((x) => {
        this.items.update((a) =>
          this.mode() === 'create' ? [...a, x] : a.map((i) => (i.id === x.id ? x : i)),
        );
        this.open(x);
      });
    });
  }
  remove() {
    const x = this.requireSelectedFamily();
    if (confirm(`Supprimer ${x.familyName} ?`))
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
  private requireSelectedFamily(): HostFamily {
    const family = this.selected();
    if (!family) {
      throw new Error('No host family selected');
    }
    return family;
  }
}
