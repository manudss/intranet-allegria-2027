import { Component, OnInit, inject, signal } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { AccessControlApiService, ScannerGrant } from './access-control-api.service';

@Component({
  selector: 'app-scanner-grants',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `
    <main class="page">
      <header class="head"><h1>Habilitations scan</h1></header>
      <section class="panel">
        <h2>Nouvelle habilitation</h2>
        <p class="hint">Donne le rôle de scan à un utilisateur, pour un point précis ou tous les points, avec une fin de validité.</p>
        <div class="grid">
          <input type="text" [(ngModel)]="userId" placeholder="ID utilisateur" />
          <select [(ngModel)]="pointId">
            <option value="">Tous les points</option>
            @for (pt of points(); track pt.id) { <option [value]="pt.id">{{ pt.label }}</option> }
          </select>
          <input type="datetime-local" [(ngModel)]="startsAt" />
          <input type="datetime-local" [(ngModel)]="expiresAt" />
          <button tuiButton type="button" (click)="create()" [disabled]="!userId.trim() || !expiresAt">Créer</button>
        </div>
        @if (msg(); as m) { <p class="ok-msg">{{ m }}</p> }
      </section>
      <section class="panel">
        <h2>Habilitations</h2>
        @if (loading()) { <tui-loader size="l" /> }
        <table class="tbl">
          <thead><tr><th>Utilisateur</th><th>Point</th><th>Début</th><th>Fin</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            @for (g of items(); track g.id) {
              <tr>
                <td>{{ g.user ? g.user.firstName + ' ' + g.user.lastName : g.userId }}</td>
                <td>{{ g.point?.label ?? 'Tous' }}</td>
                <td>{{ g.startsAt | date: 'dd/MM HH:mm' }}</td>
                <td>{{ g.expiresAt | date: 'dd/MM HH:mm' }}</td>
                <td><span class="chip" [attr.data-s]="g.revokedAt ? 'revoked' : 'active'">{{ g.revokedAt ? 'Révoquée' : 'Active' }}</span></td>
                <td>@if (!g.revokedAt) { <button tuiButton appearance="secondary" size="s" type="button" (click)="revoke(g)">Révoquer</button> }</td>
              </tr>
            }
          </tbody>
        </table>
        @if (!loading() && items().length === 0) { <p class="hint">Aucune habilitation.</p> }
      </section>
    </main>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .head h1 { margin: 0; font-size: 22px; }
    .panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 10px; }
    .panel h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--tui-text-secondary); }
    .hint { font-size: 13px; color: var(--tui-text-secondary); margin: 0; }
    .grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr auto; gap: 8px; }
    input, select { border: 1px solid #d7dbe3; border-radius: 8px; padding: 8px 10px; font-size: 14px; font-family: inherit; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
    .tbl th { text-align: left; font-size: 12px; color: var(--tui-text-secondary); padding: 6px 8px; border-bottom: 1px solid #eceef2; }
    .tbl td { padding: 8px; border-bottom: 1px solid #f4f5f7; }
    .chip { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .chip[data-s='active'] { background: #e3f6ea; color: #1a9e4b; }
    .chip[data-s='revoked'] { background: #fdeaea; color: #d8453a; }
    .ok-msg { color: #1a9e4b; font-size: 13px; margin: 0; }
  `],
})
export class ScannerGrantsPage implements OnInit {
  private readonly api = inject(AccessControlApiService);

  readonly items = signal<ScannerGrant[]>([]);
  readonly points = signal<{ id: string; label: string }[]>([]);
  readonly loading = signal(true);
  readonly msg = signal<string | null>(null);

  userId = '';
  pointId = '';
  startsAt = '';
  expiresAt = '';

  ngOnInit(): void {
    this.reload();
    this.api.listPoints().subscribe({ next: (pts) => this.points.set(pts.map((p) => ({ id: p.id, label: p.label }))), error: () => undefined });
  }

  reload(): void {
    this.loading.set(true);
    this.api.listGrants().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  create(): void {
    this.msg.set(null);
    this.api
      .createGrant({
        userId: this.userId.trim(),
        pointId: this.pointId || undefined,
        startsAt: this.startsAt ? new Date(this.startsAt).toISOString() : new Date().toISOString(),
        expiresAt: new Date(this.expiresAt).toISOString(),
      })
      .subscribe({
        next: () => {
          this.msg.set('Habilitation créée.');
          this.userId = '';
          this.reload();
        },
        error: (err) => this.msg.set(err?.error?.message ?? 'Échec de création.'),
      });
  }

  revoke(g: ScannerGrant): void {
    this.api.revokeGrant(g.id).subscribe({ next: () => this.reload() });
  }
}
