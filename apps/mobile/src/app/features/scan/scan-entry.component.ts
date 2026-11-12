import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ScanApiService } from './scan-api.service';
import { ScanStore } from './scan.store';
import { AccessZone, ScanPoint } from './scan.models';

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
          <p class="sub">Choisissez votre point de contrôle, la table chiffrée est téléchargée, puis scannez.</p>
        </header>

        <section class="card">
          <h2>Point de contrôle</h2>
          <div class="points">
            @for (p of points(); track p.id) {
              <button type="button" class="point" [class.sel]="selected()?.id === p.id" (click)="select(p)">
                <strong>{{ p.name }}</strong>
                <span class="type">{{ zoneName(p) }}{{ p.scanType?.label ? ' · ' + p.scanType.label : '' }}</span>
              </button>
            }
          </div>
          @if (!loadingCfg() && points().length === 0) {
            <p class="hint">Aucun point de contrôle actif configuré.</p>
          }
        </section>

        <button class="cta" type="button" [disabled]="!selected() || loading()" (click)="start()">
          {{ loading() ? 'Téléchargement…' : 'Démarrer le scan' }}
        </button>

        @if (canAssign()) {
          <button class="cta assign" type="button" (click)="goAssign()">Attribuer / remplacer un badge</button>
        }

        @if (error(); as e) {
          <p class="error">{{ e }}</p>
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
    .point { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 14px; border: 2px solid transparent; border-radius: 12px; background: #f4f5f7; font-size: 15px; cursor: pointer; }
    .point.sel { border-color: #526ed3; background: #eef1fb; }
    .type { font-size: 12px; color: #6b7280; text-align: right; }
    .cta { height: 56px; border: none; border-radius: 14px; background: #526ed3; color: #fff; font-size: 17px; font-weight: 700; cursor: pointer; }
    .cta:disabled { opacity: .5; }
    .cta.assign { background: #1a9e4b; }
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
  readonly canAssign = signal(false);
  readonly points = signal<ScanPoint[]>([]);
  readonly zones = signal<Map<number, AccessZone>>(new Map());
  readonly selected = signal<ScanPoint | null>(null);
  readonly loading = signal(false);
  readonly loadingCfg = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.allowed.set(this.auth.hasAnyRole(SCAN_ROLES));
    this.canAssign.set(this.auth.hasAnyRole(['BADGE_MANAGER', 'ADMIN']));
    if (!this.allowed()) return;
    this.api.listZones().subscribe({
      next: (zones) => this.zones.set(new Map(zones.map((z) => [z.id, z]))),
      error: () => undefined,
    });
    this.api.listPoints().subscribe({
      next: (points) => {
        this.points.set(points.filter((p) => p.active));
        this.loadingCfg.set(false);
      },
      error: () => {
        this.loadingCfg.set(false);
        this.error.set('Impossible de charger les points de contrôle.');
      },
    });
  }

  select(p: ScanPoint): void {
    this.selected.set(p);
  }

  zoneName(p: ScanPoint): string {
    return this.zones().get(p.zoneId)?.name ?? '';
  }

  goAssign(): void {
    void this.router.navigate(['/scan/attribuer']);
  }

  async start(): Promise<void> {
    const point = this.selected();
    if (!point) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.store.init();
      await this.store.startSession(point);
      await this.router.navigate(['/scan', point.id]);
    } catch {
      this.error.set('Téléchargement de la table impossible. Vérifiez la connexion et votre habilitation, puis réessayez.');
    } finally {
      this.loading.set(false);
    }
  }
}
