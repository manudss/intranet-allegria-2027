import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ExpectedReportApi,
  ExpectedPassage,
  ExpectedPerson,
  ExpectedStatusPage,
} from './expected-report-api.service';
@Component({
  selector: 'app-expected-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './expected-report.page.html',
  styleUrl: './expected-report.page.scss',
})
export class ExpectedReportPage implements OnInit, OnDestroy {
  private api = inject(ExpectedReportApi);
  private route = inject(ActivatedRoute);
  private sub?: Subscription;
  private configSub?: Subscription;
  readonly groupsView = this.route.snapshot.data['mode'] === 'groups';
  readonly passages = signal<ExpectedPassage[]>([]);
  readonly selectedException = signal<ExpectedPerson | null>(null);
  readonly result = signal<ExpectedStatusPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly passageTotal = signal(0);
  readonly configLoading = signal(false);
  passageId: number | null = null;
  status = '';
  search = '';
  offset = 0;
  passageOffset = 0;
  ngOnInit() {
    this.status = this.groupsView ? 'EXCEPTION' : '';
    this.loadPassages();
  }
  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.configSub?.unsubscribe();
  }
  loadPassages() {
    this.configLoading.set(true);
    this.error.set('');
    this.configSub?.unsubscribe();
    this.configSub = this.api.passages(this.passageOffset).subscribe({
      next: (page) => {
        this.passages.update((old) => (this.passageOffset ? [...old, ...page.items] : page.items));
        this.passageTotal.set(page.total);
        this.configLoading.set(false);
        if (!this.passageId && page.items.length) {
          this.passageId = page.items[0].id;
          this.refresh();
        }
      },
      error: () => {
        this.configLoading.set(false);
        this.error.set('Liste des passages indisponible. Réessayez.');
      },
    });
  }
  morePassages() {
    this.passageOffset = this.passages().length;
    this.loadPassages();
  }
  selected() {
    return this.passages().find((p) => p.id === this.passageId);
  }
  refresh(reset = true) {
    if (!this.passageId) return;
    if (reset) this.offset = 0;
    this.selectedException.set(null);
    this.loading.set(true);
    this.error.set('');
    this.sub?.unsubscribe();
    const id = this.passageId;
    this.sub = this.api.status(id, this.status, this.offset, this.search).subscribe({
      next: (r) => {
        if (this.passageId === id) this.result.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          'Chargement impossible. Les dernières données affichées ne sont pas actualisées.',
        );
      },
    });
  }
  changePassage() {
    this.result.set(null);
    this.refresh();
  }
  selectStatus(status: string) {
    this.status = status;
    this.refresh();
  }
  page(direction: number) {
    this.offset = Math.max(0, this.offset + direction * 50);
    this.refresh(false);
  }
  time(value: string | null | undefined, seconds = false) {
    if (!value) return 'Heure indisponible';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Heure indisponible';
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: this.selected()?.timezone ?? 'Europe/Paris',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...(seconds ? { second: '2-digit' as const } : {}),
    }).format(date);
  }
  name(p: ExpectedPerson) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ');
  }
  state(p: ExpectedPerson) {
    return p.status === 'CONFIRMED'
      ? p.isException
        ? 'Confirmé par exception'
        : 'Confirmé'
      : p.status === 'REVIEW_ONLY'
        ? 'À vérifier seulement'
        : 'Sans passage confirmé';
  }
  typeLabel(p: ExpectedPerson) {
    return (
      ({ JEUNE: 'Jeune', ANIMATEUR: 'Animateur', BENEVOLE: 'Bénévole' } as Record<string, string>)[
        p.type
      ] ?? p.type
    );
  }
  verdict(v: string) {
    return (
      (
        {
          ACCEPTED: 'Accepté',
          DUPLICATE: 'Doublon',
          REJECTED_REVOKED: 'Badge révoqué',
          REJECTED_EXPIRED_ASSIGNMENT: 'Badge remplacé / expiré',
          REJECTED_NOT_EXPECTED: 'Hors groupe',
          REJECTED_NO_RIGHT: 'Droit de zone refusé',
          REJECTED_UNKNOWN: 'Code inconnu',
        } as Record<string, string>
      )[v] ?? v
    );
  }
}
