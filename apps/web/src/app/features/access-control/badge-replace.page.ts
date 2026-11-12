import { Component, inject, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import {
  AccessBadgeAssignment,
  AccessControlApiService,
  ParticipantSearchItem,
} from './access-control-api.service';

@Component({
  selector: 'app-badge-replace',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `
    <main class="page">
      <header class="head"><h1>Attribuer / remplacer un badge</h1></header>

      <section class="panel">
        <h2>1 · Trouver la personne</h2>
        <input type="search" [(ngModel)]="query" (ngModelChange)="onQuery($event)" placeholder="Nom, prénom…" />
        @for (p of results(); track p.id) {
          <button type="button" class="row" (click)="choose(p)">
            <span><strong>{{ p.firstName }} {{ p.lastName }}</strong><small>{{ sub(p) }}</small></span><span>›</span>
          </button>
        }
      </section>

      @if (person(); as p) {
        <section class="panel">
          <h2>2 · {{ activeBadge() ? 'Remplacement' : 'Attribution' }} pour {{ p.firstName }} {{ p.lastName }}</h2>
          @if (activeBadge(); as old) {
            <div class="card old">
              <span class="lbl">ANCIEN BADGE (sera déclaré perdu, inutilisable pour tout l'événement)</span>
              <code>{{ old.badge?.code ?? ('#' + old.badgeId) }}</code>
            </div>
          } @else {
            <p class="hint">Aucun badge actif : attribution simple.</p>
          }
          <div class="card new">
            <span class="lbl">NOUVEAU BADGE — scannez ou saisissez le code (stock disponible)</span>
            <input type="text" [(ngModel)]="newCode" placeholder="Code du nouveau badge" />
          </div>
          <p class="hint">Historique et repas déjà validés restent rattachés à {{ p.firstName }}. Mettre à jour le nom imprimé sur le badge de remplacement.</p>
          <div class="actions">
            <button tuiButton [appearance]="activeBadge() ? 'danger' : 'primary'" type="button" [disabled]="!newCode.trim() || saving()" (click)="confirm()">
              {{ saving() ? 'En cours…' : activeBadge() ? 'Remplacer le badge' : 'Attribuer le badge' }}
            </button>
            <button tuiButton appearance="secondary" type="button" (click)="reset()">Annuler</button>
          </div>
          @if (error(); as e) { <p class="err">{{ e }}</p> }
        </section>
      }

      @if (done(); as d) {
        <section class="panel done">
          <p>✓ {{ d }}</p>
          <button tuiButton appearance="secondary" type="button" (click)="reset()">Nouvelle opération</button>
        </section>
      }
    </main>
  `,
  styles: [`
    .page { padding: 24px; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .head h1 { margin: 0; font-size: 22px; }
    .panel { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 10px; }
    .panel h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--tui-text-secondary); }
    input { border: 1px solid #d7dbe3; border-radius: 8px; padding: 10px 12px; font-size: 15px; width: 100%; box-sizing: border-box; }
    .row { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 4px; background: none; border: none; border-bottom: 1px solid #f3f4f6; cursor: pointer; text-align: left; }
    .row small { display: block; color: var(--tui-text-secondary); }
    .card { border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
    .card.old { background: #fdeaea; border-left: 4px solid #d8453a; }
    .card.new { background: #e3f6ea; border-left: 4px solid #1a9e4b; }
    .lbl { font-size: 11px; color: var(--tui-text-secondary); }
    code { font-family: ui-monospace, monospace; font-size: 13px; }
    .hint { font-size: 13px; color: var(--tui-text-secondary); margin: 0; }
    .err { color: #d8453a; margin: 0; font-size: 14px; }
    .done { background: #e3f6ea; }
    .done p { margin: 0; font-weight: 600; color: #1a9e4b; }
    .actions { display: flex; gap: 8px; }
  `],
})
export class BadgeReplacePage {
  private readonly api = inject(AccessControlApiService);
  private readonly query$ = new Subject<string>();

  readonly results = signal<ParticipantSearchItem[]>([]);
  readonly person = signal<ParticipantSearchItem | null>(null);
  readonly history = signal<AccessBadgeAssignment[]>([]);
  readonly activeBadge = signal<AccessBadgeAssignment | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly done = signal<string | null>(null);

  query = '';
  newCode = '';

  constructor() {
    this.query$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((q) => this.search(q));
  }

  sub(p: ParticipantSearchItem): string {
    const team = p.teamMemberships?.[0]?.team?.name;
    return [team, p.type].filter(Boolean).join(' · ');
  }

  onQuery(q: string): void {
    this.query$.next(q);
  }

  private search(q: string): void {
    if (q.trim().length < 2) {
      this.results.set([]);
      return;
    }
    this.api.searchParticipants(q).subscribe({
      next: (res) => this.results.set(res.items),
      error: () => this.results.set([]),
    });
  }

  choose(p: ParticipantSearchItem): void {
    this.error.set(null);
    this.api.participantHistory(p.id).subscribe({
      next: (history) => {
        this.person.set(p);
        this.results.set([]);
        this.history.set(history);
        this.activeBadge.set(history.find((a) => a.endsAt === null) ?? null);
      },
      error: () => this.error.set('Historique indisponible.'),
    });
  }

  confirm(): void {
    const p = this.person();
    if (!p) return;
    this.saving.set(true);
    this.error.set(null);
    const opId = crypto.randomUUID();
    const call = this.activeBadge()
      ? this.api.replace(p.id, this.newCode.trim(), opId)
      : this.api.assign(p.id, this.newCode.trim(), opId);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.done.set(
          this.activeBadge()
            ? `Badge remplacé pour ${p.firstName} ${p.lastName} — ancien code déclaré perdu.`
            : `Badge attribué à ${p.firstName} ${p.lastName}.`,
        );
        this.person.set(null);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? "L'opération a échoué.");
      },
    });
  }

  reset(): void {
    this.person.set(null);
    this.history.set([]);
    this.activeBadge.set(null);
    this.newCode = '';
    this.query = '';
    this.results.set([]);
    this.error.set(null);
    this.done.set(null);
  }
}
