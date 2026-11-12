import { Component, OnInit, inject, signal } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import {
  AccessControlApiService,
  DuplicateRule,
  ScanPointItem,
  ScanTypeItem,
  ZoneItem,
} from './access-control-api.service';

const PERSON_TYPES = ['JEUNE', 'ANIMATEUR', 'BENEVOLE'];
const DUPLICATE_RULES: { value: DuplicateRule; label: string }[] = [
  { value: 'ALLOW', label: 'Répétable (entrées)' },
  { value: 'UNIQUE_PER_DAY', label: 'Une fois par jour' },
  { value: 'UNIQUE_PER_SERVICE', label: 'Une fois par service (repas)' },
];

@Component({
  selector: 'app-scan-config',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `
    <main class="page">
      <header class="head"><h1>Configuration du contrôle d'accès</h1></header>

      <section class="panel">
        <h2>Types de scan</h2>
        <table class="tbl">
          <thead><tr><th>Code</th><th>Libellé</th><th>Règle de doublon</th></tr></thead>
          <tbody>
            @for (t of scanTypes(); track t.id) {
              <tr><td><code>{{ t.code }}</code></td><td>{{ t.label }}</td><td>{{ ruleLabel(t.duplicateRule) }}</td></tr>
            }
          </tbody>
        </table>
        <div class="grid4">
          <input type="text" [(ngModel)]="stCode" placeholder="Code (ex. MEAL)" />
          <input type="text" [(ngModel)]="stLabel" placeholder="Libellé" />
          <select [(ngModel)]="stRule">@for (r of rules; track r.value) { <option [ngValue]="r.value">{{ r.label }}</option> }</select>
          <button tuiButton size="s" type="button" (click)="addScanType()" [disabled]="!stCode.trim() || !stLabel.trim()">Ajouter</button>
        </div>
      </section>

      <section class="panel">
        <h2>Zones</h2>
        <table class="tbl">
          <thead><tr><th>Nom</th><th>Types admis</th><th>Validation en ligne</th><th>Durée hors-ligne max</th></tr></thead>
          <tbody>
            @for (z of zones(); track z.id) {
              <tr>
                <td><button type="button" tuiButton appearance="flat" size="s" (click)="editZone(z)">{{ z.name }}</button></td>
                <td>{{ z.allowedPersonTypes?.join(', ') ?? 'Tous' }}</td>
                <td>{{ z.requiresOnlineValidation ? 'Oui' : 'Non' }}</td>
                <td>{{ z.maxOfflineMinutes }} min</td>
              </tr>
            }
          </tbody>
        </table>
        <div class="grid4">
          <input type="text" [(ngModel)]="zoneName" placeholder="Nom de la zone" />
          <span class="chk-group">
            @for (t of personTypes; track t) {
              <label class="chk"><input type="checkbox" [checked]="zoneTypes.has(t)" (change)="toggleType(t)" /> {{ t }}</label>
            }
          </span>
          <label class="chk"><input type="checkbox" [(ngModel)]="zoneOnline" /> Validation en ligne</label><input type="number" min="0" max="720" [(ngModel)]="zoneMaxOffline" placeholder="Hors-ligne max (min)" />
          <button tuiButton size="s" type="button" (click)="addZone()" [disabled]="!zoneName.trim()">{{ editingZoneId ? 'Enregistrer' : 'Ajouter' }}</button>
        </div>
      </section>

      <section class="panel">
        <h2>Points de contrôle</h2>
        <table class="tbl">
          <thead><tr><th>Nom</th><th>Zone</th><th>Type de scan</th><th>Service</th><th>Actif</th></tr></thead>
          <tbody>
            @for (p of points(); track p.id) {
              <tr>
                <td>{{ p.name }}</td>
                <td>{{ zoneLabel(p.zoneId) }}</td>
                <td>{{ typeLabel(p.scanTypeId) }}</td>
                <td>{{ p.serviceKey ?? '—' }}</td>
                <td><button type="button" tuiButton appearance="secondary" size="s" (click)="togglePoint(p)">{{ p.active ? 'Désactiver' : 'Activer' }}</button></td>
              </tr>
            }
          </tbody>
        </table>
        <div class="grid5">
          <input type="text" [(ngModel)]="ptName" placeholder="Nom (ex. Porte A)" />
          <select [(ngModel)]="ptZoneId">@for (z of zones(); track z.id) { <option [ngValue]="z.id">{{ z.name }}</option> }</select>
          <select [(ngModel)]="ptScanTypeId">@for (t of scanTypes(); track t.id) { <option [ngValue]="t.id">{{ t.label }}</option> }</select>
          <input type="text" [(ngModel)]="ptServiceKey" placeholder="Clé de service (optionnel)" />
          <button tuiButton size="s" type="button" (click)="addPoint()" [disabled]="!ptName.trim() || !ptZoneId || !ptScanTypeId">Ajouter</button>
        </div>
      </section>

      @if (msg(); as m) { <p class="ok-msg">{{ m }}</p> }
    </main>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .head h1 { margin: 0; font-size: 22px; }
    .panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 10px; }
    .panel h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--tui-text-secondary); }
    .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
    .tbl th { text-align: left; font-size: 12px; color: var(--tui-text-secondary); padding: 6px 8px; border-bottom: 1px solid #eceef2; }
    .tbl td { padding: 8px; border-bottom: 1px solid #f4f5f7; }
    code { font-family: ui-monospace, monospace; font-size: 12px; }
    input, select { border: 1px solid #d7dbe3; border-radius: 8px; padding: 8px 10px; font-size: 14px; font-family: inherit; }
    .grid4 { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px; align-items: center; }
    .grid5 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 8px; align-items: center; }
    @media(max-width: 900px) { .grid4, .grid5 { grid-template-columns: 1fr 1fr; } }
    .chk { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; margin-right: 10px; }
    .ok-msg { color: #1a9e4b; font-size: 13px; margin: 0; }
  `],
})
export class ScanConfigPage implements OnInit {
  private readonly api = inject(AccessControlApiService);
  readonly rules = DUPLICATE_RULES;
  readonly personTypes = PERSON_TYPES;

  readonly scanTypes = signal<ScanTypeItem[]>([]);
  readonly zones = signal<ZoneItem[]>([]);
  readonly points = signal<ScanPointItem[]>([]);
  readonly msg = signal<string | null>(null);

  stCode = ''; stLabel = ''; stRule: DuplicateRule = 'ALLOW';
  editingZoneId: number | null = null; zoneOnline = false;
  zoneName = ''; zoneTypes = new Set<string>(); zoneMaxOffline: number | null = 240;
  ptName = ''; ptZoneId: number | null = null; ptScanTypeId: number | null = null; ptServiceKey = '';

  ngOnInit(): void {
    this.reload();
  }

  zoneLabel(id: number): string { return this.zones().find(z => z.id === id)?.name ?? String(id); }
  typeLabel(id: number): string { return this.scanTypes().find(t => t.id === id)?.label ?? String(id); }

  ruleLabel(r: DuplicateRule): string {
    return DUPLICATE_RULES.find((x) => x.value === r)?.label ?? r;
  }

  reload(): void {
    this.api.listScanTypes().subscribe({ next: (v) => this.scanTypes.set(v), error: () => undefined });
    this.api.listZones().subscribe({ next: (v) => this.zones.set(v), error: () => undefined });
    this.api.listPoints().subscribe({ next: (v) => this.points.set(v), error: () => undefined });
  }

  toggleType(t: string): void {
    if (this.zoneTypes.has(t)) this.zoneTypes.delete(t);
    else this.zoneTypes.add(t);
  }

  addScanType(): void {
    this.api.createScanType({ code: this.stCode.trim(), label: this.stLabel.trim(), duplicateRule: this.stRule }).subscribe({
      next: () => { this.stCode = ''; this.stLabel = ''; this.flash('Type de scan ajouté.'); this.reload(); },
      error: (e) => this.flash(e?.error?.message ?? 'Échec.'),
    });
  }

  addZone(): void {
    const payload = {
        name: this.zoneName.trim(),
        allowedPersonTypes: this.zoneTypes.size > 0 ? [...this.zoneTypes] : undefined,
        maxOfflineMinutes: this.zoneMaxOffline ?? undefined,
        requiresOnlineValidation: this.zoneOnline,
      };
    (this.editingZoneId ? this.api.updateZone(this.editingZoneId, payload) : this.api.createZone(payload)).subscribe({
        next: () => { this.editingZoneId = null; this.zoneOnline = false; this.zoneName = ''; this.zoneTypes = new Set(); this.flash('Zone ajoutée.'); this.reload(); },
        error: (e) => this.flash(e?.error?.message ?? 'Échec.'),
      });
  }

  editZone(z: ZoneItem): void {
    this.editingZoneId = z.id; this.zoneName = z.name; this.zoneTypes = new Set(z.allowedPersonTypes ?? []);
    this.zoneMaxOffline = z.maxOfflineMinutes ?? 240; this.zoneOnline = z.requiresOnlineValidation ?? false;
  }
  togglePoint(p: ScanPointItem): void {
    this.api.updatePoint(p.id, { active: !p.active }).subscribe({ next: () => this.reload(), error: () => this.flash('Échec de mise à jour.') });
  }

  addPoint(): void {
    if (!this.ptZoneId || !this.ptScanTypeId) return;
    this.api
      .createPoint({
        zoneId: this.ptZoneId,
        scanTypeId: this.ptScanTypeId,
        name: this.ptName.trim(),
        serviceKey: this.ptServiceKey.trim() || undefined,
      })
      .subscribe({
        next: () => { this.ptName = ''; this.ptServiceKey = ''; this.flash('Point ajouté.'); this.reload(); },
        error: (e) => this.flash(e?.error?.message ?? 'Échec.'),
      });
  }

  private flash(m: string): void {
    this.msg.set(m);
    setTimeout(() => this.msg.set(null), 4000);
  }
}
