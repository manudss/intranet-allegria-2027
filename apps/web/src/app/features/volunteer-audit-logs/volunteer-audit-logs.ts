import { Component, inject, signal } from '@angular/core';
import { VolunteerAuditAction, VolunteerAuditLog } from '../../models/models';
import { VolunteerAuditLogsApiService } from '../../services/api.services';
import { DataTableColumn } from '../../shared/data-table';
import { SHARED_IMPORTS } from '../../shared/shared-imports';

@Component({
  selector: 'app-volunteer-audit-logs',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './volunteer-audit-logs.html',
  styleUrls: ['./volunteer-audit-logs.scss'],
})
export class VolunteerAuditLogsPage {
  private readonly api = inject(VolunteerAuditLogsApiService);

  readonly actions = this.api.getActionOptions();
  readonly items = signal<VolunteerAuditLog[]>([]);
  readonly total = signal(0);
  readonly limit = signal(20);
  readonly offset = signal(0);
  readonly loading = signal(true);

  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly userId = signal('');
  protected readonly action = signal<VolunteerAuditAction | ''>('');
  protected readonly entityType = signal('');

  protected readonly columns: readonly DataTableColumn<VolunteerAuditLog>[] = [
    {
      key: 'createdAt',
      label: 'Date',
      type: 'text',
      value: (row) => new Date(row.createdAt).toLocaleString('fr-FR'),
    },
    {
      key: 'user',
      label: 'Utilisateur',
      type: 'text',
      value: (row) => `${row.user?.email ?? 'inconnu'} (#${row.userId})`,
    },
    {
      key: 'action',
      label: 'Action',
      type: 'list',
      value: (row) => row.action,
      presentation: { type: 'chip', autoColor: true },
    },
    {
      key: 'entity',
      label: 'Entité',
      type: 'text',
      value: (row) => `${row.entityType}#${row.entityId}`,
    },
    { key: 'before', label: 'Avant', type: 'text', value: (row) => this.stringify(row.beforeData) },
    { key: 'after', label: 'Après', type: 'text', value: (row) => this.stringify(row.afterData) },
  ];

  constructor() {
    this.load();
  }

  protected applyFilters(): void {
    this.offset.set(0);
    this.load();
  }

  protected previousPage(): void {
    this.offset.set(Math.max(this.offset() - this.limit(), 0));
    this.load();
  }

  protected nextPage(): void {
    this.offset.set(this.offset() + this.limit());
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .list({
        limit: this.limit(),
        offset: this.offset(),
        from: this.toIso(this.from()),
        to: this.toIso(this.to()),
        userId: this.userId().trim() ? Number(this.userId()) : null,
        action: this.action() || null,
        entityType: this.entityType().trim(),
      })
      .subscribe((result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      });
  }

  private stringify(value: Record<string, unknown> | null): string {
    if (!value) {
      return '—';
    }
    const serialized = JSON.stringify(value);
    return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
  }

  private toIso(value: string): string | undefined {
    if (!value.trim()) {
      return undefined;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
}
