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

class FamilyReviewHarness extends FamilySpacePage {
  prepare(space: FamilySpace) {
    this.space.set(space);
    this.openYouth(space.youths[0]);
  }
  isReadOnly() {
    return this.readOnly();
  }
  reviewedContact() {
    return this.reviewContact();
  }
  reviewedDate(value: string) {
    return this.frenchDate(value);
  }
  pageFor(value: string) {
    return this.requirementPage(value);
  }
  requestWith(email: string) {
    this.accessModel.set({ email, code: '' });
    return this.requestCode();
  }
  invalidCode() {
    this.accessModel.set({ email: 'fiction@example.test', code: '123' });
    return this.verify();
  }
  errorText() {
    return this.error();
  }
  markAndSave() {
    this.changed();
    return this.save();
  }
}
describe('Family audit regression cases', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }),
  );
  afterEach(() => TestBed.resetTestingModule());
  const build = () => TestBed.runInInjectionContext(() => new FamilyReviewHarness());
  it('reviews frozen submitted contacts, never current contacts from another youth', async () => {
    const c = build(),
      y = newYouth('y');
    y.state = 'SUBMITTED';
    y.contactAtSubmission = { ...EMPTY_CONTACT, name: 'At submission' };
    c.prepare({
      id: 'f',
      email: 'fiction@example.test',
      contact: { ...EMPTY_CONTACT, name: 'Changed later' },
      youths: [y],
      revision: 0,
      updatedAt: '',
    });
    expect(c.isReadOnly()).toBe(true);
    expect(c.reviewedContact().name).toBe('At submission');
    await c.markAndSave();
    TestBed.inject(HttpTestingController).expectNone('/api/public/family-space/youths/y');
    c.ngOnDestroy();
  });
  it('keeps draft contacts shared and maps missing requirements to useful pages', () => {
    const c = build();
    c.prepare({
      id: 'f',
      email: 'fiction@example.test',
      contact: { ...EMPTY_CONTACT, name: 'Shared' },
      youths: [newYouth('y')],
      revision: 0,
      updatedAt: '',
    });
    expect(c.reviewedContact().name).toBe('Shared');
    expect(c.pageFor('Signature : modèle')).toBe(4);
    expect(c.pageFor("Contact d'urgence : téléphone")).toBe(1);
    expect(c.pageFor('Présence au rassemblement')).toBe(2);
    expect(c.pageFor('Prénom')).toBe(0);
    c.ngOnDestroy();
  });
  it('validates email and eight-digit code before any request', async () => {
    const c = build();
    await c.requestWith('not-an-email');
    expect(c.errorText()).toContain('e-mail valide');
    await c.invalidCode();
    expect(c.errorText()).toContain('huit chiffres');
    TestBed.inject(HttpTestingController).verify();
    c.ngOnDestroy();
  });
  it('formats parent dates in French and never invents a missing date', () => {
    const c = build();
    expect(c.reviewedDate('2012-05-01')).toBe('01/05/2012');
    expect(c.reviewedDate('')).toBe('Non renseigné');
    c.ngOnDestroy();
  });
});
