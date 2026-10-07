import { Component, inject, signal } from '@angular/core';
import { VolunteerAuditAction, VolunteerAuditLog } from '../../models/models';
import { VolunteerAuditLogsApiService } from '../../services/api.services';
import { DataTableColumn } from '../../shared/data-table';
import { SHARED_IMPORTS } from '../../shared/shared-imports';

const ACTION_LABELS: Record<VolunteerAuditAction, string> = {
  [VolunteerAuditAction.CREATE]: 'Création',
  [VolunteerAuditAction.UPDATE]: 'Modification',
  [VolunteerAuditAction.DELETE]: 'Suppression',
  [VolunteerAuditAction.STATUS_CHANGED]: 'Changement de statut',
  [VolunteerAuditAction.ASSIGNMENT_CHANGED]: 'Changement d\'affectation',
};

const ACTION_APPEARANCE: Record<VolunteerAuditAction, string> = {
  [VolunteerAuditAction.CREATE]: 'success',
  [VolunteerAuditAction.UPDATE]: 'primary',
  [VolunteerAuditAction.DELETE]: 'danger',
  [VolunteerAuditAction.STATUS_CHANGED]: 'warning',
  [VolunteerAuditAction.ASSIGNMENT_CHANGED]: 'info',
};

function formatDateTime(datetimeStr: string): string {
  const date = new Date(datetimeStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

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
      type: 'date',
      value: (row) => formatDateTime(row.createdAt),
      filterValue: (row) => row.createdAt,
      presentation: { type: 'date' },
    },
    {
      key: 'user',
      label: 'Utilisateur',
      type: 'text',
      value: (row) => row.user?.email ?? 'inconnu',
      presentation: { type: 'icon', icon: () => '@tui.user' },
    },
    {
      key: 'action',
      label: 'Action',
      type: 'list',
      value: (row) => ACTION_LABELS[row.action],
      filterValue: (row) => row.action,
      presentation: {
        type: 'chip',
        appearance: (row) => ACTION_APPEARANCE[row.action],
      },
    },
    {
      key: 'entityType',
      label: 'Type d\'entité',
      type: 'text',
      value: (row) => row.entityType,
      presentation: { type: 'chip', autoColor: true, icon: () => '@tui.tag' },
    },
    {
      key: 'entityId',
      label: 'ID Entité',
      type: 'number',
      value: (row) => row.entityId,
      hidden: true,
      presentation: { type: 'number' },
    },
    {
      key: 'before',
      label: 'Avant',
      type: 'text',
      value: (row) => this.stringify(row.beforeData),
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.history' },
    },
    {
      key: 'after',
      label: 'Après',
      type: 'text',
      value: (row) => this.stringify(row.afterData),
      hidden: true,
      presentation: { type: 'icon', icon: () => '@tui.history' },
    },
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
