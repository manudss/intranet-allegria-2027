import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { HostFamily, HostFamilyPayload, HostFamilyStatus } from '../../models/models';
import { HostFamiliesApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { HostingPlacementApiService } from '../hosting-placement/hosting-placement.api';
import { HostingGroupKind, HostingGroupSummary } from '../hosting-placement/hosting-placement.models';
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
      type: 'list',
      value: (x) => (x.hostingGroupId != null ? (this.groupNames().get(x.hostingGroupId) ?? '—') : 'Sans groupe'),
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
  protected groups = signal<HostingGroupSummary[]>([]);
  protected checkedIds = signal<ReadonlySet<number>>(new Set());
  protected targetGroupId = signal<number | null>(null);
  protected newGroupName = signal('');
  protected newGroupKind = signal<HostingGroupKind>('ZONE');
  protected busy = signal(false);
  protected feedback = signal<{ text: string; error: boolean } | null>(null);
  /** Groupe choisi dans le formulaire (création / modification). */
  protected formGroupId = signal<number | null>(null);
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
    this.reloadGroups();
  }

  private reloadGroups(): void {
    this.hostingApi.listGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.groupNames.set(new Map(groups.map((g) => [g.id, g.name])));
      },
      error: () => undefined,
    });
  }

  private reloadAll(): void {
    this.api.list().subscribe((x) => {
      this.items.set(x);
      const sel = this.selected();
      if (sel) this.selected.set(x.find((i) => i.id === sel.id) ?? null);
    });
    this.reloadGroups();
  }

  protected setChecked(ids: number[]): void {
    this.checkedIds.set(new Set(ids));
  }

  protected clearChecked(): void {
    this.checkedIds.set(new Set());
  }

  private done(text: string, error = false): void {
    this.busy.set(false);
    this.feedback.set({ text, error });
    if (!error) {
      this.checkedIds.set(new Set());
      this.reloadAll();
    }
  }

  private fail(err: { error?: { message?: string | string[] } }): void {
    const m = err?.error?.message;
    this.done(Array.isArray(m) ? m.join(', ') : (m ?? 'Action impossible.'), true);
  }

  private confirmBulk(count: number, label: string): boolean {
    return count < 20 || confirm(`${label} : ${count} lieux concernés. Continuer ?`);
  }

  protected assignChecked(groupId: number | null): void {
    const ids = [...this.checkedIds()];
    if (!ids.length || this.busy() || !this.confirmBulk(ids.length, groupId === null ? 'Retirer du groupe' : 'Affecter au groupe')) return;
    this.busy.set(true);
    this.hostingApi.setFamiliesGroup(ids, groupId).subscribe({
      next: (r) => this.done(groupId === null ? `${r.updated} lieu(x) retiré(s) de leur groupe.` : `${r.updated} lieu(x) affecté(s) au groupe.`),
      error: (e) => this.fail(e),
    });
  }

  protected createGroupAndAssign(): void {
    const name = this.newGroupName().trim();
    const ids = [...this.checkedIds()];
    if (!name || !ids.length || this.busy() || !this.confirmBulk(ids.length, 'Créer le groupe et y affecter')) return;
    this.busy.set(true);
    this.hostingApi.createGroup(name, { kind: this.newGroupKind() }).subscribe({
      next: (g) =>
        this.hostingApi.setFamiliesGroup(ids, g.id).subscribe({
          next: (r) => {
            this.newGroupName.set('');
            this.done(`Groupe « ${g.name} » créé avec ${r.updated} lieu(x).`);
          },
          error: (e) => {
            this.reloadGroups();
            this.fail(e);
          },
        }),
      error: (e) => this.fail(e),
    });
  }

  /** Changement direct du groupe depuis le détail d'un hébergement. */
  protected changeSelectedGroup(value: string): void {
    const fam = this.selected();
    if (!fam || this.busy()) return;
    const groupId = Number(value) || null;
    this.busy.set(true);
    this.hostingApi.setFamilyGroup(fam.id, groupId).subscribe({
      next: () => this.done(groupId === null ? 'Lieu retiré de son groupe.' : 'Groupe du lieu modifié.'),
      error: (e) => this.fail(e),
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
    this.formGroupId.set(null);
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
    this.formGroupId.set(x.hostingGroupId ?? null);
    this.mode.set('edit');
  }
  save() {
    submit(this.familyForm, async () => {
      const req =
        this.mode() === 'create'
          ? this.api.create(this.model())
          : this.api.update(this.requireSelectedFamily().id, this.model());
      const creating = this.mode() === 'create';
      req.subscribe((x) => {
        this.items.update((a) => (creating ? [...a, x] : a.map((i) => (i.id === x.id ? x : i))));
        this.open(x);
        const wanted = this.formGroupId();
        if (wanted !== (x.hostingGroupId ?? null)) {
          this.hostingApi.setFamilyGroup(x.id, wanted).subscribe({
            next: () => this.done('Hébergement enregistré, groupe mis à jour.'),
            error: (e) => this.fail(e),
          });
        }
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
