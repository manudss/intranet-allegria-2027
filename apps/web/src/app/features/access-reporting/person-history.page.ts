import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, Subscription } from 'rxjs';
import {
  DetailReportApi,
  DetailEvent,
  DetailPage,
  ConfigPoint,
  DetailFilters,
} from './detail-report-api.service';
import { reportFilters } from './access-reporting.page';
export interface HistoryPerson {
  participantId: number | null;
  volunteerId: number | null;
  firstName: string;
  lastName: string | null;
  type: string;
}
@Component({
  selector: 'app-person-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './person-history.page.html',
  styleUrl: './detail-report.page.scss',
})
export class PersonHistoryPage implements OnInit, OnDestroy {
  private api = inject(DetailReportApi);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private searchRequest?: Subscription;
  private eventRequest?: Subscription;
  private config?: Subscription;
  readonly people = signal<{ items: HistoryPerson[]; total: number } | null>(null);
  readonly selected = signal<HistoryPerson | null>(null);
  readonly events = signal<DetailPage | null>(null);
  readonly searching = signal(false);
  readonly loading = signal(false);
  readonly searchError = signal('');
  readonly error = signal('');
  readonly resultOffset = signal(0);
  readonly searchResultOffset = signal(0);
  points: ConfigPoint[] = [];
  types: { id: number; label: string }[] = [];
  search = '';
  searchOffset = 0;
  offset = 0;
  pointId: number | null = null;
  scanTypeId: number | null = null;
  verdictFilter = '';
  from = this.today();
  to = this.today();
  private today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  ngOnInit() {
    this.config = forkJoin({ points: this.api.points(), types: this.api.types() }).subscribe({
      next: (r) => Object.assign(this, r),
      error: () =>
        this.error.set(
          'Liste des points/types indisponible. Les filtres par défaut restent utilisables.',
        ),
    });
    const id = Number(this.route.snapshot.queryParamMap.get('participantId'));
    if (Number.isInteger(id) && id > 0) {
      this.selected.set({
        participantId: id,
        volunteerId: null,
        firstName: 'Personne',
        lastName: null,
        type: '',
      });
      this.refresh();
    }
  }
  ngOnDestroy() {
    this.searchRequest?.unsubscribe();
    this.eventRequest?.unsubscribe();
    this.config?.unsubscribe();
  }
  searchPeople(reset = true) {
    if (reset) this.searchOffset = 0;
    this.searching.set(true);
    this.searchError.set('');
    this.searchRequest?.unsubscribe();
    const offset = this.searchOffset;
    this.searchRequest = this.http
      .get<{ items: HistoryPerson[]; total: number }>('/api/access-control/reporting/people', {
        params: new HttpParams()
          .set('q', this.search.trim())
          .set('limit', 50)
          .set('offset', this.searchOffset),
      })
      .subscribe({
        next: (r) => {
          this.people.set(r);
          this.searchResultOffset.set(offset);
          this.searching.set(false);
        },
        error: () => {
          this.searching.set(false);
          this.searchError.set('Recherche indisponible. Réessayez.');
        },
      });
  }
  searchPage(n: number) {
    this.searchOffset = Math.max(0, this.searchOffset + n * 50);
    this.searchPeople(false);
  }
  close() {
    this.eventRequest?.unsubscribe();
    this.selected.set(null);
    this.events.set(null);
    this.loading.set(false);
    this.error.set('');
  }
  choose(p: HistoryPerson) {
    this.eventRequest?.unsubscribe();
    this.loading.set(false);
    this.error.set('');
    this.selected.set(p);
    this.events.set(null);
    this.offset = 0;
    this.pointId = null;
    this.scanTypeId = null;
    this.verdictFilter = '';
    this.from = this.today();
    this.to = this.today();
    this.refresh();
  }
  refresh(reset = true) {
    const person = this.selected();
    if (!person?.participantId) return;
    let filters: DetailFilters;
    try {
      filters = {
        ...reportFilters(this.from, this.to, null, null, null),
        participantId: person.participantId,
        ...(this.pointId ? { pointId: this.pointId } : {}),
        ...(this.scanTypeId ? { scanTypeId: this.scanTypeId } : {}),
        ...(this.verdictFilter ? { verdict: this.verdictFilter } : {}),
      };
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    if (reset) this.offset = 0;
    this.eventRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    const offset = this.offset;
    this.eventRequest = this.api.events({ ...filters, limit: 50, offset }).subscribe({
      next: (r) => {
        this.events.set(r);
        this.resultOffset.set(offset);
        this.loading.set(false);
        const row = r.items.find((e) => e.participantId === person.participantId);
        if (row?.firstName && person.firstName === 'Personne')
          this.selected.set({
            ...person,
            firstName: row.firstName,
            lastName: row.lastName,
            type: row.type,
          });
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          'Historique non actualisé. Les dernières données affichées peuvent être périmées. Réessayez.',
        );
      },
    });
  }
  page(n: number) {
    this.offset = Math.max(0, this.offset + n * 50);
    this.refresh(false);
  }
  name(p: HistoryPerson | DetailEvent) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Identité non reconnue';
  }
  time(value: string | null) {
    if (!value) return 'Heure indisponible';
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  }
  verdict(v: string) {
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
      )[v] ?? v
    );
  }
}
