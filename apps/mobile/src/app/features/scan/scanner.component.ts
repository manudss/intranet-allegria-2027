import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import type { Result } from '@zxing/library';
import { ScanStore } from './scan.store';
import { Verdict } from './scan.models';

const VERDICT_MS = 1600;

@Component({
  selector: 'app-scanner',
  standalone: true,
  template: `
    <main class="scan">
      <header class="bar">
        <button type="button" class="link" (click)="exit()">← Quitter</button>
        <span class="chip" [class.stale]="store.tableFreshness() !== 'fresh'">
          {{ store.tableFreshness() === 'fresh' ? 'Table à jour' : 'Table ancienne' }}
        </span>
        <span class="pending" [class.warn]="store.pendingCount() > 0">{{ store.pendingCount() }} en attente</span>
      </header>

      <div class="viewer">
        <video #video muted playsinline></video>
        <div class="frame"></div>
      </div>

      @if (verdict(); as v) {
        <div class="verdict" [attr.data-kind]="v.kind" role="alert">
          <div class="v-title">{{ v.title }}</div>
          <div class="v-detail">{{ v.detail }}</div>
          @if (v.servedCount != null) {
            <div class="v-count">Service n° {{ v.servedCount }}</div>
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
  styles: [`
    .scan { height: 100dvh; display: flex; flex-direction: column; background: #101019; color: #fff; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px; }
    .link { background: none; border: none; color: #9db2ff; font-size: 15px; cursor: pointer; }
    .chip { background: #1a9e4b; color: #fff; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 4px 10px; }
    .chip.stale { background: #b8860b; }
    .pending { font-size: 12px; color: #9aa0ae; }
    .pending.warn { color: #ffd166; font-weight: 700; }
    .viewer { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; object-fit: cover; }
    .frame { position: absolute; width: 230px; height: 230px; border: 3px solid #7cffb2; border-radius: 20px; pointer-events: none; }
    .verdict { position: fixed; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; }
    .verdict[data-kind='ok'] { background: #1a9e4b; }
    .verdict[data-kind='already'] { background: #b8860b; }
    .verdict[data-kind='ko'], .verdict[data-kind='unknown'], .verdict[data-kind='expired'], .verdict[data-kind='offline'] { background: #d8453a; }
    .v-title { font-size: 44px; font-weight: 800; }
    .v-detail { font-size: 20px; font-weight: 600; opacity: .95; }
    .v-count { font-size: 18px; background: rgba(0,0,0,.25); border-radius: 12px; padding: 8px 16px; }
    .exit-error { margin: 0 16px 8px; color: #ffd166; font-size: 13px; }
    .manual { display: flex; gap: 8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }
    .manual input { flex: 1; height: 48px; border-radius: 12px; border: 1px solid #3a3a4a; background: #1c1c28; color: #fff; padding: 0 14px; font-size: 15px; }
    .manual button { height: 48px; padding: 0 18px; border: none; border-radius: 12px; background: #526ed3; color: #fff; font-weight: 700; cursor: pointer; }
  `],
})
export class ScannerComponent implements OnInit, OnDestroy {
  readonly store = inject(ScanStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly manual = signal('');
  readonly verdict = signal<Verdict | null>(null);

  private reader: BrowserQRCodeReader | null = null;
  private controls: IScannerControls | null = null;
  private busy = false;
  private verdictTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    await this.store.init();
    if (!this.store.ready()) {
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
    } finally {
      this.busy = false;
    }
  }

  private showVerdict(v: Verdict): void {
    this.verdict.set(v);
    if (this.verdictTimer) clearTimeout(this.verdictTimer);
    const sticky = v.kind === 'ko' || v.kind === 'unknown' || v.kind === 'expired';
    this.verdictTimer = setTimeout(() => this.verdict.set(null), sticky ? VERDICT_MS * 2 : VERDICT_MS);
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
