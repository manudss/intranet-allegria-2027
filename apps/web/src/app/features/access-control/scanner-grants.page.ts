import { Component, OnInit, inject, signal } from '@angular/core';
import { PersonPickerComponent, PersonSummary } from '../../shared/person-picker.component';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { AccessControlApiService, ScannerGrant, ZoneItem } from './access-control-api.service';

@Component({
  selector: 'app-scanner-grants',
  standalone: true,
  imports: [...SHARED_IMPORTS, PersonPickerComponent],
  template: `
    <main class="page">
      <header class="head"><h1>Habilitations scan</h1></header>
      <section class="panel">
        <h2>Nouvelle habilitation</h2>
        <p class="hint">Donne le droit de scanner à un utilisateur, pour une zone précise ou toutes les zones, avec une fin de validité.</p>
        <div class="grid">
          <app-person-picker label="Utilisateur" testId="scanner-person-picker" [value]="picked" (valueChange)="onPick($event)" />
          <select [(ngModel)]="zoneId">
            <option [ngValue]="null">Toutes les zones</option>
            @for (z of zones(); track z.id) { <option [ngValue]="z.id">{{ z.name }}</option> }
          </select>
          <input type="datetime-local" [(ngModel)]="startsAt" />
          <input type="datetime-local" [(ngModel)]="endsAt" />
          <button tuiButton type="button" (click)="create()" [disabled]="!userId">Créer</button>
        </div>
        @if (msg(); as m) { <p class="ok-msg">{{ m }}</p> }
      </section>
      <section class="panel">
        <h2>Habilitations</h2>
        @if (loading()) { <app-loading-skeleton /> }
        <table class="tbl">
          <thead><tr><th>Utilisateur</th><th>Zone</th><th>Début</th><th>Fin</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            @for (g of items(); track g.id) {
              <tr>
                <td>{{ g.user?.email ?? 'Utilisateur #' + g.userId }}</td>
                <td>{{ g.zone?.name ?? 'Toutes' }}</td>
                <td>{{ g.startsAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ g.endsAt ? (g.endsAt | date: 'dd/MM/yyyy HH:mm') : '—' }}</td>
                <td><span class="chip" [attr.data-s]="isActive(g) ? 'active' : 'closed'">{{ isActive(g) ? 'Active' : 'Terminée' }}</span></td>
                <td>@if (isActive(g)) { <button tuiButton appearance="secondary" size="s" type="button" (click)="revoke(g)">Clore</button> }</td>
              </tr>
            }
          </tbody>
        </table>
        @if (!loading() && items().length === 0) { <p class="hint">Aucune habilitation.</p> }
      </section>
    </main>
  `,
  styles: [`
    .page { padding: 24px; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; }
    .head h1 { margin: 0; font-size: 22px; }
    .panel { background: var(--appearance-surface); border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 10px; }
    .panel h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--tui-text-secondary); }
    .hint { font-size: 13px; color: var(--tui-text-secondary); margin: 0; }
    .grid { display: grid; grid-template-columns: minmax(180px,1fr) minmax(180px,1fr); gap: 8px; }
    .grid button { justify-self: start; min-width: 100px; }
    @media(max-width: 700px) { .grid { grid-template-columns: 1fr; } }
    input, select { border: 1px solid var(--appearance-border); border-radius: 8px; padding: 8px 10px; font-size: 14px; font-family: inherit; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
    .tbl th { text-align: left; font-size: 12px; color: var(--tui-text-secondary); padding: 6px 8px; border-bottom: 1px solid var(--line-soft); }
    .tbl td { padding: 8px; border-bottom: 1px solid var(--line-soft); }
    .chip { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .chip[data-s='active'] { background: var(--appearance-raised); color: var(--appearance-success); }
    .chip[data-s='closed'] { background: var(--appearance-surface); color: var(--appearance-muted); }
    .ok-msg { color: var(--appearance-success); font-size: 13px; margin: 0; }
  `],
})
export class ScannerGrantsPage implements OnInit {
  private readonly api = inject(AccessControlApiService);

  readonly items = signal<ScannerGrant[]>([]);
  readonly zones = signal<ZoneItem[]>([]);
  readonly loading = signal(true);
  readonly msg = signal<string | null>(null);

  userId: number | null = null;
  picked: PersonSummary | null = null;
  zoneId: number | null = null;
  startsAt = '';
  endsAt = '';

  ngOnInit(): void {
    this.reload();
    this.api.listZones().subscribe({ next: (z) => this.zones.set(z), error: () => undefined });
  }

  onPick(person: PersonSummary | null): void {
    this.picked = person;
    this.userId = person?.id ?? null;
  }

  isActive(g: ScannerGrant): boolean {
    return !g.endsAt || Date.parse(g.endsAt) > Date.now();
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
    if (!this.userId) return;
    this.msg.set(null);
    this.api
      .createGrant({
        userId: this.userId,
        zoneId: this.zoneId ?? undefined,
        startsAt: this.startsAt ? new Date(this.startsAt).toISOString() : undefined,
        endsAt: this.endsAt ? new Date(this.endsAt).toISOString() : undefined,
      })
      .subscribe({
        next: () => {
          this.msg.set('Habilitation créée.');
          this.userId = null;
          this.picked = null;
          this.reload();
        },
        error: (err) => this.msg.set(err?.error?.message ?? 'Échec de création.'),
      });
  }

  revoke(g: ScannerGrant): void {
    this.api.revokeGrant(g.id).subscribe({ next: () => this.reload() });
  }
}
