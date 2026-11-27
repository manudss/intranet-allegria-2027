import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyAccessService } from '../../core/my-access.service';
import { GatheringFiche } from './gathering-groups.models';
import { GatheringFichePage } from './gathering-fiche.page';

function fiche(overrides: Partial<GatheringFiche> = {}): GatheringFiche {
  return {
    id: 19,
    name: 'Réfectoire A',
    category: 'MIXTE',
    location: 'Réfectoire A',
    notes: 'Repas chaud',
    jeunes: 191,
    animateurs: 30,
    persons: 221,
    teamCount: 25,
    capacity: 265,
    overflow: false,
    almostFull: false,
    repartition: { id: 6, name: 'Dîner du lundi 01/11', allowOverflow: true, countAnimators: true },
    sequence: null,
    sequences: [],
    hostingGroup: null,
    documentLink: null,
    teams: [],
    people: [],
    animators: [],
    volunteerTeams: [],
    managers: [],
    alerts: [],
    ...overrides,
  };
}

type Notice = { kind: 'error' | 'info'; text: string };
/** Vue non protégée de la page pour les tests (les membres sont protected dans le composant). */
type PageView = {
  startEdit(): void;
  saveEdit(): void;
  editCapacity: { set(v: unknown): void };
  editCategory: { set(v: unknown): void };
  notice(): Notice | null;
  editing(): boolean;
  busy(): boolean;
};

describe('GatheringFichePage (modification du groupe)', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  function setup() {
    TestBed.configureTestingModule({
      imports: [GatheringFichePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MyAccessService, useValue: { load: vi.fn(), can: () => true } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '19' })) } },
      ],
    });
    const fixture = TestBed.createComponent(GatheringFichePage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/gathering/groups/19').flush(fiche());
    http.expectOne((r) => r.url === '/api/volunteer-teams').flush([]);
    fixture.detectChanges();
    return { fixture, http, component: fixture.componentInstance as unknown as PageView };
  }

  it('enregistre quand la capacité arrive en nombre (champ type=number), comme au clavier mobile', () => {
    const { http, component } = setup();
    component.startEdit();
    // Le champ Taiga type=number émet un number (pas une chaîne) : le scénario du retour utilisateur.
    component.editCapacity.set(299);
    component.editCategory.set('TA');
    expect(() => component.saveEdit()).not.toThrow();
    const req = http.expectOne(
      (r) => r.method === 'PATCH' && r.url === '/api/gathering/groups/19',
    );
    expect(req.request.body).toEqual({
      name: 'Réfectoire A',
      category: 'TA',
      capacityPersons: 299,
      location: 'Réfectoire A',
      notes: 'Repas chaud',
    });
    req.flush(fiche({ category: 'TA', capacity: 299 }));
    http.expectOne('/api/gathering/groups/19').flush(fiche({ category: 'TA', capacity: 299 }));
    expect(component.notice()?.kind).toBe('info');
    expect(component.editing()).toBe(false);
  });

  it('capacité vidée (null émis par le champ) = sans limite', () => {
    const { http, component } = setup();
    component.startEdit();
    component.editCapacity.set(null);
    component.saveEdit();
    const req = http.expectOne(
      (r) => r.method === 'PATCH' && r.url === '/api/gathering/groups/19',
    );
    expect(req.request.body.capacityPersons).toBeNull();
    req.flush(fiche({ capacity: null }));
    http.expectOne('/api/gathering/groups/19').flush(fiche({ capacity: null }));
  });

  it('capacité invalide : message visible, aucun appel réseau', () => {
    const { http, component } = setup();
    component.startEdit();
    component.editCapacity.set(0);
    component.saveEdit();
    http.expectNone((r) => r.method === 'PATCH');
    expect(component.notice()?.kind).toBe('error');
    expect(component.notice()?.text).toContain('Capacité invalide');
    expect(component.editing()).toBe(true);
  });

  it("refus du serveur : la raison est affichée, le formulaire reste ouvert", () => {
    const { http, component } = setup();
    component.startEdit();
    component.editCapacity.set(299);
    component.saveEdit();
    http
      .expectOne((r) => r.method === 'PATCH' && r.url === '/api/gathering/groups/19')
      .flush({ message: 'Groupe hors de votre périmètre.' }, { status: 403, statusText: 'Forbidden' });
    expect(component.notice()?.kind).toBe('error');
    expect(component.notice()?.text).toContain('périmètre');
    expect(component.editing()).toBe(true);
    expect(component.busy()).toBe(false);
  });
});
