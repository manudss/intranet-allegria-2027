import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
export interface PdfPreviewRequest {
  url: string;
  body: unknown;
}
@Component({
  selector: 'app-family-pdf-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Aperçu du document PDF" [attr.aria-busy]="loading()">
    <header>
      <h3>Aperçu du document</h3>
      <span role="status">{{ status() }}</span>
    </header>
    <p>Rendu PDF réel, traité uniquement par ce portail. Les annexes font partie du document.</p>
    <nav aria-label="Pages du document">
      <button type="button" (click)="go(page() - 1)" [disabled]="page() <= 1 || loading()">
        Précédente
      </button>
      <label
        >Page
        <input
          type="number"
          min="1"
          [max]="count()"
          [disabled]="loading() || !count()"
          [value]="page()"
          (change)="go(+$any($event.target).value); $any($event.target).value = page()"
      /></label>
      <span>sur {{ count() || '…' }}</span>
      <button type="button" (click)="go(page() + 1)" [disabled]="page() >= count() || loading()">
        Suivante
      </button>
    </nav>
    <button type="button" (click)="zoom.set(zoom() === 1 ? 1.8 : 1)">
      {{ zoom() === 1 ? 'Agrandir la page' : 'Réduire la page' }}
    </button>
    <div class="paper" [class.stale]="loading() || !!error()">
      <canvas
        #canvas
        [style.width.%]="zoom() * 100"
        [attr.data-rendered-page]="renderedPage()"
        aria-label="Page du PDF réel"
      ></canvas>
    </div>
    @if (error()) {
      <p role="alert">{{ error() }}</p>
      <button type="button" (click)="retry()">Réessayer l’aperçu</button>
    }
    @if (blobUrl()) {
      <a [href]="blobUrl()" target="_blank" rel="noopener">Ouvrir ou télécharger le PDF complet</a>
    }
  </section>`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      section {
        border: 1px solid #d8c8bc;
        border-radius: 8px;
        background: #f7f2ed;
        padding: 1rem;
        color: #392c26;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      h3 {
        margin: 0;
        font-size: 1.1rem;
      }
      p {
        font-size: 0.85rem;
        line-height: 1.5;
      }
      nav {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        flex-wrap: wrap;
        margin: 1rem 0;
      }
      button,
      input {
        font: inherit;
        padding: 0.5rem;
        min-height: 44px;
        border: 1px solid #887467;
        border-radius: 5px;
        background: white;
        color: #392c26;
        box-sizing: border-box;
      }
      button {
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      input {
        width: 4rem;
      }
      label {
        display: flex;
        align-items: center;
        gap: 0.3rem;
      }
      .paper {
        background: white;
        min-height: 260px;
        overflow: auto;
      }
      canvas {
        display: block;
        width: 100%;
        height: auto;
      }
      .stale {
        opacity: 0.45;
      }
      a {
        display: inline-block;
        margin-top: 1rem;
        min-height: 44px;
        overflow-wrap: anywhere;
        color: #873015;
      }
      button:focus-visible,
      input:focus-visible,
      a:focus-visible {
        outline: 3px solid #254c8c;
        outline-offset: 3px;
      }
      [role='alert'] {
        color: #9e2117;
      }
    `,
  ],
})
export class FamilyPdfPreview implements AfterViewInit, OnDestroy {
  readonly request = input<PdfPreviewRequest | null>(null);
  readonly readyChange = output<boolean>();
  private http = inject(HttpClient);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  protected zoom = signal(1);
  protected renderedPage = signal(0);
  protected page = signal(1);
  protected count = signal(0);
  protected loading = signal(false);
  protected status = signal('En attente du document');
  protected error = signal('');
  protected blobUrl = signal('');
  private ready = signal(false);
  private refresh = signal(0);
  private doc?: PDFDocumentProxy;
  private loadingTask?: PDFDocumentLoadingTask;
  private task?: RenderTask;
  private generation = 0;
  private renderChain = Promise.resolve();
  constructor() {
    effect((onCleanup) => {
      const request = this.request();
      this.refresh();
      if (!this.browser || !this.ready() || !request) return;
      const generation = ++this.generation;
      this.readyChange.emit(false);
      this.loading.set(true);
      this.error.set('');
      this.status.set('Mise à jour…');
      // Do not offer a download from the previous version while new answers are pending.
      untracked(() => this.revoke());
      let subscription: { unsubscribe(): void } | undefined;
      const deadline = setTimeout(() => {
        if (generation !== this.generation) return;
        this.generation++;
        subscription?.unsubscribe();
        this.task?.cancel();
        void this.loadingTask?.destroy().catch(() => undefined);
        this.loadingTask = undefined;
        this.loading.set(false);
        this.status.set('Aperçu non à jour');
        this.error.set(
          'Le PDF met trop de temps à se préparer. Réessayez l’aperçu avant de signer. Vos réponses sont conservées.',
        );
      }, 60000);
      const timer = setTimeout(() => {
        subscription = this.http
          .post(request.url, request.body, { responseType: 'blob' })
          .subscribe({
            next: (blob) => {
              void this.load(blob, generation).finally(() => clearTimeout(deadline));
            },
            error: () => {
              if (generation === this.generation) {
                clearTimeout(deadline);
                this.loading.set(false);
                this.error.set(
                  'Aperçu indisponible. Vos réponses restent dans la fiche. Réessayez avant de signer.',
                );
                this.status.set('Aperçu non à jour');
              }
            },
          });
      }, 650);
      onCleanup(() => {
        clearTimeout(deadline);
        clearTimeout(timer);
        subscription?.unsubscribe();
      });
    });
  }
  ngAfterViewInit() {
    this.ready.set(true);
  }
  private async load(blob: Blob, generation: number) {
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'assets/pdfjs/pdf.worker.min.mjs',
        document.baseURI,
      ).href;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (generation !== this.generation) return;
      const loadingTask = pdfjs.getDocument({
        data: bytes,
        isEvalSupported: false,
        useSystemFonts: true,
      });
      this.loadingTask = loadingTask;
      const doc = await loadingTask.promise;
      if (this.loadingTask === loadingTask) this.loadingTask = undefined;
      if (generation !== this.generation) {
        await doc.destroy();
        return;
      }
      this.task?.cancel();
      await this.renderChain.catch(() => undefined);
      const previous = this.doc;
      this.doc = undefined;
      await previous?.destroy();
      if (generation !== this.generation) {
        await doc.destroy();
        return;
      }
      this.doc = doc;
      this.count.set(doc.numPages);
      this.page.set(Math.min(this.page(), doc.numPages));
      const url = URL.createObjectURL(blob);
      this.blobUrl.set(url);
      await this.render(generation);
    } catch {
      if (generation === this.generation) {
        this.loading.set(false);
        this.status.set('Aperçu non à jour');
        this.error.set('Impossible de lire le PDF. Réessayez l’aperçu.');
      }
    }
  }
  protected go(page: number) {
    if (!this.doc || !Number.isInteger(page) || page < 1 || page > this.count()) return;
    this.page.set(page);
    this.loading.set(true);
    this.status.set('Affichage de la page…');
    void this.render(this.generation);
  }
  protected retry() {
    this.refresh.update((n) => n + 1);
  }
  private render(generation: number) {
    this.task?.cancel();
    this.renderChain = this.renderChain
      .catch(() => undefined)
      .then(async () => {
        if (!this.doc || generation !== this.generation) return;
        const page = await this.doc.getPage(this.page());
        if (generation !== this.generation) return;
        const viewport = page.getViewport({ scale: 1.7 }),
          canvas = this.canvas.nativeElement;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        this.task = page.render({ canvas, viewport });
        await this.task.promise;
        if (generation !== this.generation) return;
        this.renderedPage.set(this.page());
        this.loading.set(false);
        this.status.set('À jour · ' + this.count() + ' pages');
        this.readyChange.emit(true);
      });
    return this.renderChain;
  }
  private revoke() {
    const url = this.blobUrl();
    if (url) URL.revokeObjectURL(url);
    this.blobUrl.set('');
  }
  ngOnDestroy() {
    this.generation++;
    this.task?.cancel();
    void this.loadingTask?.destroy().catch(() => undefined);
    void this.doc?.destroy();
    this.revoke();
  }
}
