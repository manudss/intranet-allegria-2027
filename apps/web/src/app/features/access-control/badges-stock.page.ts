import { RouterLink } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { AccessBadge, AccessBadgeStatus, AccessControlApiService } from './access-control-api.service';

const STATUS_LABELS: Record<AccessBadgeStatus, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Attribué',
  LOST: 'Perdu',
  REVOKED: 'Révoqué',
};

@Component({
  selector: 'app-badges-stock',
  standalone: true,
  imports: [...SHARED_IMPORTS,RouterLink],
  template: `
    <main class="page">
      <header class="head">
        <h1>Badges — stock</h1>
        <a tuiButton appearance="secondary" size="s" routerLink="/acces/impression">Générer / Imprimer</a><span class="total">{{ total() }} badge(s)</span>
      </header>

      @if (revokeTarget(); as b) {
        <section class="panel" role="dialog" aria-modal="true" aria-label="Révoquer le badge">
          <h2>Révoquer {{ b.code }}</h2>
          <label>Motif<input type="text" [(ngModel)]="revokeReason" /></label>
          <div class="row"><button tuiButton type="button" [disabled]="!revokeReason.trim()" (click)="confirmRevoke()">Confirmer la révocation</button><button tuiButton appearance="secondary" type="button" (click)="revokeTarget.set(null)">Annuler</button></div>
        </section>
      }
      <section class="panel">
        <h2>Enregistrer un lot</h2>
        <p class="hint">Un code par ligne (code opaque, sans nom). Le stock seul ne suffit pas : chaque badge doit ensuite être attribué.</p>
        <textarea rows="4" [(ngModel)]="stockCodes" placeholder="9f2c1e0a4b6d8f30…&#10;ab12cd34ef56ab78…"></textarea>
        <div class="row">
          <input type="text" [(ngModel)]="stockLot" placeholder="Lot (obligatoire, ex. L2027-A)" />
          <button tuiButton type="button" (click)="registerStock()" [disabled]="saving() || !stockLot.trim()">Enregistrer</button>
        </div>
        @if (stockMsg(); as m) { <p class="ok-msg">{{ m }}</p> }
      </section>

      <section class="panel">
        <div class="filters">
          <select [(ngModel)]="statusFilter" (ngModelChange)="reload()">
            <option value="">Tous statuts</option>
            <option value="AVAILABLE">Disponible</option>
            <option value="ASSIGNED">Attribué</option>
            <option value="LOST">Perdu</option>
            <option value="REVOKED">Révoqué</option>
          </select>
          <input type="text" [(ngModel)]="lotFilter" (ngModelChange)="reload()" placeholder="Lot" />
          <input type="text" [(ngModel)]="qFilter" (ngModelChange)="reload()" placeholder="Début de code" />
        </div>
        @if (loading()) { <tui-loader size="l" /> }
        <table class="tbl">
          <thead><tr><th>Code</th><th>Lot</th><th>Statut</th><th>Créé le</th><th></th></tr></thead>
          <tbody>
            @for (b of items(); track b.id) {
              <tr>
                <td><code>{{ b.code }}</code></td>
                <td>{{ b.lot ?? '—' }}</td>
                <td><span class="chip" [attr.data-s]="b.status">{{ statusLabel(b.status) }}</span></td>
                <td>{{ b.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  @if (b.status === 'AVAILABLE') {
                    <button tuiButton appearance="secondary" size="s" type="button" (click)="revoke(b)">Révoquer</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (!loading() && items().length === 0) { <p class="hint">Aucun badge.</p> }
      </section>
    </main>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .head { display: flex; align-items: baseline; gap: 12px; }
    .head h1 { margin: 0; font-size: 22px; }
    .total { color: var(--tui-text-secondary); font-size: 14px; }
    .panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 10px; }
    .panel h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--tui-text-secondary); }
    .hint { font-size: 13px; color: var(--tui-text-secondary); margin: 0; }
    textarea, input, select { border: 1px solid #d7dbe3; border-radius: 8px; padding: 8px 10px; font-size: 14px; font-family: inherit; }
    textarea { font-family: ui-monospace, monospace; }
    .row, .filters { display: flex; gap: 8px; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
    .tbl th { text-align: left; font-size: 12px; color: var(--tui-text-secondary); padding: 6px 8px; border-bottom: 1px solid #eceef2; }
    .tbl td { padding: 8px; border-bottom: 1px solid #f4f5f7; }
    code { font-family: ui-monospace, monospace; font-size: 12px; }
    .chip { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .chip[data-s='AVAILABLE'] { background: #e3f6ea; color: #1a9e4b; }
    .chip[data-s='ASSIGNED'] { background: #e8ecf7; color: #526ed3; }
    .chip[data-s='LOST'], .chip[data-s='REVOKED'] { background: #fdeaea; color: #d8453a; }
    .ok-msg { color: #1a9e4b; font-size: 13px; margin: 0; }
  `],
})
export class BadgesStockPage implements OnInit {
  private readonly api = inject(AccessControlApiService);

  readonly items = signal<AccessBadge[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly stockMsg = signal<string | null>(null);

  readonly revokeTarget = signal<AccessBadge | null>(null);
  revokeReason = '';

  stockCodes = '';
  stockLot = '';
  statusFilter: AccessBadgeStatus | '' = '';
  lotFilter = '';
  qFilter = '';

  ngOnInit(): void {
    this.reload();
  }

  statusLabel(s: AccessBadgeStatus): string {
    return STATUS_LABELS[s] ?? s;
  }

  reload(): void {
    this.loading.set(true);
    this.api
      .listBadges({
        status: this.statusFilter || undefined,
        lot: this.lotFilter.trim() || undefined,
        q: this.qFilter.trim() || undefined,
        limit: 200,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  registerStock(): void {
    const codes = this.stockCodes.split(/\s+/).map((c) => c.trim()).filter(Boolean);
    if (codes.length === 0) return;
    this.saving.set(true);
    this.stockMsg.set(null);
    this.api.registerStock(this.stockLot.trim(), codes).subscribe({
      next: () => {
        this.saving.set(false);
        this.stockCodes = '';
        this.stockMsg.set(`${codes.length} code(s) enregistré(s).`);
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  revoke(b: AccessBadge): void { this.revokeReason = ''; this.revokeTarget.set(b); }
  confirmRevoke(): void {
    const b = this.revokeTarget();
    if (!b || !this.revokeReason.trim()) return;
    this.api.revokeBadge(b.id, this.revokeReason.trim()).subscribe({ next: () => { this.revokeTarget.set(null); this.reload(); } });
  }
}
