import { Component, AfterViewInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import type { Result } from '@zxing/library';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  AccessBadge,
  AccessBadgeAssignment,
  BadgeAssignApiService,
  ParticipantSearchItem,
  activeAssignmentOf,
  deriveAssignMode,
} from './badge-assign.service';

const ASSIGN_ROLES = ['BADGE_MANAGER', 'ADMIN'];
type Step = 'scan' | 'search' | 'confirm' | 'done';

@Component({
  selector: 'app-badge-assign',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="flow">
      @if (!allowed()) {
        <section class="card"><h1>Accès réservé</h1><p>L'attribution de badges nécessite le rôle « gestion des badges ».</p></section>
      } @else {
        <header class="bar">
          <a routerLink="/scan" class="link">← Retour</a>
          <h1>{{ step() === 'confirm' && mode() === 'replace' ? 'Remplacer un badge' : 'Attribuer un badge' }}</h1>
          <span class="step">Étape {{ stepIndex() }}/3</span>
        </header>

        @if (error(); as e) { <p class="error">{{ e }}</p> }

        @switch (step()) {
          @case ('scan') {
            <div class="viewer">
              <video muted playsinline></video>
              <div class="frame"></div>
              <p class="cap">Scannez le QR du badge à attribuer</p>
            </div>
            <section class="manual">
              <input type="text" placeholder="Saisir le code à la main" [value]="manual()" (input)="onManual($event)" (keydown.enter)="submitManual()" />
              <button type="button" (click)="submitManual()">OK</button>
            </section>
          }
          @case ('search') {
            @if (badge(); as b) {
              <section class="card badge-card">
                <div><span class="lbl">BADGE</span><code>{{ short(b.code) }}</code></div>
                <span class="chip ok">Disponible{{ b.lot ? ' · ' + b.lot : '' }}</span>
              </section>
            }
            <section class="card">
              <input class="search" type="search" placeholder="Rechercher une personne" [value]="query()" (input)="onQuery($event)" />
            </section>
            @if (searching()) { <p class="muted">Recherche…</p> }
            <section class="card results">
              @for (p of results(); track p.id) {
                <button type="button" class="row" (click)="choose(p)">
                  <span><strong>{{ p.firstName }} {{ p.lastName }}</strong><small>{{ personSub(p) }}</small></span><span class="chev">›</span>
                </button>
              } @empty {
                @if (query().trim().length >= 2 && !searching()) { <p class="muted">Aucune personne trouvée.</p> }
              }
            </section>
            <p class="note">Recherche sur le serveur, 5 résultats max · chaque attribution est journalisée.</p>
          }
          @case ('confirm') {
            @if (person(); as p) {
              @if (mode() === 'replace') {
                <section class="card old">
                  <span class="lbl">ANCIEN BADGE (perdu)</span>
                  <code>{{ short(oldBadgeCode()) }}</code>
                  <p>Sera <strong>déclaré perdu</strong> et inutilisable pour tout l'événement.</p>
                </section>
                <div class="arrow">↓</div>
                <section class="card new">
                  <span class="lbl">NOUVEAU BADGE pour {{ p.firstName }} {{ p.lastName }}</span>
                  <code>{{ short(badge()?.code ?? '') }}</code>
                  <p>Historique et repas déjà validés restent rattachés à {{ p.firstName }}.</p>
                </section>
                <button class="cta danger" type="button" [disabled]="submitting()" (click)="confirm()">{{ submitting() ? 'En cours…' : 'Remplacer le badge' }}</button>
              } @else {
                <section class="card confirm">
                  <div class="name">{{ p.firstName }} {{ p.lastName }}</div>
                  <div class="sub">{{ personSub(p) }}</div>
                  <code>{{ short(badge()?.code ?? '') }}</code>
                  <span class="chip ok">Aucun badge actif</span>
                </section>
                <button class="cta" type="button" [disabled]="submitting()" (click)="confirm()">{{ submitting() ? 'En cours…' : 'Attribuer le badge' }}</button>
              }
              <button class="ghost" type="button" (click)="backToSearch()">Annuler</button>
            }
          }
          @case ('done') {
            <section class="card confirm">
              <div class="big-ok">✓</div>
              <div class="name">{{ doneLabel() }}</div>
              <p class="note">Attribution journalisée. Pensez au nom imprimé sur le badge.</p>
            </section>
            <button class="cta" type="button" (click)="restart()">Nouvelle attribution</button>
          }
        }
      }
    </main>
  `,
  styles: [`
    .flow { max-width: 480px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; min-height: 100dvh; }
    .bar { display: flex; align-items: center; gap: 12px; }
    .bar h1 { font-size: 17px; margin: 0; flex: 1; }
    .link { color: #526ed3; text-decoration: none; font-size: 15px; }
    .step { font-size: 12px; color: #6b7280; }
    .viewer { position: relative; height: 320px; background: #1c1c28; border-radius: 16px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; object-fit: cover; }
    .frame { position: absolute; width: 200px; height: 200px; border: 3px solid #7cffb2; border-radius: 20px; pointer-events: none; }
    .cap { position: absolute; bottom: 10px; color: #fff; font-size: 13px; opacity: .85; }
    .manual { display: flex; gap: 8px; }
    .manual input { flex: 1; height: 48px; border-radius: 12px; border: 1px solid #d7dbe3; padding: 0 14px; font-size: 15px; }
    .manual button { height: 48px; padding: 0 18px; border: none; border-radius: 12px; background: #526ed3; color: #fff; font-weight: 700; }
    .card { background: #fff; border-radius: 16px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .badge-card { display: flex; justify-content: space-between; align-items: center; }
    .lbl { display: block; font-size: 11px; color: #6b7280; margin-bottom: 2px; }
    code { font-family: ui-monospace, monospace; font-size: 13px; color: #3c4457; }
    .chip { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .chip.ok { background: #e3f6ea; color: #1a9e4b; }
    .search { width: 100%; height: 48px; border: none; font-size: 16px; outline: none; background: transparent; }
    .results { padding: 6px 0; }
    .row { display: flex; width: 100%; justify-content: space-between; align-items: center; padding: 12px 16px; background: none; border: none; border-bottom: 1px solid #f3f4f6; cursor: pointer; text-align: left; }
    .row:last-child { border-bottom: none; }
    .row small { display: block; color: #6b7280; font-size: 12px; }
    .chev { color: #526ed3; }
    .old { border-left: 4px solid #d8453a; }
    .new { border-left: 4px solid #1a9e4b; }
    .arrow { text-align: center; color: #526ed3; font-size: 20px; }
    .confirm { text-align: center; padding: 24px 16px; display: flex; flex-direction: column; gap: 8px; align-items: center; }
    .name { font-size: 24px; font-weight: 800; }
    .sub { font-size: 13px; color: #6b7280; }
    .cta { height: 52px; border: none; border-radius: 12px; background: #526ed3; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
    .cta.danger { background: #d8453a; }
    .cta:disabled { opacity: .5; }
    .ghost { height: 48px; border: none; border-radius: 12px; background: #e8ecf7; color: #526ed3; font-weight: 600; cursor: pointer; }
    .error { color: #d8453a; font-size: 14px; margin: 0; }
    .note { font-size: 12px; color: #6b7280; margin: 0; }
    .muted { color: #6b7280; font-size: 14px; text-align: center; }
    .big-ok { font-size: 48px; color: #1a9e4b; }
  `],
})
export class BadgeAssignComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(BadgeAssignApiService);
  private readonly auth = inject(AuthService);

  readonly allowed = signal(false);
  readonly step = signal<Step>('scan');
  readonly error = signal<string | null>(null);
  readonly manual = signal('');
  readonly badge = signal<AccessBadge | null>(null);
  readonly query = signal('');
  readonly searching = signal(false);
  readonly results = signal<ParticipantSearchItem[]>([]);
  readonly person = signal<ParticipantSearchItem | null>(null);
  readonly history = signal<AccessBadgeAssignment[]>([]);
  readonly mode = signal<'assign' | 'replace'>('assign');
  readonly submitting = signal(false);
  readonly doneLabel = signal('');

  private readonly query$ = new Subject<string>();
  private operationId: string | null = null;
  private reader: BrowserQRCodeReader | null = null;
  private controls: IScannerControls | null = null;

  ngAfterViewInit(): void {
    this.allowed.set(this.auth.hasAnyRole(ASSIGN_ROLES));
    if (!this.allowed()) return;
    this.query$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((q) => this.search(q));
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.controls?.stop();
    this.query$.complete();
  }

  stepIndex(): number {
    return { scan: 1, search: 2, confirm: 3, done: 3 }[this.step()];
  }

  short(code: string): string {
    return code.replace(/(.{4})/g, '$1 ').trim();
  }

  personSub(p: ParticipantSearchItem): string {
    const team = p.teamMemberships?.[0]?.team?.name;
    return [team, p.type].filter(Boolean).join(' · ');
  }

  oldBadgeCode(): string {
    return activeAssignmentOf(this.history())?.badge?.code ?? '';
  }

  private startCamera(): void {
    const video = document.querySelector<HTMLVideoElement>('video');
    if (!video || typeof navigator.mediaDevices?.getUserMedia !== 'function') return;
    this.reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 300 });
    void this.reader
      .decodeFromVideoDevice(undefined, video, (result: Result | undefined) => {
        if (result && this.step() === 'scan') void this.loadBadge(result.getText());
      })
      .then((controls: IScannerControls) => (this.controls = controls))
      .catch(() => undefined);
  }

  onManual(event: Event): void {
    this.manual.set((event.target as HTMLInputElement).value);
  }

  submitManual(): void {
    const code = this.manual().trim();
    if (code) void this.loadBadge(code);
  }

  private loadBadge(code: string): void {
    this.error.set(null);
    this.api.findByCode(code).subscribe({
      next: (badge) => {
        if (badge.status !== 'AVAILABLE') {
          this.error.set(`Ce badge n'est pas disponible (${badge.status}). Un code perdu ou révoqué n'est jamais réattribué.`);
          return;
        }
        this.controls?.stop();
        this.badge.set(badge);
        this.step.set('search');
      },
      error: () => this.error.set('Badge introuvable dans le stock. Vérifiez le code.'),
    });
  }

  onQuery(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.query.set(q);
    this.query$.next(q);
  }

  private search(q: string): void {
    if (q.trim().length < 2) {
      this.results.set([]);
      return;
    }
    this.searching.set(true);
    this.api.searchParticipants(q).subscribe({
      next: (res) => {
        this.results.set(res.items);
        this.searching.set(false);
      },
      error: () => {
        this.searching.set(false);
        this.error.set('Recherche impossible. Réessayez.');
      },
    });
  }

  choose(p: ParticipantSearchItem): void {
    this.error.set(null);
    this.api.participantHistory(p.id).subscribe({
      next: (history) => {
        this.operationId = null;
        this.person.set(p);
        this.history.set(history);
        this.mode.set(deriveAssignMode(history));
        this.step.set('confirm');
      },
      error: () => this.error.set("Impossible de vérifier les badges de cette personne."),
    });
  }

  backToSearch(): void {
    this.step.set('search');
  }

  confirm(): void {
    const p = this.person();
    const b = this.badge();
    if (!p || !b || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    const opId = this.operationId ??= crypto.randomUUID();
    const call =
      this.mode() === 'replace'
        ? this.api.replace(p.id, b.code, opId, 'Remplacement badge perdu (mobile)')
        : this.api.assign(p.id, b.code, opId, 'Attribution mobile');
    call.subscribe({
      next: () => {
        this.submitting.set(false);
        this.doneLabel.set(
          this.mode() === 'replace'
            ? `Badge remplacé pour ${p.firstName} ${p.lastName}`
            : `Badge attribué à ${p.firstName} ${p.lastName}`,
        );
        this.step.set('done');
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message ?? "L'opération a échoué. Réessayez.");
      },
    });
  }

  restart(): void {
    this.operationId = null;
    this.badge.set(null);
    this.person.set(null);
    this.history.set([]);
    this.results.set([]);
    this.query.set('');
    this.manual.set('');
    this.error.set(null);
    this.step.set('scan');
    setTimeout(() => this.startCamera());
  }
}
