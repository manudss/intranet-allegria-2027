import { FormsModule } from '@angular/forms';
import { Component, AfterViewInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import type { Result } from '@zxing/library';
import { ScanStore } from './scan.store';
import { Verdict } from './scan.models';

const VERDICT_MS = 1600;

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="scan">
      <header class="bar">
        <button type="button" class="link" (click)="exit()">← Quitter</button>
        <span class="chip" [class.stale]="store.tableFreshness() !== 'fresh'">
          {{ store.tableFreshness() === 'fresh' ? 'Table à jour' : 'Table ancienne' }}
        </span>
        <span class="pending" [class.warn]="store.pendingCount() > 0"
          >{{ store.pendingCount() }} en attente</span
        >
      </header>

      <div class="active-point">
        {{ store.activePoint()?.name }} · {{ store.activePoint()?.scanType?.label }}
      </div>
      <div class="viewer">
        <video #video muted playsinline></video>
        <div class="frame"></div>
      </div>

      @if (verdict(); as v) {
        <div class="verdict" [attr.data-kind]="v.kind" role="alert">
          <div class="v-context">
            {{ store.activePoint()?.name }} · {{ store.activePoint()?.scanType?.label
            }}<br /><small>{{ store.activePoint()?.serviceKey || 'Service du point' }}</small>
          </div>
          <div class="v-title">{{ exceptionOpen() ? 'Autoriser le passage ?' : v.title }}</div>
          <div class="v-detail">{{ v.detail }}</div>
          @if (v.exceptionConfirmed) {
            <div class="exception-tag">EXCEPTION · ajouté pour ce passage</div>
            <p>Le passage a été confirmé par le serveur.</p>
            <button class="exception-primary" (click)="nextScan()">
              Scanner la personne suivante
            </button>
          }
          @if (v.title === 'Hors groupe') {
            @if (exceptionOpen()) {
              <div class="exception-form">
                <p>
                  Ajout exceptionnel pour ce passage seulement. Aucun autre droit n'est modifié.
                </p>
                <label
                  >Groupe attendu<select [(ngModel)]="passageId" [disabled]="exceptionSaving()">
                    <option [ngValue]="null">Choisir un groupe</option>
                    @for (p of v.passages ?? []; track p.id) {
                      <option [ngValue]="p.id">{{ p.groupName }}</option>
                    }
                  </select></label
                >
                <label
                  >Motif de l'exception *<textarea
                    [(ngModel)]="exceptionReason"
                    maxlength="300"
                    rows="3"
                    [disabled]="exceptionSaving()"
                  ></textarea></label
                ><small>Pas de données médicales ni de détail sensible.</small>
                @if (exceptionError()) {
                  <p role="alert">{{ exceptionError() }}</p>
                }
                <button
                  class="exception-primary"
                  [disabled]="exceptionSaving() || !passageId || exceptionReason.trim().length < 3"
                  (click)="confirmException(v)"
                >
                  {{ exceptionSaving() ? 'Enregistrement…' : 'Confirmer et laisser passer' }}
                </button>
                <button
                  class="exception-secondary"
                  [disabled]="exceptionSaving()"
                  (click)="exceptionOpen.set(false)"
                >
                  Annuler · garder le refus
                </button>
              </div>
            } @else {
              <div class="group-context">
                Groupes attendus :
                @for (p of v.passages ?? []; track p.id) {
                  <strong>{{ p.groupName }}</strong>
                }
              </div>
              <p>La lecture reste en pause pendant la décision.</p>
              @if (v.exceptionAllowed) {
                <button class="exception-primary" (click)="openException(v)">
                  Laisser passer…
                </button>
              }
              <button class="exception-secondary" (click)="nextScan()">Maintenir le refus</button>
              @if (!v.exceptionAllowed) {
                <small>Vous n'avez pas le droit d'autoriser une exception à ce point.</small>
              }
            }
          }
          @if (v.servedCount !== undefined) {
            <div class="v-count">Service · {{ v.servedCount }} sur ce poste</div>
          }
        </div>
      }

      @if (exitError(); as e) {
        <p class="exit-error">{{ e }}</p>
      }

      <section class="manual">
        <input
          type="text"
          inputmode="text"
          placeholder="Saisie manuelle du code"
          [value]="manual()"
          (input)="onManual($event)"
          (keydown.enter)="submitManual()"
        />
        <button type="button" (click)="submitManual()">Valider</button>
      </section>
    </main>
  `,
  styles: [
    `
      .scan {
        height: 100dvh;
        display: flex;
        flex-direction: column;
        background: #101019;
        color: #fff;
      }
      .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 16px;
      }
      .link {
        background: none;
        border: none;
        color: #9db2ff;
        font-size: 15px;
        cursor: pointer;
      }
      .chip {
        background: #1a9e4b;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        border-radius: 999px;
        padding: 4px 10px;
      }
      .chip.stale {
        background: #b8860b;
      }
      .pending {
        font-size: 12px;
        color: #9aa0ae;
      }
      .pending.warn {
        color: #ffd166;
        font-weight: 700;
      }
      .active-point {
        padding: 0 16px 10px;
        text-align: center;
        font-weight: 600;
      }
      .viewer {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .frame {
        position: absolute;
        width: 230px;
        height: 230px;
        border: 3px solid #7cffb2;
        border-radius: 20px;
        pointer-events: none;
      }
      .verdict {
        position: fixed;
        inset: 0;
        z-index: 10;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        text-align: center;
        padding: 24px;
      }
      .verdict[data-kind='ok'] {
        background: #1a9e4b;
      }
      .verdict[data-kind='already'] {
        background: #b8860b;
      }
      .verdict[data-kind='ko'],
      .verdict[data-kind='unknown'],
      .verdict[data-kind='expired'],
      .verdict[data-kind='offline'] {
        background: #d8453a;
      }
      .v-title {
        font-size: 44px;
        font-weight: 800;
      }
      .verdict[data-kind='ok'] .v-title {
        font-size: 32px;
      }
      .verdict[data-kind='ok'] .v-detail {
        font-size: 42px;
        line-height: 1.15;
        overflow-wrap: anywhere;
      }
      .v-detail {
        font-size: 20px;
        font-weight: 600;
        opacity: 0.95;
      }
      .v-count {
        font-size: 18px;
        background: rgba(0, 0, 0, 0.25);
        border-radius: 12px;
        padding: 8px 16px;
      }
      .v-context {
        font-size: 14px;
        position: absolute;
        top: 20px;
        left: 20px;
        right: 20px;
        line-height: 1.5;
      }
      .v-context small {
        font-size: 12px;
        opacity: 0.85;
      }
      .group-context {
        font-size: 14px;
        background: #0002;
        border-radius: 12px;
        padding: 14px;
        width: 100%;
        max-width: 380px;
        box-sizing: border-box;
      }
      .group-context strong {
        display: block;
        margin-top: 5px;
      }
      .verdict[data-kind='ok'] .exception-primary {
        color: #18713c;
      }
      .verdict:has(.exception-form) .v-context {
        position: static;
      }
      .verdict:has(.exception-form) .v-title {
        max-width: 350px;
        font-size: 25px;
      }
      .exception-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
        text-align: left;
        max-width: 380px;
        width: 100%;
      }
      .exception-form label {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 14px;
      }
      .exception-form input,
      .exception-form select,
      .exception-form textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #ffffff88;
        border-radius: 10px;
        padding: 12px;
        font: inherit;
        background: #ffffff;
        color: #222;
        min-height: 48px;
      }
      .exception-primary,
      .exception-secondary {
        max-width: 380px;
        width: 100%;
        padding: 16px;
        border-radius: 12px;
        min-height: 52px;
        font-size: 17px;
        font-weight: 700;
        border: 0;
      }
      .exception-primary {
        background: white;
        color: #a82d27;
      }
      .exception-secondary {
        background: transparent;
        color: white;
        border: 1px solid #ffffff99;
      }
      .exception-tag {
        background: #fff1cc;
        color: #7c5007;
        padding: 12px;
        border-radius: 8px;
        font-weight: 700;
      }
      .verdict:has(.exception-form) {
        background: #202d4b;
        overflow: auto;
        justify-content: flex-start;
        padding-top: 24px;
      }
      .verdict:has(.exception-form) .v-title {
        font-size: 28px;
      }
      .verdict:has(.exception-form) .v-detail {
        font-size: 18px;
      }
      .verdict button:disabled {
        opacity: 0.55;
      }
      .verdict p {
        max-width: 380px;
        font-size: 15px;
      }
      .verdict small {
        font-size: 12px;
        max-width: 380px;
      }
      .exit-error {
        margin: 0 16px 8px;
        color: #ffd166;
        font-size: 13px;
      }
      .manual {
        display: flex;
        gap: 8px;
        padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      }
      .manual input {
        flex: 1;
        height: 48px;
        border-radius: 12px;
        border: 1px solid #3a3a4a;
        background: #1c1c28;
        color: #fff;
        padding: 0 14px;
        font-size: 15px;
      }
      .manual button {
        height: 48px;
        padding: 0 18px;
        border: none;
        border-radius: 12px;
        background: #526ed3;
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
    `,
  ],
})
export class ScannerComponent implements AfterViewInit, OnDestroy {
  readonly store = inject(ScanStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly manual = signal('');
  readonly verdict = signal<Verdict | null>(null);

  private reader: BrowserQRCodeReader | null = null;
  private controls: IScannerControls | null = null;
  private busy = false;
  private verdictTimer: ReturnType<typeof setTimeout> | null = null;

  async ngAfterViewInit(): Promise<void> {
    await this.store.init();
    if (!this.store.ready()) {
      await this.router.navigate(['/scan']);
      return;
    }
    if (String(this.store.activePoint()?.id) !== this.route.snapshot.paramMap.get('pointId')) {
      await this.router.navigate(['/scan']);
      return;
    }
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.controls?.stop();
    if (this.verdictTimer) clearTimeout(this.verdictTimer);
  }

  private startCamera(): void {
    const video = document.querySelector<HTMLVideoElement>('video');
    if (!video || typeof navigator.mediaDevices?.getUserMedia !== 'function') return;
    this.reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 300 });
    void this.reader
      .decodeFromVideoDevice(undefined, video, (result: Result | undefined) => {
        if (!result || this.busy) return;
        void this.handleCode(result.getText());
      })
      .then((controls: IScannerControls) => (this.controls = controls))
      .catch(() => undefined);
  }

  onManual(event: Event): void {
    this.manual.set((event.target as HTMLInputElement).value);
  }

  async submitManual(): Promise<void> {
    const code = this.manual().trim();
    if (!code || this.busy) return;
    this.manual.set('');
    await this.handleCode(code);
  }

  private async handleCode(code: string): Promise<void> {
    this.busy = true;
    try {
      const v = await this.store.recordScan(code);
      this.showVerdict(v);
    } catch {
      this.showVerdict({
        kind: 'ko',
        title: 'Scan non enregistré',
        detail: 'Stockage indisponible. Ne pas laisser passer. Réessayez.',
      });
    }
  }

  private showVerdict(v: Verdict): void {
    this.verdict.set(v);
    if (this.verdictTimer) clearTimeout(this.verdictTimer);
    if (v.title === 'Hors groupe' || v.exceptionConfirmed) return;
    const sticky = v.kind === 'ko' || v.kind === 'unknown' || v.kind === 'expired';
    this.verdictTimer = setTimeout(
      () => {
        this.verdict.set(null);
        this.busy = false;
      },
      sticky ? VERDICT_MS * 2 : VERDICT_MS,
    );
  }

  readonly exceptionOpen = signal(false);
  readonly exceptionSaving = signal(false);
  readonly exceptionError = signal('');
  exceptionReason = '';
  passageId: number | null = null;
  private exceptionOperation = '';
  nextScan() {
    if (this.exceptionSaving()) return;
    this.exceptionOpen.set(false);
    this.verdict.set(null);
    this.busy = false;
  }
  openException(v: Verdict) {
    this.exceptionOpen.set(true);
    this.exceptionReason = '';
    this.exceptionError.set('');
    this.passageId = v.passages?.length === 1 ? v.passages[0].id : null;
    this.exceptionOperation = crypto.randomUUID();
  }
  async confirmException(v: Verdict) {
    if (this.exceptionSaving() || !this.passageId || this.exceptionReason.trim().length < 3) return;
    this.exceptionSaving.set(true);
    this.exceptionError.set('');
    try {
      const accepted = await this.store.authorizeException(
        v,
        this.passageId,
        this.exceptionReason,
        this.exceptionOperation,
      );
      this.exceptionOpen.set(false);
      this.showVerdict(accepted);
    } catch {
      this.exceptionError.set(
        'Exception non confirmée. Ne pas laisser passer. Réessayez sans changer les choix, ou contactez un référent.',
      );
    } finally {
      this.exceptionSaving.set(false);
    }
  }

  readonly exitError = signal<string | null>(null);

  async exit(): Promise<void> {
    this.exitError.set(null);
    const done = await this.store.exitSession();
    if (!done) {
      this.exitError.set(
        `${this.store.pendingCount()} scan(s) non envoyés : reconnectez l'appareil et réessayez avant de quitter (rien n'est effacé).`,
      );
      return;
    }
    this.controls?.stop();
    await this.router.navigate(['/']);
  }
}
