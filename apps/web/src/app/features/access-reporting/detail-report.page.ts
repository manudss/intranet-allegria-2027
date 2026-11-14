import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, Subscription, of } from 'rxjs';
import {
  DetailReportApi,
  DetailFilters,
  Dashboard,
  DetailPage,
  ConfigPoint,
  DetailEvent,
  ExpectedOverview,
} from './detail-report-api.service';
import { reportFilters } from './access-reporting.page';
@Component({
  selector: 'app-detail-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './detail-report.page.html',
  styleUrl: './detail-report.page.scss',
})
export class DetailReportPage implements OnInit, OnDestroy {
  private api = inject(DetailReportApi);
  private route = inject(ActivatedRoute);
  private request?: Subscription;
  private config?: Subscription;
  private clock?: ReturnType<typeof setInterval>;
  private appliedFilters = '';
  readonly resultOffset = signal(0);
  readonly place = this.route.snapshot.data['mode'] === 'place';
  readonly dashboard = signal<Dashboard | null>(null);
  readonly rows = signal<DetailPage | null>(null);
  readonly expected = signal<ExpectedOverview | null>(null);
  slotKey = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly automatic = signal(true);
  readonly configured = signal(false);
  readonly detail = signal<DetailEvent | null>(null);
  points: ConfigPoint[] = [];
  zones: { id: number; name: string }[] = [];
  types: { id: number; label: string }[] = [];
  teams: { id: number; name: string }[] = [];
  from = this.today();
  to = this.today();
  zoneId: number | null = null;
  pointId: number | null = null;
  scanTypeId: number | null = null;
  teamId: number | null = null;
  personType = '';
  serviceKey = '';
  search = '';
  mode = 'scanned';
  offset = 0;
  private today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.pointId = Number(params.get('pointId')) || null;
    this.scanTypeId = Number(params.get('scanTypeId')) || null;
    for (const field of ['from', 'to'] as const) {
      const value = params.get(field);
      if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) this[field] = value;
    }

    this.configure();
    if (!this.place)
      this.clock = setInterval(() => {
        if (this.automatic() && !document.hidden && !this.loading() && this.configured())
          this.autoRefresh();
      }, 15000);
  }
  autoRefresh() {
    try {
      if (JSON.stringify(this.filters()) === this.appliedFilters) this.refresh(false);
    } catch {
      /* Editing an invalid range must not send requests. */
    }
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
    this.config?.unsubscribe();
    if (this.clock) clearInterval(this.clock);
  }
  configure() {
    this.error.set('');
    this.config?.unsubscribe();
    this.config = forkJoin({
      points: this.api.points(),
      zones: this.api.zones(),
      types: this.api.types(),
      teams: this.api.teams(),
    }).subscribe({
      next: (r) => {
        Object.assign(this, r);
        this.configured.set(true);
        if (this.place && !this.pointId)
          this.pointId = this.points.find((p) => p.active)?.id ?? null;
        this.refresh();
      },
      error: () => this.error.set('Configuration indisponible. Réessayez.'),
    });
  }
  filters(): DetailFilters {
    const dates = reportFilters(this.from, this.to, null, null, null);
    return {
      ...dates,
      ...(this.zoneId ? { zoneId: this.zoneId } : {}),
      ...(this.place && this.pointId ? { pointId: this.pointId } : {}),
      ...(this.scanTypeId ? { scanTypeId: this.scanTypeId } : {}),
      ...(this.serviceKey.trim() ? { serviceKey: this.serviceKey.trim() } : {}),
      ...(this.teamId ? { teamId: this.teamId } : {}),
      ...(this.personType ? { personType: this.personType } : {}),
      ...(this.search.trim() ? { q: this.search.trim() } : {}),
    };
  }
  refresh(reset = true) {
    if (!this.configured()) return this.configure();
    let q: DetailFilters;
    try {
      q = this.filters();
      if (this.place && !this.pointId) throw Error('Choisissez un point.');
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    if (reset) this.offset = 0;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.detail.set(null);
    const list = this.place
      ? this.mode === 'scanned'
        ? this.api.scanned({ ...q, limit: 50, offset: this.offset })
        : this.api.events({
            ...q,
            limit: 50,
            offset: this.offset,
            ...(this.mode === 'review' ? { reviewOnly: 'true' } : {}),
          })
      : this.api.events({ ...q, limit: 10, offset: 0, anomaliesOnly: 'true' });
    this.request = forkJoin({
      dashboard: this.api.dashboard(q),
      rows: list,
      expected: this.place ? of(null) : this.api.expected(q),
    }).subscribe({
      next: (r) => {
        this.appliedFilters = JSON.stringify(q);
        this.resultOffset.set(this.offset);
        this.dashboard.set(r.dashboard);
        this.rows.set(r.rows);
        this.expected.set(r.expected);
        if (!r.expected?.slots.some((s) => s.slotKey === this.slotKey))
          this.slotKey = r.expected?.slots[0]?.slotKey ?? '';
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          'Actualisation impossible. Les données affichées ne sont pas actualisées ; vérifiez les filtres et l’heure du dernier résultat.',
        );
      },
    });
  }
  switchMode(mode: string) {
    this.mode = mode;
    this.refresh();
  }
  page(n: number) {
    this.offset = Math.max(0, this.offset + n * 50);
    this.refresh(false);
  }
  name(p: DetailEvent) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Identité non reconnue';
  }
  verdict(p: DetailEvent) {
    return (
      (
        {
          ACCEPTED: 'Accepté',
          DUPLICATE: 'Doublon',
          REJECTED_UNKNOWN: 'Code inconnu',
          REJECTED_REVOKED: 'Badge révoqué',
          REJECTED_EXPIRED_ASSIGNMENT: 'Badge remplacé / expiré',
          REJECTED_NO_RIGHT: 'Droit de zone refusé',
          REJECTED_NOT_EXPECTED: 'Hors groupe attendu',
        } as Record<string, string>
      )[p.verdict] ?? p.verdict
    );
  }
  time(value: string | null | undefined) {
    if (!value) return 'Aucun scan reçu';
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  }
  selectedSlot() {
    return this.expected()?.slots.find((s) => s.slotKey === this.slotKey);
  }
  pointsWithoutExpected() {
    return (
      this.dashboard()?.points.filter(
        (p) => p.active && !this.expected()?.passages.some((x) => x.pointId === p.pointId),
      ) ?? []
    );
  }
  selectedPoint() {
    return this.points.find((p) => p.id === this.pointId);
  }
}
