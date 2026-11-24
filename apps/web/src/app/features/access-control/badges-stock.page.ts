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
        <label class="fld">Codes des badges (un par ligne)<textarea rows="4" [(ngModel)]="stockCodes" placeholder="9f2c1e0a4b6d8f30…&#10;ab12cd34ef56ab78…"></textarea></label>
        <div class="row">
          <label class="fld">Lot (obligatoire)<input type="text" [(ngModel)]="stockLot" placeholder="ex. L2027-A" /></label>
          <button tuiButton type="button" (click)="registerStock()" [disabled]="saving() || !stockLot.trim()">Enregistrer</button>
        </div>
        @if (stockMsg(); as m) { <p class="ok-msg">{{ m }}</p> }
      </section>

      <section class="panel">
        <div class="filters">
          <label class="fld">Statut<select [(ngModel)]="statusFilter" (ngModelChange)="reload()">
            <option value="">Tous statuts</option>
            <option value="AVAILABLE">Disponible</option>
            <option value="ASSIGNED">Attribué</option>
            <option value="LOST">Perdu</option>
            <option value="REVOKED">Révoqué</option>
          </select></label>
          <label class="fld">Lot<input type="text" [(ngModel)]="lotFilter" (ngModelChange)="reload()" /></label>
          <label class="fld">Début de code<input type="text" [(ngModel)]="qFilter" (ngModelChange)="reload()" /></label>
        </div>
        @if (loading()) { <app-loading-skeleton /> }
        <div class="tbl-scroll" tabindex="0" role="region" aria-label="Liste des badges">
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
        </div>
        @if (!loading() && items().length === 0) { <p class="hint">Aucun badge.</p> }
      </section>
    </main>
  `,
  styles: [`
    .page { padding: 24px; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 12px; }
    .head h1 { margin: 0; font-size: 22px; }
    .total { color: var(--tui-text-secondary); font-size: 14px; }
    .panel { background: var(--appearance-surface); border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 10px; }
    .panel h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--tui-text-secondary); }
    .hint { font-size: 13px; color: var(--tui-text-secondary); margin: 0; }
    textarea, input, select { border: 1px solid var(--appearance-border); border-radius: 8px; padding: 8px 10px; font-size: 14px; font-family: inherit; }
    textarea { font-family: ui-monospace, monospace; }
    .page, .panel { min-width: 0; max-width: 100%; }
    .row, .filters { display: flex; flex-wrap: wrap; gap: 8px; }
    .fld { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; flex: 1 1 10rem; min-width: 0; }
    .fld > input, .fld > select, .fld > textarea { display: block; font-weight: 400; min-width: 0; box-sizing: border-box; }
    .row { align-items: flex-end; }
    .panel > .fld { flex: 0 0 auto; }
    textarea { width: 100%; box-sizing: border-box; }
    .tbl-scroll { max-width: 100%; overflow-x: auto; }
    @media (max-width: 640px) { .page { padding: 12px; } .row > button, .head > a { flex: 1 1 100%; } }
    .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
    .tbl th { text-align: left; font-size: 12px; color: var(--tui-text-secondary); padding: 6px 8px; border-bottom: 1px solid var(--line-soft); }
    .tbl td { padding: 8px; border-bottom: 1px solid var(--line-soft); }
    code { font-family: ui-monospace, monospace; font-size: 12px; }
    .chip { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .chip[data-s='AVAILABLE'] { background: var(--appearance-raised); color: var(--appearance-success); }
    .chip[data-s='ASSIGNED'] { background: var(--appearance-raised); color: var(--appearance-info); }
    .chip[data-s='LOST'], .chip[data-s='REVOKED'] { background: var(--appearance-surface); color: var(--appearance-error); }
    .ok-msg { color: var(--appearance-success); font-size: 13px; margin: 0; }
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
