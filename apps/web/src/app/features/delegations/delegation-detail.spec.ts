import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTaiga, TuiRoot } from '@taiga-ui/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DelegationDetailPage } from './delegation-detail';
import { PersonLite, Repartition } from './delegations-api.service';

@Component({
  standalone: true,
  imports: [TuiRoot, DelegationDetailPage],
  template: '<tui-root><app-delegation-detail /></tui-root>',
})
class HostComponent {}

const person = (id: number, type: 'PARTICIPANT' | 'VOLUNTEER', firstName: string, lastName: string): PersonLite => ({
  personType: type,
  id,
  firstName,
  lastName,
  detail: null,
  delegationId: 2,
});

const REPARTITION: Repartition = {
  delegationId: 2,
  direction: 'ALLER',
  toAssign: [
    { assignmentId: null, person: person(11, 'PARTICIPANT', 'Lina', 'Paccoud'), transportId: null, delegationId: 2 },
    { assignmentId: null, person: person(21, 'VOLUNTEER', 'Claire', 'Berthod'), transportId: null, delegationId: 2 },
  ],
  transports: [
    {
      id: 5,
      direction: 'ALLER',
      transportMode: 'CAR',
      name: 'Car 1',
      departureDatetime: null,
      arrivalDatetime: null,
      meetingPoint: 'Gare',
      practicalInfo: null,
      capacity: 45,
      notes: null,
      occupancy: 3,
      full: false,
      persons: [],
    },
  ],
  exceptionsReceived: [],
  exceptionsOutgoing: [],
};


describe('jauge : complet à capacité atteinte, dépassée seulement au-delà', () => {
  const state = (occupancy: number, capacity: number | null) =>
    (DelegationDetailPage.prototype as unknown as { gaugeState(t: { capacity: number | null; occupancy: number }): string }).gaugeState.call({}, { capacity, occupancy });
  it('64/64 est complet, 65/64 est dépassé, sans jauge rien', () => {
    expect(state(64, 64)).toBe('full');
    expect(state(65, 64)).toBe('over');
    expect(state(10, 64)).toBe('ok');
    expect(state(10, null)).toBe('none');
  });
});

describe('DelegationDetailPage (refonte : onglets, deux panneaux, sélection)', () => {
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

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideTaiga(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', '2']]) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url === '/api/groups').flush([{ id: 2, name: "Délégation d'Annecy" }]);
    http.match((r) => r.url === '/api/delegations/2/persons').forEach((r) => r.flush([]));
    http.expectOne((r) => r.url === '/api/delegations/2/repartition').flush(REPARTITION);
    http.expectOne('/api/delegations/2/stats').flush({
      delegationId: 2,
      directions: [
        { direction: 'ALLER', total: 5, toPlace: 2, placed: 3 },
        { direction: 'RETOUR', total: 5, toPlace: 0, placed: 5 },
      ],
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('barre persistante, bascule Aller/Retour avec compteur, boutons de création', async () => {
    const { fixture } = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    for (const label of ['Délégations', 'Répartition', 'Exceptions', 'Notes', 'Suivi des notes', 'Aller', 'Retour', '+ Sous-délégation', '+ Exception']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('2 à placer');
  });

  it('deux panneaux : personnes à placer à gauche, sous-délégation avec jauge à droite', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.panels .panel')).toHaveLength(2);
    expect(el.querySelector('.panel.people')?.textContent).toContain('Lina Paccoud');
    expect(el.querySelector('.panel.destinations')?.textContent).toContain('Car 1');
    expect(el.querySelector('.panel.destinations')?.textContent).toContain('3/45');
    expect(el.querySelectorAll('.person-row[draggable="true"]')).toHaveLength(2);
  });

  it('cocher une personne met à jour le compteur et active « Affecter la sélection »', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const cardButton = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('.transport-card button')).find((b) =>
        b.textContent?.includes('Affecter la sélection'),
      )!;
    expect(cardButton().disabled).toBe(true);
    el.querySelector<HTMLInputElement>('.person-row input[type="checkbox"]')!.click();
    fixture.detectChanges();
    expect(cardButton().disabled).toBe(false);
    expect(cardButton().textContent).toContain('(1)');
  });

  it('étape mobile : « 2. Destinations » affiche les destinations', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.panel.destinations')?.classList.contains('hidden-mobile')).toBe(true);
    Array.from(el.querySelectorAll<HTMLButtonElement>('.steps .step')).find((b) => b.textContent?.includes('2. Destinations'))!.click();
    fixture.detectChanges();
    expect(el.querySelector('.panel.destinations')?.classList.contains('hidden-mobile')).toBe(false);
    expect(el.querySelector('.panel.people')?.classList.contains('hidden-mobile')).toBe(true);
  });

  it('les tiroirs de création s ouvrent depuis la barre, dates préremplies pour l aller', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    Array.from(el.querySelectorAll<HTMLButtonElement>('.create-buttons button')).find((b) => b.textContent?.includes('Sous-délégation'))!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector<HTMLInputElement>('#t-dep-date')?.value).toBe('2027-10-31');
    expect(el.querySelector<HTMLInputElement>('#t-dep-time')?.value).toBe('');
  });

  it('carte compacte : détails et personnes repliés par défaut, dépliables', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const card = () => el.querySelector('.transport-card')!;
    expect(card().textContent).toContain('RDV Gare');
    expect(card().querySelector('.placed')).toBeNull();
    Array.from(card().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Détails'))!.click();
    fixture.detectChanges();
    expect(card().querySelector('.placed')).not.toBeNull();
    expect(card().textContent).toContain('Infos pratiques');
  });

  it('rappel de sélection à l étape 2 avec compteur réel', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.selection-reminder')?.textContent).toContain('Aucune sélection');
    el.querySelector<HTMLInputElement>('.person-row input[type="checkbox"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.selection-reminder')?.textContent).toContain('1 personne(s) sélectionnée(s)');
  });
});
