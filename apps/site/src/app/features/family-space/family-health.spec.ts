import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FamilyHealthPage } from './family-health';
import { EMPTY_HEALTH } from '@mej-allegria/shared';
class HealthHarness extends FamilyHealthPage {
  protected override base() {
    return '/api/public/family-space/youths/test/health';
  }
  choose(value: string) {
    this.loaded.set(true);
    this.presence('foodAllergy', value);
  }
  persist() {
    return this.save();
  }
  readError() {
    return this.error();
  }
  readBlocked() {
    return this.retryBlocked();
  }
  choices() {
    return this.data().presence;
  }
}
describe('Health audit concurrency regression', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });
  it('keeps sanitary answers local on429 and cannot retry during the server delay', async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const c = TestBed.runInInjectionContext(() => new HealthHarness()),
      http = TestBed.inject(HttpTestingController);
    c.choose('YES');
    const first = c.persist();
    await Promise.resolve();
    http
      .expectOne((r) => r.url.endsWith('/health'))
      .flush(
        { message: 'ThrottlerException' },
        { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '30' } },
      );
    await first;
    c.choose('NO');
    await c.persist();
    expect(await c.flush()).toBe(false);
    expect(c.choices()?.['foodAllergy']).toBe('NO');
    expect(c.readError()).toContain('30 secondes');
    expect(c.readBlocked()).toBe(true);
    await vi.advanceTimersByTimeAsync(30000);
    http.expectNone((r) => r.url.endsWith('/health'));
    expect(c.readBlocked()).toBe(false);
    const last = c.persist();
    await Promise.resolve();
    const req = http.expectOne((r) => r.url.endsWith('/health'));
    expect(req.request.body.health.presence.foodAllergy).toBe('NO');
    req.flush({ ...EMPTY_HEALTH, revision: 1, presence: { foodAllergy: 'NO' } });
    await last;
    http.verify();
    c.ngOnDestroy();
  });
  it('preserves a newer explicit yes/no answer when an older save returns', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const c = TestBed.runInInjectionContext(() => new HealthHarness()),
      http = TestBed.inject(HttpTestingController);
    c.choose('YES');
    const first = c.persist();
    await Promise.resolve();
    const req = http.expectOne((r) => r.url.endsWith('/health'));
    c.choose('NO');
    req.flush({ ...EMPTY_HEALTH, revision: 1, presence: { foodAllergy: 'YES' } });
    await first;
    expect(c.choices()?.['foodAllergy']).toBe('NO');
    const flush = c.flush();
    await new Promise((r) => setTimeout(r, 0));
    const last = http.expectOne((r) => r.url.endsWith('/health'));
    expect(last.request.body.health.presence.foodAllergy).toBe('NO');
    last.flush({ ...EMPTY_HEALTH, revision: 2, presence: { foodAllergy: 'NO' } });
    expect(await flush).toBe(true);
    c.ngOnDestroy();
    http.verify();
  });
});
