import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { HostFamily, HostFamilyPayload } from '../../models/models';
import { HostFamiliesApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';
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
      presentation: { type: 'icon', icon: () => '@tui.house' },
    },
    {
      key: 'city',
      label: 'Ville',
      type: 'list',
      value: (x) => `${x.postalCode} ${x.city}`,
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.map-pin' },
    },
    {
      key: 'capacity',
      label: 'Capacité',
      type: 'number',
      value: (x) => `${x.maxCapacity} places`,
      filterValue: (x) => x.maxCapacity,
      sorter: (a, b) => a.maxCapacity - b.maxCapacity,
      presentation: { type: 'number' },
    },
  ];
  private api = inject(HostFamiliesApiService);
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
    this.model.set({
      ...x,
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
