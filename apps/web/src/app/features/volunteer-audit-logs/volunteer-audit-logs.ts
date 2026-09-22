import { Component, inject, signal } from '@angular/core';
import { VolunteerAuditAction, VolunteerAuditLog } from '../../models/models';
import { VolunteerAuditLogsApiService } from '../../services/api.services';
import { DataTableColumn } from '../../shared/data-table';
import { SHARED_IMPORTS } from '../../shared/shared-imports';

@Component({
  selector: 'app-volunteer-audit-logs',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `
    <app-page-layout
      title="Journal des modifications bénévoles"
      description="Suivi des créations, mises à jour et changements de statut"
    >
      <div class="filters">
        <label class="field">
          <span>Du</span>
          <input
            class="input"
            type="datetime-local"
            [value]="from()"
            (change)="from.set($any($event.target).value)"
          />
        </label>
        <label class="field">
          <span>Au</span>
          <input
            class="input"
            type="datetime-local"
            [value]="to()"
            (change)="to.set($any($event.target).value)"
          />
        </label>
        <label class="field">
          <span>Utilisateur (id)</span>
          <input
            class="input"
            type="number"
            min="1"
            [value]="userId()"
            (change)="userId.set($any($event.target).value)"
          />
        </label>
        <label class="field">
          <span>Action</span>
          <select class="input" [value]="action()" (change)="action.set($any($event.target).value)">
            <option value="">Toutes</option>
            @for (value of actions; track value) {
              <option [value]="value">{{ value }}</option>
            }
          </select>
        </label>
        <label class="field wide">
          <span>Type d'entité</span>
          <input
            class="input"
            [value]="entityType()"
            (input)="entityType.set($any($event.target).value)"
            placeholder="volunteer_shifts"
          />
        </label>
        <button tuiButton type="button" (click)="applyFilters()">Filtrer</button>
      </div>

      @if (loading()) {
        <tui-loader />
      } @else {
        <app-data-table [rows]="items()" [columns]="columns" />
        <div class="pager">
          <span>{{ total() }} résultat(s)</span>
          <button
            tuiButton
            appearance="flat"
            type="button"
            [disabled]="offset() === 0"
            (click)="previousPage()"
          >
            Précédent
          </button>
          <button
            tuiButton
            appearance="flat"
            type="button"
            [disabled]="offset() + limit() >= total()"
            (click)="nextPage()"
          >
            Suivant
          </button>
        </div>
      }
    </app-page-layout>
  `,
  styles: [
    `
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 1rem;
        align-items: end;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 180px;
      }
      .wide {
        min-width: 260px;
      }
      .input {
        padding: 0.4rem 0.5rem;
        border: 1px solid var(--tui-border-normal, #ccc);
        border-radius: 4px;
      }
      .pager {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.75rem;
        align-items: center;
      }
    `,
  ],
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
