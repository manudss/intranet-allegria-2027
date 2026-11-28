import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTaiga, TuiRoot } from '@taiga-ui/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
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
      persons: [{ assignmentId: 5, person: person(12, 'PARTICIPANT', 'Jean', 'Placé'), transportId: 1, delegationId: 2 }],
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

  async function setup(extra: unknown[] = []) {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideTaiga(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', '2']]) } } },
        ...(extra as never[]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url === '/api/delegations/destinations').flush([{ id: 2, name: "Délégation d'Annecy" }]);
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

  it('tiroir exception : les champs personne et délégation sont des champs à saisie (combobox)', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    Array.from(el.querySelectorAll<HTMLButtonElement>('.create-buttons button')).find((b) => b.textContent?.includes('+ Exception'))!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const form = el.querySelector('#exception-form')!;
    expect(form.querySelectorAll('input[tuiComboBox], input[tuicombobox]').length).toBe(2);
  });

  it('« Retirer » demande une confirmation et n envoie rien si on annule', async () => {
    const ask = vi.fn(() => of(false));
    const { fixture, http } = await setup([{ provide: ConfirmDialogService, useValue: { ask, askDelete: vi.fn() } }]);
    const el: HTMLElement = fixture.nativeElement;
    const card = el.querySelector('.transport-card')!;
    Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Détails'))!.click();
    fixture.detectChanges();
    Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Retirer'))!.click();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask.mock.calls[0]).toBeDefined();
    http.expectNone((r) => r.method === 'DELETE');
  });

  it('note refusée (NOT_ALLOWED) : exception créée, texte conservé, message honnête sans « note enregistrée »', async () => {
    const { fixture, http } = await setup();
    const page = fixture.debugElement.query(By.directive(DelegationDetailPage)).componentInstance as {
      exceptionForm: { set: (v: unknown) => void; (): { note: string } };
      createException: () => void;
      error: () => string;
    };
    page.exceptionForm.set({ personKey: 'PARTICIPANT:7', toDelegationId: 4, note: 'Famille à Annecy ce week-end' });
    page.createException();
    http
      .expectOne((r) => r.method === 'POST' && r.url === '/api/delegations/2/exceptions')
      .flush({ id: 1, noteStatus: 'NOT_ALLOWED' });
    expect(page.exceptionForm().note).toBe('Famille à Annecy ce week-end');
    expect(page.error()).toContain('créée');
    expect(page.error()).toContain('pas été enregistrée');
    http.match(() => true).forEach((r) => r.flush([]));
  });
});
