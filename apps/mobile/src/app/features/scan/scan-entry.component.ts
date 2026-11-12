import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ScanApiService } from './scan-api.service';
import { ScanStore } from './scan.store';
import { ScanPointConfig } from './scan.models';

const SCAN_ROLES = ['SCANNER', 'BADGE_MANAGER', 'ADMIN'];

@Component({
  selector: 'app-scan-entry',
  standalone: true,
  template: `
    <main class="entry">
      @if (!allowed()) {
        <section class="card denied">
          <h1>Accès réservé</h1>
          <p>Le mode scan nécessite l'habilitation « scan » ou « gestion des badges ».</p>
        </section>
      } @else {
        <header>
          <h1>Mode scan</h1>
          <p class="sub">Choisissez votre poste, téléchargez la table chiffrée, puis scannez.</p>
        </header>

        <section class="card">
          <h2>Point de contrôle</h2>
          <div class="points">
            @for (p of points(); track p.id) {
              <button type="button" class="point" [class.sel]="selected()?.id === p.id" (click)="select(p)">
                <strong>{{ p.label }}</strong>
                <span class="type">{{ typeLabel(p.type) }}</span>
              </button>
            }
          </div>
        </section>

        <section class="card">
          <h2>Type de scan</h2>
          <div class="types">
            <button type="button" class="type-btn" [class.sel]="scanType() === 'ENTRY'" (click)="scanType.set('ENTRY')">Entrée</button>
            <button type="button" class="type-btn" [class.sel]="$any(scanType()) === 'EXIT'" (click)="scanType.set($any('EXIT'))">Sortie</button>
          </div>
        </section>

        <button class="cta" type="button" [disabled]="!selected() || loading()" (click)="start()">
          {{ loading() ? 'Téléchargement…' : 'Démarrer le scan' }}
        </button>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <p class="hint">Table chiffrée sur l'appareil · expiration automatique · scans renvoyés au serveur dès que le réseau revient.</p>
      }
    </main>
  `,
  styles: [`
    .entry { max-width: 480px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
    h1 { font-size: 22px; margin: 0; }
    .sub { color: var(--tui-text-secondary, #6b7280); font-size: 14px; }
    .card { background: #fff; border-radius: 16px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .card h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin: 0 0 10px; }
    .points { display: flex; flex-direction: column; gap: 8px; }
    .point { display: flex; justify-content: space-between; align-items: center; padding: 14px; border: 2px solid transparent; border-radius: 12px; background: #f4f5f7; font-size: 15px; cursor: pointer; }
    .point.sel { border-color: #526ed3; background: #eef1fb; }
    .type { font-size: 12px; color: #6b7280; }
    .types { display: flex; gap: 8px; }
    .type-btn { flex: 1; height: 48px; border-radius: 12px; border: 2px solid transparent; background: #f4f5f7; font-size: 16px; font-weight: 600; cursor: pointer; }
    .type-btn.sel { border-color: #526ed3; background: #eef1fb; color: #526ed3; }
    .cta { height: 56px; border: none; border-radius: 14px; background: #526ed3; color: #fff; font-size: 17px; font-weight: 700; cursor: pointer; }
    .cta:disabled { opacity: .5; }
    .error { color: #d8453a; font-size: 14px; }
    .hint { font-size: 12px; color: #6b7280; text-align: center; }
    .denied p { color: #6b7280; }
  `],
})
export class ScanEntryComponent implements OnInit {
  private readonly api = inject(ScanApiService);
  private readonly store = inject(ScanStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly allowed = signal(false);
  readonly points = signal<ScanPointConfig[]>([]);
  readonly selected = signal<ScanPointConfig | null>(null);
  readonly scanType = signal<'ENTRY' | 'EXIT'>('ENTRY');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.allowed.set(this.auth.hasAnyRole(SCAN_ROLES));
    if (!this.allowed()) return;
    this.api.listPoints().subscribe({
      next: (points) => this.points.set(points.filter((p) => p.active)),
      error: () => this.error.set("Impossible de charger les points de contrôle."),
    });
  }

  select(p: ScanPointConfig): void {
    this.selected.set(p);
  }

  typeLabel(t: string): string {
    const labels: Record<string, string> = { ENTRY: 'Entrée', EXIT: 'Sortie', MEAL: 'Repas', BUS: 'Bus', ZONE: 'Zone', GENERAL: 'Général' };
    return labels[t] ?? t;
  }

  async start(): Promise<void> {
    const point = this.selected();
    if (!point) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.store.init();
      await this.store.startSession(point, this.scanType());
      await this.router.navigate(['/scan', point.id]);
    } catch {
      this.error.set("Téléchargement de la table impossible. Vérifiez la connexion et réessayez.");
    } finally {
      this.loading.set(false);
    }
  }
}
