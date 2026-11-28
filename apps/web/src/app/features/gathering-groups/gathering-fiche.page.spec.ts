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

/** Aides d'affichage ajoutées pour la fiche : tri agenda et avatars (jeunes : prénom seulement). */
describe('GatheringFichePage (agenda et avatars)', () => {
  type Helpers = {
    groupSequencesByDay(l: unknown[]): { date: string; items: { id: number }[] }[];
    initialsOfFirstName(n: string): string;
    initialsOfName(n: string): string;
    initialsOfLabel(n: string): string;
  };
  function helpers(): Helpers {
    TestBed.configureTestingModule({
      imports: [GatheringFichePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MyAccessService, useValue: { load: vi.fn(), can: () => true } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '19' })) } },
      ],
    });
    return TestBed.createComponent(GatheringFichePage).componentInstance as unknown as Helpers;
  }
  const seq = (id: number, eventDate: string, startTime: string) => ({
    id, title: `S${id}`, eventDate, startTime, endTime: '23:00', track: 'TA', location: '',
  });

  it('trie les créneaux par jour puis heure et les regroupe par jour', () => {
    const h = helpers();
    const days = h.groupSequencesByDay([
      seq(1, '2027-07-26', '14:00'),
      seq(2, '2027-07-25', '20:30'),
      seq(3, '2027-07-26', '09:00'),
    ]);
    expect(days.map((d) => d.date)).toEqual(['2027-07-25', '2027-07-26']);
    expect(days[1].items.map((i) => i.id)).toEqual([3, 1]);
    expect(h.groupSequencesByDay([])).toEqual([]);
  });

  it("avatar des jeunes : lettres du prénom seulement, jamais le nom de famille", () => {
    const h = helpers();
    expect(h.initialsOfFirstName('Léa')).toBe('Lé');
    expect(h.initialsOfFirstName('  ')).toBe('?');
    expect(h.initialsOfName('Marie Dupont')).toBe('MD');
    expect(h.initialsOfLabel('AIR-Aurore-Nomades')).toBe('AA');
  });
});
