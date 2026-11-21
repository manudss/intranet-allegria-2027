import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FamilySignaturePanel } from './family-signature';
describe('Signature UI, per-document consent and distinct email code', () => {
  let fixture: ComponentFixture<FamilySignaturePanel>, http: HttpTestingController;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [FamilySignaturePanel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(FamilySignaturePanel);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('endpoint', '/signature');
    fixture.componentRef.setInput('documentKey', 'doc-v1');
    fixture.componentRef.setInput('signer', 'Parent FICTIF');
    fixture.componentRef.setInput('showPreview', false);
    fixture.componentRef.setInput('previewReady', true);
    fixture.componentRef.setInput('prepare', async () => ({ revision: 3, version: 'v1' }));
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => {
    http.verify();
    fixture.destroy();
    TestBed.resetTestingModule();
  });
  const button = (name: string) =>
    Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.trim() === name)!;
  async function prepare() {
    button('Passer à ma signature').click();
    fixture.detectChanges();
    const box = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    button('Envoyer mon code de signature').click();
    await fixture.whenStable();
  }
  it('requires PDF readiness, a name and explicit consent before requesting the code', async () => {
    button('Passer à ma signature').click();
    fixture.detectChanges();
    expect(button('Envoyer mon code de signature').disabled).toBe(true);
    const box = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.componentRef.setInput('previewReady', false);
    fixture.detectChanges();
    expect(button('Envoyer mon code de signature').disabled).toBe(true);
    http.expectNone('/signature/code');
  });
  it('does not sign on email request; submits the exact prepared appearance only after the distinct code', async () => {
    const done = vi.fn();
    fixture.componentInstance.completed.subscribe(done);
    await prepare();
    const req = http.expectOne('/signature/code');
    expect(req.request.body.appearance).toEqual({ method: 'NAME' });
    expect(req.request.body.accepted).toBe(true);
    expect(req.request.body.revision).toBe(3);
    req.flush({ challengeId: 'fiction', recipient: 'f***@example.test' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(done).not.toHaveBeenCalled();
    http.expectNone('/signature');
    const input = fixture.nativeElement.querySelector(
      'input[autocomplete=one-time-code]',
    ) as HTMLInputElement;
    input.value = '12345678';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Confirmer ma signature').click();
    const confirm = http.expectOne('/signature');
    expect(confirm.request.body).toMatchObject({
      challengeId: 'fiction',
      code: '12345678',
      revision: 3,
      appearance: { method: 'NAME' },
      accepted: true,
    });
    confirm.flush({ signature: 'fiction' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(done).toHaveBeenCalledWith({ signature: 'fiction' });
    expect(fixture.nativeElement.textContent).toContain('Signature confirmée');
  });
  it('never emits success on a bad code, retains the code screen and exposes the server error', async () => {
    const done = vi.fn();
    fixture.componentInstance.completed.subscribe(done);
    await prepare();
    http
      .expectOne('/signature/code')
      .flush({ challengeId: 'fiction', recipient: 'f***@example.test' });
    await fixture.whenStable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      'input[autocomplete=one-time-code]',
    ) as HTMLInputElement;
    input.value = '00000000';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Confirmer ma signature').click();
    http
      .expectOne('/signature')
      .flush(
        { message: 'Code de signature invalide' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(done).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'Code de signature invalide',
    );
  });
  it('invalidates consent on changed identity, appearance or document version', async () => {
    button('Passer à ma signature').click();
    fixture.detectChanges();
    const box = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(button('Envoyer mon code de signature').disabled).toBe(false);
    button('Tracer').click();
    fixture.detectChanges();
    expect(box.checked).toBe(false);
    expect(button('Envoyer mon code de signature').disabled).toBe(true);
    fixture.componentRef.setInput('documentKey', 'doc-v2');
    fixture.detectChanges();
    expect(button('Envoyer mon code de signature').disabled).toBe(true);
    http.expectNone('/signature/code');
  });
  it('discards an in-flight code response when its document changes', async () => {
    await prepare();
    const request = http.expectOne('/signature/code');
    fixture.componentRef.setInput('documentKey', 'changed-document');
    fixture.detectChanges();
    request.flush({ challengeId: 'obsolete', recipient: 'f***@example.test' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Code valable encore');
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'document a changé',
    );
  });
  it('never advances to the code screen if the provider fails', async () => {
    await prepare();
    http
      .expectOne('/signature/code')
      .flush({ message: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Code valable encore');
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
  });
});
