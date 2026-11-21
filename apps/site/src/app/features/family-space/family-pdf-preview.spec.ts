import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FamilyPdfPreview } from './family-pdf-preview';

describe('PDF preview readiness deadline', () => {
  let fixture: ComponentFixture<FamilyPdfPreview>, http: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [FamilyPdfPreview],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(FamilyPdfPreview);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('request', { url: '/fictional-preview', body: { revision: 1 } });
    fixture.detectChanges();
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    http.verify({ ignoreCancelled: true });
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });
  it('cancels an overdue request, keeps signature readiness false and offers an explicit retry', async () => {
    const ready = vi.fn();
    fixture.componentInstance.readyChange.subscribe(ready);
    await vi.advanceTimersByTimeAsync(650);
    const request = http.expectOne('/fictional-preview');
    await vi.advanceTimersByTimeAsync(60000);
    fixture.detectChanges();
    expect(request.cancelled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Le PDF met trop de temps');
    expect(ready).not.toHaveBeenCalledWith(true);
    const retry = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Réessayer'))!;
    retry.click();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(650);
    http.expectOne('/fictional-preview').flush(null, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aperçu indisponible');
    expect(ready).not.toHaveBeenCalledWith(true);
  });
  it('cancels an obsolete request and gives a changed document its own deadline', async () => {
    await vi.advanceTimersByTimeAsync(650);
    const old = http.expectOne('/fictional-preview');
    await vi.advanceTimersByTimeAsync(30000);
    fixture.componentRef.setInput('request', { url: '/fictional-preview', body: { revision: 2 } });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(650);
    const current = http.expectOne('/fictional-preview');
    expect(old.cancelled).toBe(true);
    expect(current.request.body).toEqual({ revision: 2 });
    await vi.advanceTimersByTimeAsync(30000);
    fixture.detectChanges();
    expect(current.cancelled).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Le PDF met trop de temps');
    current.flush(null, { status: 503, statusText: 'Unavailable' });
  });
});
