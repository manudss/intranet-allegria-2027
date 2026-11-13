import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, Subscription, of } from 'rxjs';
import {
  DetailReportApi,
  DetailFilters,
  DetailPage,
  ConfigPoint,
  DetailEvent,
} from './detail-report-api.service';
import { reportFilters } from './access-reporting.page';
interface Group {
  id: number;
  name: string;
  archivedAt: string | null;
}
interface Member {
  personKey: string;
  participantId: number | null;
  volunteerId: number | null;
  firstName: string;
  lastName: string | null;
  type: string;
  hasAccepted: boolean;
  lastReceivedAt: string | null;
}
interface History {
  group: Group;
  counts: {
    members: number;
    scannedPeople: number;
    withoutAccepted: number;
    attempts: number;
    accepted: number;
    rejected: number;
    duplicates: number;
    needsReview: number;
  };
  items: Member[];
  total: number;
  membershipBasis: string;
  fetchedAt: string;
}
@Component({
  selector: 'app-group-history',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './group-history.page.html',
  styleUrl: './detail-report.page.scss',
})
export class GroupHistoryPage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private api = inject(DetailReportApi);
  private groupRequest?: Subscription;
  private request?: Subscription;
  private config?: Subscription;
  readonly groups = signal<{ items: Group[]; total: number }>({ items: [], total: 0 });
  readonly history = signal<History | null>(null);
  readonly events = signal<DetailPage | null>(null);
  readonly loading = signal(false);
  readonly groupLoading = signal(false);
  readonly error = signal('');
  readonly groupError = signal('');
  readonly resultOffset = signal(0);
  readonly groupResultOffset = signal(0);
  groupId: number | null = null;
  pointId: number | null = null;
  from = this.today();
  to = this.today();
  verdictFilter = '';
  groupSearch = '';
  groupOffset = 0;
  offset = 0;
  tab: 'journal' | 'members' | 'missing' = 'journal';
  points: ConfigPoint[] = [];
  private today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  ngOnInit() {
    this.findGroups();
    this.config = this.api
      .points()
      .subscribe({
        next: (p) => (this.points = p),
        error: () => this.groupError.set('Points indisponibles. Réessayez en rechargeant la page.'),
      });
  }
  ngOnDestroy() {
    this.groupRequest?.unsubscribe();
    this.request?.unsubscribe();
    this.config?.unsubscribe();
  }
  findGroups(reset = true) {
    if (reset) this.groupOffset = 0;
    this.groupRequest?.unsubscribe();
    this.groupLoading.set(true);
    this.groupError.set('');
    const offset = this.groupOffset;
    this.groupRequest = this.http
      .get<{ items: Group[]; total: number }>('/api/access-control/expected/groups', {
        params: new HttpParams()
          .set('limit', 50)
          .set('offset', offset)
          .set('q', this.groupSearch.trim()),
      })
      .subscribe({
        next: (r) => {
          this.groups.set(r);
          this.groupResultOffset.set(offset);
          this.groupLoading.set(false);
        },
        error: () => {
          this.groupLoading.set(false);
          this.groupError.set('Liste des groupes non actualisée. Réessayez.');
        },
      });
  }
  groupPage(n: number) {
    this.groupOffset = Math.max(0, this.groupOffset + n * 50);
    this.findGroups(false);
  }
  choose() {
    this.request?.unsubscribe();
    this.loading.set(false);
    this.history.set(null);
    this.events.set(null);
    this.error.set('');
    this.tab = 'journal';
    this.refresh();
  }
  switchTab(tab: 'journal' | 'members' | 'missing') {
    this.tab = tab;
    this.events.set(null);
    this.history.set(null);
    this.refresh();
  }
  refresh(reset = true) {
    if (!this.groupId) return;
    let filters: DetailFilters;
    try {
      filters = {
        ...reportFilters(this.from, this.to, null, null, null),
        expectedGroupId: this.groupId,
        ...(this.pointId ? { pointId: this.pointId } : {}),
      };
    } catch (e) {
      this.error.set((e as Error).message);
      return;
    }
    if (reset) this.offset = 0;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    const offset = this.offset;
    let params = new HttpParams();
    for (const [k, v] of Object.entries({
      ...filters,
      limit: 50,
      offset,
      withoutAcceptedOnly: this.tab === 'missing' ? 'true' : 'false',
    }))
      params = params.set(k, String(v));
    this.request = forkJoin({
      history: this.http.get<History>('/api/access-control/reporting/group-history', { params }),
      events:
        this.tab === 'journal'
          ? this.api.events({
              ...filters,
              ...(this.verdictFilter ? { verdict: this.verdictFilter } : {}),
              limit: 50,
              offset,
            })
          : of(null),
    }).subscribe({
      next: (r) => {
        this.history.set(r.history);
        this.events.set(r.events);
        this.resultOffset.set(offset);
        this.loading.set(false);
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
  name(p: Member | DetailEvent) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Identité non reconnue';
  }
  time(value: string | null) {
    return value
      ? new Intl.DateTimeFormat('fr-FR', {
          timeZone: 'Europe/Paris',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(value))
      : 'Aucun événement reçu';
  }
  verdict(value: string) {
    return (
      (
        {
          ACCEPTED: 'Accepté',
          DUPLICATE: 'Doublon',
          REJECTED_NOT_EXPECTED: 'Hors groupe attendu',
          REJECTED_REVOKED: 'Badge révoqué',
          REJECTED_EXPIRED_ASSIGNMENT: 'Badge remplacé / expiré',
          REJECTED_NO_RIGHT: 'Droit refusé',
          REJECTED_UNKNOWN: 'Code inconnu',
        } as Record<string, string>
      )[value] ?? value
    );
  }
}
