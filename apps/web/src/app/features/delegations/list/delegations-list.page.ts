import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHARED_IMPORTS } from '../../../shared/shared-imports';
import { GroupPayload } from '../../../models/models';
import { GroupsApiService } from '../../../services/api.services';
import { DelegationSummary, DelegationsApiService } from '../delegations-api.service';

const SANS_DELEGATION = 'Sans délégation';

const ZONE_LABELS: Record<string, string> = {
  metropole: 'Métropole',
  'outre-mer': 'Outre-mer',
  luxembourg: 'Luxembourg',
  belgique: 'Belgique',
  institutionnel: 'Circonscriptions institutionnelles',
};

const COUNTRY_LABELS: Record<string, string> = {
  FR: 'France',
  LU: 'Luxembourg',
  BE: 'Belgique',
};

/**
 * Page cartes des délégations (lot 3 de la refonte) : une carte par délégation
 * avec effectifs, barre de répartition, pastille d'état, responsables et
 * exceptions accueillies ; recherche, filtres zone/pays, tri par « à placer ».
 * « Sans délégation » reste en carte pointillée, gérée par les coordinateurs.
 */
@Component({
  selector: 'app-delegations-list-page',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink],
  templateUrl: './delegations-list.page.html',
  styleUrls: ['../../../shared/crud.scss', './delegations-list.page.scss'],
})
export class DelegationsListPage implements OnInit {
  private readonly api = inject(DelegationsApiService);
  private readonly groupsApi = inject(GroupsApiService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly summaries = signal<DelegationSummary[]>([]);

  protected readonly query = signal('');
  protected readonly zone = signal<string | null>(null);
  protected readonly country = signal<string | null>(null);
  protected readonly sortToPlace = signal(true);

  protected readonly drawerOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected newName = '';
  protected newDiocese = '';
  protected newNotes = '';

  protected readonly zones = [null, 'metropole', 'outre-mer', 'luxembourg', 'belgique', 'institutionnel'];
  protected readonly countries = [null, 'FR', 'LU', 'BE'];
  protected readonly zoneLabel = (z: string | null) =>
    z ? (ZONE_LABELS[z] ?? z) : 'Toutes les zones';
  protected readonly countryLabel = (c: string | null) =>
    c ? (COUNTRY_LABELS[c] ?? c) : 'Tous les pays';

  ngOnInit() {
    this.reload();
  }

  protected reload() {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listSummaries().subscribe({
      next: (rows) => {
        this.summaries.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const zone = this.zone();
    const country = this.country();
    let rows = this.summaries();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.diocese ?? '').toLowerCase().includes(q) ||
          r.responsables.some((resp) => resp.toLowerCase().includes(q)),
      );
    }
    if (zone) rows = rows.filter((r) => r.zone === zone);
    if (country) rows = rows.filter((r) => r.country === country);
    const sans = rows.filter((r) => this.isSansDelegation(r));
    const rest = rows.filter((r) => !this.isSansDelegation(r));
    if (this.sortToPlace()) {
      rest.sort((a, b) => b.toPlace - a.toPlace || a.name.localeCompare(b.name));
    } else {
      rest.sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...rest, ...sans];
  });

  protected isSansDelegation(d: DelegationSummary) {
    return d.name === SANS_DELEGATION;
  }

  /** Pastille d'état de la carte : terminée, « N à placer » ou « N à rattacher ». */
  protected chip(d: DelegationSummary): string {
    if (this.isSansDelegation(d)) return `${d.total} à rattacher`;
    if (d.toPlace === 0) return 'répartition terminée';
    return `${d.toPlace} à placer`;
  }

  protected chipClass(d: DelegationSummary): string {
    if (this.isSansDelegation(d)) return 'chip chip-warn';
    return d.toPlace === 0 ? 'chip chip-ok' : 'chip chip-warn';
  }

  protected placedTotal(d: DelegationSummary) {
    return d.aller.placed + d.retour.placed;
  }

  protected grandTotal(d: DelegationSummary) {
    return d.aller.total + d.retour.total;
  }

  protected pct(d: DelegationSummary): number {
    const total = this.grandTotal(d);
    if (total === 0) return 100;
    return Math.round((100 * this.placedTotal(d)) / total);
  }

  protected barClass(d: DelegationSummary): string {
    return this.pct(d) >= 100 ? 'bar bar-ok' : 'bar bar-warn';
  }

  protected openCreate() {
    this.createError.set(null);
    this.newName = '';
    this.newDiocese = '';
    this.newNotes = '';
    this.drawerOpen.set(true);
  }

  protected create() {
    const name = this.newName.trim();
    if (!name) {
      this.createError.set('Le nom de la délégation est obligatoire.');
      return;
    }
    this.saving.set(true);
    this.createError.set(null);
    // Le panneau de création est volontairement sans dates (plan lot 3) : le
    // payload groupe les rend pourtant obligatoires côté typage, d'où le cast.
    const payload = {
      name,
      diocese: this.newDiocese.trim() || null,
      notes: this.newNotes.trim() || null,
    } as unknown as GroupPayload;
    this.groupsApi.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.drawerOpen.set(false);
        this.reload();
      },
      error: () => {
        this.saving.set(false);
        this.createError.set("La création a échoué. Réessayez dans un instant.");
      },
    });
  }
}
