import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { newYouth, EMPTY_CONTACT } from '@mej-allegria/shared';
import type { FamilySpace } from '@mej-allegria/shared';
import { FamilySpacePage } from './family-space';
class FamilyHarness extends FamilySpacePage {
  setUp(space: FamilySpace) {
    this.space.set(space);
    this.openYouth(space.youths[0]);
  }
  edit(name: string) {
    this.editModel.update((m) => ({ ...m, firstName: name }));
    this.changed();
  }
  persist() {
    return this.save();
  }
  flushEdits() {
    return this.flush();
  }
  readStatus() {
    return this.status();
  }
}
describe('Family autosave concurrency', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('never marks a newer edit as saved by an earlier response, and flush persists the latest value', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const c = TestBed.runInInjectionContext(() => new FamilyHarness()),
      http = TestBed.inject(HttpTestingController);
    const s: FamilySpace = {
      id: 'f',
      email: 'fiction@example.test',
      contact: { ...EMPTY_CONTACT },
      youths: [newYouth('y')],
      revision: 0,
      updatedAt: '',
    };
    c.setUp(s);
    c.edit('Camille');
    const first = c.persist();
    await Promise.resolve();
    const req = http.expectOne('/api/public/family-space/youths/y');
    expect(req.request.body.patch.identity.firstName).toBe('Camille');
    c.edit('Camille modifié');
    req.flush({
      ...s,
      revision: 1,
      youths: [{ ...s.youths[0], identity: { ...s.youths[0].identity, firstName: 'Camille' } }],
    });
    await first;
    expect(c.readStatus()).toContain('attente');
    const flushed = c.flushEdits();
    await new Promise((r) => setTimeout(r, 0));
    const latest = http.expectOne('/api/public/family-space/youths/y');
    expect(latest.request.body.patch.identity.firstName).toBe('Camille modifié');
    expect(latest.request.body.revision).toBe(1);
    latest.flush({ ...s, revision: 2 });
    expect(await flushed).toBe(true);
    expect(c.readStatus()).toContain('Enregistré');
    c.ngOnDestroy();
    http.verify();
  });
  it('keeps the form dirty and blocks leaving after a server conflict', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const c = TestBed.runInInjectionContext(() => new FamilyHarness()),
      http = TestBed.inject(HttpTestingController);
    c.setUp({
      id: 'f',
      email: 'fiction@example.test',
      contact: { ...EMPTY_CONTACT },
      youths: [newYouth('y')],
      revision: 0,
      updatedAt: '',
    });
    c.edit('Camille');
    const flushed = c.flushEdits();
    await new Promise((r) => setTimeout(r, 0));
    http
      .expectOne('/api/public/family-space/youths/y')
      .flush(
        { message: 'Une autre fenêtre a modifié le dossier.' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(await flushed).toBe(false);
    expect(c.readStatus()).toBe('Non enregistré');
    c.ngOnDestroy();
    http.verify();
  });
});
