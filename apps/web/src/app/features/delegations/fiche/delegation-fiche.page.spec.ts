import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideTaiga, TuiRoot } from '@taiga-ui/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DelegationFichePage } from './delegation-fiche.page';
import { DelegationSummary, PersonLite, Repartition } from '../delegations-api.service';

@Component({
  standalone: true,
  imports: [TuiRoot, DelegationFichePage],
  template: '<tui-root><app-delegation-fiche-page /></tui-root>',
})
class HostComponent {}

const SUMMARY: DelegationSummary = {
  id: 2,
  name: "Délégation d'Annecy",
  diocese: 'Annecy',
  zone: 'metropole',
  country: 'FR',
  jeunes: 47,
  animateurs: 6,
  benevoles: 1,
  total: 54,
  aller: { total: 54, toPlace: 7, placed: 47 },
  retour: { total: 54, toPlace: 0, placed: 54 },
  toPlace: 7,
  exceptionsReceived: 1,
  exceptionsOutgoing: 0,
  responsables: ['C. Berthod'],
};

const PERSONS: PersonLite[] = [
  { personType: 'PARTICIPANT', id: 11, firstName: 'Lina', lastName: 'Paccoud', detail: 'JEUNE', delegationId: 2 },
  { personType: 'PARTICIPANT', id: 12, firstName: 'Marc', lastName: 'Ozon', detail: 'ANIMATEUR', delegationId: 2 },
  { personType: 'VOLUNTEER', id: 21, firstName: 'Claire', lastName: 'Berthod', detail: 'LOGISTIQUE', delegationId: 2 },
];

const REPARTITION: Repartition = {
  delegationId: 2,
  direction: 'ALLER',
  toAssign: [
    { assignmentId: 1, person: PERSONS[0], transportId: null, delegationId: 2 },
  ],
  transports: [
    {
      id: 5,
      direction: 'ALLER',
      transportMode: 'CAR',
      name: 'Car 1',
      departureDatetime: '2026-07-20T08:00:00Z',
      arrivalDatetime: '2026-07-20T12:00:00Z',
      meetingPoint: 'Gare',
      practicalInfo: 'RDV parking nord',
      capacity: 45,
      notes: null,
      occupancy: 45,
      full: true,
      persons: [],
    },
  ],
  exceptionsReceived: [
    {
      assignmentId: 2,
      person: { personType: 'PARTICIPANT', id: 30, firstName: 'Nina', lastName: 'K', detail: 'JEUNE', delegationId: 3 },
      transportId: null,
      delegationId: 2,
    },
  ],
  exceptionsOutgoing: [],
};

describe('DelegationFichePage (lot 4 : fiche en vues)', () => {
  beforeAll(() => {
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => TestBed.resetTestingModule());

  async function setup(notesForbidden = false) {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideTaiga(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['id', '2']]) } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    // Non-régression : la fiche ne lit plus /api/groups/:id (module PARTICIPANTS),
    // elle s'ouvre avec le seul droit TRANSPORT.
    http.expectNone('/api/groups/2');
    http.expectOne('/api/delegations').flush([SUMMARY]);
    http.expectOne('/api/delegations/2/persons').flush(PERSONS);
    http
      .expectOne((r) => r.url === '/api/delegations/2/repartition' && r.params.get('direction') === 'ALLER')
      .flush(REPARTITION);
    http
      .expectOne((r) => r.url === '/api/delegations/2/repartition' && r.params.get('direction') === 'RETOUR')
      .flush({ ...REPARTITION, direction: 'RETOUR', toAssign: [], exceptionsReceived: [] });
    http.expectOne('/api/access/me').flush({
      grants: notesForbidden ? [] : [{ module: 'PERSON_NOTES', level: 'VIEW', scope: 'ALL' }],
    });
    fixture.detectChanges();
    if (notesForbidden) http.expectNone('/api/person-notes?filter=ALL');
    else http.expectOne('/api/person-notes?filter=ALL').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture };
  }

  it("s'ouvre sous le seul droit TRANSPORT : sans droit PERSON_NOTES, aucune requête de notes (pas de 403 vers Accès refusé)", async () => {
    const { fixture } = await setup(true);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain("Délégation d'Annecy");
    expect(el.textContent).not.toContain('Le chargement de la délégation a échoué');
    // Accès indisponible n'est pas « zéro note » : pas de compteur.
    expect(el.textContent).not.toMatch(/Notes\s*\(0\)/);
  });

  it("n'appelle pas /api/groups et masque le lien de retour pour une seule délégation", async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('a[href="/rassemblement"]')).toBeNull();
  });

  it("vue d'ensemble : identité, responsables et répartition par sens", async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const text = el.textContent ?? '';
    expect(text).toContain("Délégation d'Annecy");
    expect(text).toContain('Diocèse de Annecy');
    expect(text).toContain('C. Berthod');
    expect(text).toContain('Aller');
    expect(text).toContain('Retour');
  });

  it('vue Personnes : filtre par type, sans données de santé', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
    tabs.find((b) => b.textContent?.includes('Personnes'))!.click();
    fixture.detectChanges();
    let text = el.textContent ?? '';
    expect(text).toContain('Lina Paccoud');
    expect(text).toContain('Marc Ozon');
    expect(text).toContain('Claire Berthod');
    // Filtre jeunes
    const filters = Array.from(el.querySelectorAll<HTMLButtonElement>('button'));
    filters.find((b) => b.textContent?.includes('Jeunes (1)'))!.click();
    fixture.detectChanges();
    text = el.textContent ?? '';
    expect(text).toContain('Lina Paccoud');
    expect(text).not.toContain('Marc Ozon');
    expect(text).toContain('données de santé ne sont pas visibles');
  });

  it('vue Sous-délégations : jauge, capacité et à placer ; vue Exceptions : reçues nommées', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(el.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
    tabs.find((b) => b.textContent?.includes('Sous-délégations'))!.click();
    fixture.detectChanges();
    let text = el.textContent ?? '';
    expect(text).toContain('Car 1');
    expect(text).toContain('45/45 places');
    expect(text).toContain('1 à placer');
    tabs.find((b) => b.textContent?.includes('Exceptions'))!.click();
    fixture.detectChanges();
    text = el.textContent ?? '';
    expect(text).toContain('Nina K');
    expect(text).toContain('Reçues');
  });
});
