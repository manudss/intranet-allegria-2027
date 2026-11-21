import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { inject } from '@angular/core';
import type { SignatureAppearance } from '@mej-allegria/shared';
import { FamilyPdfPreview } from './family-pdf-preview';
export interface SignatureDraft {
  name: string;
  capacity?: string;
  appearance: SignatureAppearance;
}
@Component({
  selector: 'app-family-signature',
  imports: [FamilyPdfPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './family-signature.html',
  styleUrl: './family-signature.scss',
})
export class FamilySignaturePanel implements OnDestroy {
  readonly endpoint = input.required<string>();
  readonly prepare = input.required<() => Promise<Record<string, unknown> | null>>();
  readonly preview = input<{ url: string; body: Record<string, unknown> } | null>(null);
  readonly signer = input('');
  readonly capacity = input('LEGAL');
  readonly showPreview = input(true);
  readonly previewReady = input(false);
  protected ownPreviewReady = signal(false);
  protected pdfReady = computed(() =>
    this.showPreview() ? this.ownPreviewReady() : this.previewReady(),
  );
  readonly documentKey = input.required<string>();
  readonly completed = output<unknown>();
  readonly busyChanged = output<boolean>();
  readonly appearanceChanged = output<SignatureDraft | undefined>();
  private http = inject(HttpClient);
  protected name = signal('');
  protected role = signal('LEGAL');
  protected method = signal<SignatureAppearance['method']>('NAME');
  protected image = signal('');
  protected accepted = signal(false);
  protected code = signal('');
  protected busy = signal(false);
  protected error = signal('');
  protected message = signal('');
  protected challenge = signal<{ challengeId: string; recipient: string } | null>(null);
  protected step = signal<'document' | 'signature' | 'code' | 'done'>('document');
  protected expiresAt = signal(0);
  protected now = signal(Date.now());
  protected remaining = computed(() =>
    Math.max(0, Math.ceil((this.expiresAt() - this.now()) / 1000)),
  );
  protected draft = computed<SignatureDraft>(() => ({
    name: this.name(),
    capacity: this.role(),
    appearance:
      this.method() === 'NAME'
        ? { method: 'NAME' }
        : { method: this.method(), image: this.image() },
  }));
  protected previewRequest = computed(() => {
    const p = this.preview();
    return p ? { url: p.url, body: { ...p.body, ...this.draft() } } : null;
  });
  @ViewChild('ink') canvas?: ElementRef<HTMLCanvasElement>;
  private drawing = false;
  private inked = false;
  private prepared?: Record<string, unknown>;
  private timer = setInterval(() => this.now.set(Date.now()), 1000);
  private initialised = false;
  private generation = 0;
  constructor() {
    effect(() => this.busyChanged.emit(this.busy()));
    effect(() => {
      const signer = this.signer(),
        capacity = this.capacity();
      if (!this.initialised) {
        this.name.set(signer);
        this.role.set(capacity === 'SELF_ADULT' ? 'SELF_ADULT' : 'LEGAL');
        this.initialised = true;
      }
    });
    effect(() => {
      this.appearanceChanged.emit(this.draft());
    });
    effect(() => {
      this.documentKey();
      this.invalidate();
    });
  }
  protected editName(value: string) {
    this.name.set(value);
    this.invalidate();
  }
  protected editRole(value: string) {
    this.role.set(value);
    this.invalidate();
  }
  protected choose(method: SignatureAppearance['method']) {
    this.method.set(method);
    this.image.set('');
    this.inked = false;
    this.invalidate();
  }
  protected invalidate() {
    this.generation++;
    const step = untracked(() => this.step());
    if (step === 'code' || step === 'done') this.step.set('signature');
    this.challenge.set(null);
    this.code.set('');
    this.accepted.set(false);
    this.prepared = undefined;
    this.message.set('');
  }
  protected start() {
    this.step.set('signature');
    this.error.set('');
  }
  protected back() {
    this.invalidate();
    this.step.set('signature');
    this.error.set('');
  }
  protected stroke(event: PointerEvent, start = false) {
    const c = this.canvas?.nativeElement;
    if (!c || this.busy()) return;
    const r = c.getBoundingClientRect(),
      ctx = c.getContext('2d');
    if (!ctx) return;
    const x = ((event.clientX - r.left) * c.width) / r.width,
      y = ((event.clientY - r.top) * c.height) / r.height;
    if (start) {
      this.drawing = true;
      c.setPointerCapture(event.pointerId);
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (this.drawing) {
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#202936';
      ctx.lineTo(x, y);
      ctx.stroke();
      this.inked = true;
    }
  }
  protected end() {
    if (!this.drawing) return;
    this.drawing = false;
    if (this.inked) {
      this.image.set(this.canvas!.nativeElement.toDataURL('image/png'));
      this.invalidate();
    }
  }
  protected clear() {
    const c = this.canvas?.nativeElement;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    this.image.set('');
    this.inked = false;
    this.invalidate();
  }
  protected async upload(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    this.invalidate();
    this.image.set('');
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      this.error.set('Choisissez un PNG ou JPEG de moins de 2 Mo.');
      input.value = '';
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 4096 || bitmap.height > 4096) {
        bitmap.close();
        throw new Error();
      }
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 180;
      const ctx = canvas.getContext('2d')!;
      const scale = Math.min(600 / bitmap.width, 180 / bitmap.height);
      ctx.drawImage(bitmap, 0, 0, bitmap.width * scale, bitmap.height * scale);
      bitmap.close();
      const image = canvas.toDataURL('image/png');
      if (image.length > 65000) throw new Error();
      this.image.set(image);
      this.error.set('');
    } catch {
      this.error.set(
        'Image illisible ou trop complexe. Recadrez votre signature ou saisissez votre nom.',
      );
    }
    input.value = '';
  }
  protected async requestCode() {
    if (
      !this.pdfReady() ||
      this.busy() ||
      !this.accepted() ||
      !this.name().trim() ||
      (this.method() !== 'NAME' && !this.image())
    )
      return;
    this.busy.set(true);
    this.error.set('');
    const generation = this.generation;
    try {
      const data = await this.prepare()();
      if (generation !== this.generation) {
        this.error.set('Le document a changé. Relisez-le avant de demander un code.');
        return;
      }
      if (!data) {
        this.error.set('Enregistrez les modifications avant de signer.');
        return;
      }
      const draft = this.draft();
      this.prepared = {
        ...data,
        name: draft.name,
        signerName: draft.name,
        appearance: draft.appearance,
        capacity: this.role(),
        accepted: true,
      };
      const challenge = await firstValueFrom(
        this.http.post<{ challengeId: string; recipient: string }>(
          this.endpoint() + '/code',
          this.prepared,
        ),
      );
      if (generation !== this.generation) {
        this.error.set(
          'Le document a changé. Le code envoyé ne peut pas confirmer cette nouvelle version.',
        );
        return;
      }
      this.challenge.set(challenge);
      this.expiresAt.set(Date.now() + 600000);
      this.now.set(Date.now());
      this.code.set('');
      this.step.set('code');
      this.message.set(
        'Un code distinct de la connexion vient d’être envoyé. Aucun document n’est signé pour le moment.',
      );
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }
  protected async confirm() {
    const challenge = this.challenge();
    if (
      !challenge ||
      !this.prepared ||
      this.busy() ||
      !/^\d{8}$/.test(this.code()) ||
      !this.remaining()
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.http.post(this.endpoint(), {
          ...this.prepared,
          challengeId: challenge.challengeId,
          code: this.code(),
        }),
      );
      this.step.set('done');
      this.code.set('');
      this.challenge.set(null);
      this.accepted.set(false);
      this.message.set('Signature confirmée et PDF figé conservé.');
      this.completed.emit(result);
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }
  private fail(e: unknown) {
    const message =
      e instanceof HttpErrorResponse && e.status < 500 && typeof e.error?.message === 'string'
        ? e.error.message
        : 'Action impossible. Réessayez, aucun succès de signature n’a été confirmé.';
    this.error.set(message);
  }
  ngOnDestroy() {
    clearInterval(this.timer);
    this.busyChanged.emit(false);
    this.appearanceChanged.emit(undefined);
  }
}
