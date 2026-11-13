import { Component, OnInit, inject, signal } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { AccessAuditEntry, AccessControlApiService } from './access-control-api.service';

export const ACCESS_AUDIT_ACTIONS = ['BADGE_STOCK_ADDED', 'BADGE_ASSIGNED', 'BADGE_REPLACED', 'BADGE_REVOKED', 'SCANNER_GRANTED', 'SCANNER_REVOKED', 'SCAN_SESSION_STARTED', 'SCAN_SESSION_CLOSED', 'UNKNOWN_CODE_LOOKUP', 'LOOKUP_RATE_LIMITED', 'CONFIG_CHANGED'];

@Component({
  selector: 'app-access-audit',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `
    <main class="page">
      <header class="head"><h1>Journal du contrôle d'accès</h1></header>
      <section class="panel">
        <div class="filters">
          <select [(ngModel)]="action" (ngModelChange)="filterChanged()">
            <option value="">Toutes actions</option>
            @for (a of actions; track a) { <option [value]="a">{{ a }}</option> }
          </select>
          <input type="text" [(ngModel)]="userId" (ngModelChange)="filterChanged()" placeholder="ID utilisateur" />
        </div>
        @if (loading()) { <tui-loader size="l" /> }
        <table class="tbl">
          <thead><tr><th>Date</th><th>Action</th><th>Utilisateur</th><th>Objet</th><th>Identifiant</th><th>Détail</th></tr></thead>
          <tbody>
            @for (e of items(); track e.id) {
              <tr>
                <td>{{ e.createdAt | date: 'dd/MM HH:mm:ss' }}</td>
                <td><code>{{ e.action }}</code></td>
                <td>{{ e.userId ?? '—' }}</td>
                <td>{{ e.entityType }}</td>
                <td>{{ e.entityId ?? '—' }}</td>
                <td class="detail">{{ e.details ? (e.details | json) : '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (!loading() && items().length === 0) { <p class="hint">Aucune entrée.</p> }
        <div class="pager">
          <span>{{ total() }} entrée(s)</span>
          <button tuiButton appearance="secondary" size="s" type="button" [disabled]="offset() === 0" (click)="page(-1)">← Préc.</button>
          <button tuiButton appearance="secondary" size="s" type="button" [disabled]="offset() + limit >= total()" (click)="page(1)">Suiv. →</button>
        </div>
      </section>
    </main>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .head h1 { margin: 0; font-size: 22px; }
    .panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 10px; }
    .filters { display: flex; gap: 8px; }
    input, select { border: 1px solid #d7dbe3; border-radius: 8px; padding: 8px 10px; font-size: 14px; font-family: inherit; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tbl th { text-align: left; font-size: 12px; color: var(--tui-text-secondary); padding: 6px 8px; border-bottom: 1px solid #eceef2; }
    .tbl td { padding: 8px; border-bottom: 1px solid #f4f5f7; vertical-align: top; }
    code { font-family: ui-monospace, monospace; font-size: 11px; }
    .detail { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: normal; overflow-wrap: anywhere; font-family: ui-monospace, monospace; font-size: 11px; }
    .pager { display: flex; align-items: center; gap: 10px; justify-content: flex-end; font-size: 13px; color: var(--tui-text-secondary); }
    .hint { font-size: 13px; color: var(--tui-text-secondary); margin: 0; }
  `],
})
export class AccessAuditPage implements OnInit {
  private readonly api = inject(AccessControlApiService);
  readonly actions = ACCESS_AUDIT_ACTIONS;
  readonly limit = 50;

  readonly items = signal<AccessAuditEntry[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(true);

  action = '';
  userId = '';

  ngOnInit(): void {
    this.reload();
  }

  filterChanged(): void { this.offset.set(0); this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.api
      .audit({ action: this.action || undefined, userId: this.userId.trim() || undefined, limit: this.limit, offset: this.offset() })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  page(dir: number): void {
    this.offset.set(Math.max(0, this.offset() + dir * this.limit));
    this.reload();
  }
}
