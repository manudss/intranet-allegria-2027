import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { PersonPickerComponent, PersonSummary, personLabel } from './person-picker.component';

const marie: PersonSummary = {
  id: 1,
  email: 'marie.dupont@exemple.test',
  firstName: 'Marie',
  lastName: 'Dupont',
  isActive: true,
  roles: ['ADMIN'],
  teams: ['Saint-Étienne 2'],
  teamTypes: ['Animation'],
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('PersonPickerComponent', () => {
  let http: HttpTestingController;

  const setup = async (filters = true) => {
    TestBed.configureTestingModule({
      imports: [PersonPickerComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PersonPickerComponent);
    fixture.componentRef.setInput('filters', filters);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const input = () => el.querySelector('input[data-testid="person-picker"]') as HTMLInputElement;
    const type = async (text: string) => {
      input().value = text;
      input().dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    return { fixture, el, input, type };
  };

  afterEach(() => http.verify());

  it("n'appelle aucune route à l'ouverture, même au focus", async () => {
    const { input } = await setup();
    input().dispatchEvent(new Event('focus'));
    await wait(450);
    http.expectNone(() => true);
  });

  it('attend 2 lettres puis 300 ms, et demande 10 résultats au serveur', async () => {
    const { type } = await setup();
    await type('m');
    await wait(450);
    http.expectNone(() => true);
    await type('ma');
    await type('mar');
    await wait(150);
    http.expectNone(() => true);
    await wait(300);
    const req = http.expectOne((r) => r.url === '/api/users/search');
    expect(req.request.params.get('q')).toBe('mar');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ items: [marie], total: 1, hasMore: false });
  });

  it('affiche les résultats et émet la personne choisie, sans liste native', async () => {
    const { fixture, el, type } = await setup();
    const emitted: (PersonSummary | null)[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    await type('mar');
    await wait(450);
    http
      .expectOne((r) => r.url === '/api/users/search')
      .flush({ items: [marie], total: 1, hasMore: false });
    await fixture.whenStable();
    expect(el.querySelector('select')).toBeNull();
    const options = el.querySelectorAll('[data-testid="person-option"]');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Marie Dupont');
    expect(options[0].textContent).toContain('Animation');
    (options[0] as HTMLButtonElement).click();
    expect(emitted).toEqual([marie]);
  });

  it('une personne choisie devient une puce avec un bouton pour changer', async () => {
    const { fixture, el } = await setup();
    fixture.componentRef.setInput('value', marie);
    await fixture.whenStable();
    expect(el.querySelector('input[data-testid="person-picker"]')).toBeNull();
    expect(el.querySelector('[data-testid="person-chosen"]')?.textContent).toContain(
      'Marie Dupont',
    );
    const emitted: (PersonSummary | null)[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    (el.querySelector('[data-testid="person-clear"]') as HTMLButtonElement).click();
    expect(emitted).toEqual([null]);
  });

  it("n'affiche que la dernière recherche et annule la précédente", async () => {
    const { fixture, type } = await setup();
    await type('mar');
    await wait(450);
    const first = http.expectOne((r) => r.url === '/api/users/search');
    await type('marti');
    await wait(450);
    expect(first.cancelled).toBe(true);
    http
      .expectOne((r) => r.url === '/api/users/search' && r.params.get('q') === 'marti')
      .flush({ items: [{ ...marie, id: 2 }], total: 1, hasMore: false });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="person-option"]')).toHaveLength(1);
  });

  it('charge les listes de filtres seulement à la première ouverture du panneau et filtre côté serveur', async () => {
    const { fixture, el } = await setup();
    http.expectNone(() => true);
    (el.querySelector('[data-testid="person-filters-toggle"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    // Une seule route, même autorité que la recherche : aucune des routes d'autres modules.
    http.expectNone('/api/roles');
    http.expectNone('/api/groups');
    http.expectOne('/api/users/search/filters').flush({
      roles: [{ code: 'ADMIN', label: 'Administrateur' }],
      teamTypes: [{ code: 'ANIM', label: 'Animation' }],
      teams: [{ id: 100, name: 'Saint-Étienne 2' }],
      groups: [{ id: 7, name: 'Nord' }],
    });
    expect(el.querySelector('[data-testid="person-filter-panel"]')).not.toBeNull();
  });

  it('affiche une erreur claire si la recherche échoue', async () => {
    const { fixture, el, type } = await setup();
    await type('mar');
    await wait(450);
    http
      .expectOne((r) => r.url === '/api/users/search')
      .flush('boom', { status: 500, statusText: 'x' });
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Recherche impossible');
  });

  it("personLabel retombe sur l'email sans fiche bénévole", () => {
    expect(personLabel(marie)).toBe('Marie Dupont');
    expect(personLabel({ email: 'a@b.test', firstName: null, lastName: null })).toBe('a@b.test');
  });
});
