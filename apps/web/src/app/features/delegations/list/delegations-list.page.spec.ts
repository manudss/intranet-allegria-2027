import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { MyAccessService } from '../../../core/my-access.service';
import { provideTaiga, TuiRoot } from '@taiga-ui/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DelegationsListPage } from './delegations-list.page';
import { DelegationSummary } from '../delegations-api.service';

@Component({
  standalone: true,
  imports: [TuiRoot, DelegationsListPage],
  template: '<tui-root><app-delegations-list-page /></tui-root>',
})
class HostComponent {}

const ROWS: DelegationSummary[] = [
  {
    id: 1,
    name: 'Délégation de Lyon',
    diocese: 'Lyon',
    zone: 'metropole',
    country: 'FR',
    jeunes: 74,
    animateurs: 9,
    benevoles: 3,
    total: 86,
    aller: { total: 86, toPlace: 0, placed: 86 },
    retour: { total: 86, toPlace: 0, placed: 86 },
    toPlace: 0,
    exceptionsReceived: 2,
    exceptionsOutgoing: 0,
    responsables: ['P. Martin', 'S. Vivier'],
  },
  {
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
    retour: { total: 54, toPlace: 5, placed: 49 },
    toPlace: 12,
    exceptionsReceived: 1,
    exceptionsOutgoing: 0,
    responsables: ['C. Berthod'],
  },
  {
    id: 3,
    name: 'Sans délégation',
    diocese: null,
    zone: null,
    country: null,
    jeunes: 5,
    animateurs: 2,
    benevoles: 2,
    total: 9,
    aller: { total: 9, toPlace: 9, placed: 0 },
    retour: { total: 9, toPlace: 9, placed: 0 },
    toPlace: 18,
    exceptionsReceived: 0,
    exceptionsOutgoing: 0,
    responsables: [],
  },
];

describe('DelegationsListPage (lot 3 : cartes des délégations)', () => {
  beforeAll(() => {
    // jsdom n'a pas matchMedia (utilisé par Taiga pour le mode sombre).
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
      providers: [provideTaiga(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/delegations').flush(ROWS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http };
  }

  it('affiche une carte par délégation avec effectifs, pastille et responsables', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const cards = el.querySelectorAll('.delegation-card');
    expect(cards.length).toBe(3);
    const text = el.textContent ?? '';
    expect(text).toContain('Délégation de Lyon');
    expect(text).toContain('répartition terminée');
    expect(text).toContain('12 à placer');
    expect(text).toContain('74 jeunes · 9 animateurs · 3 bénévoles');
    expect(text).toContain('P. Martin');
    expect(text).toContain('+2 exceptions accueillies');
  });

  it('garde « Sans délégation » en carte pointillée, en fin de liste malgré le tri par à placer', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const cards = Array.from(el.querySelectorAll('.delegation-card'));
    const last = cards[cards.length - 1];
    expect(last.classList.contains('card-dashed')).toBe(true);
    expect(last.textContent).toContain('Sans délégation');
    expect(last.textContent).toContain('9 à rattacher');
    expect(last.textContent).toContain('Coordinateurs');
    // Le tri par « à placer » met Annecy (12) avant Lyon (0).
    expect(cards[0].textContent).toContain("Délégation d'Annecy");
  });

  it("n'affiche aucune donnée de santé ni erreur avant saisie", async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('santé');
    expect(el.querySelector('.error')).toBeNull();
  });
});

describe('DelegationsListPage (lot 2 : arrivée directe du responsable, test local avec accès simulé)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setupWith(scope: string, rows: DelegationSummary[]) {
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
    const access = { load: vi.fn(), loaded: signal(true), scopeOf: () => scope };
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideTaiga(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MyAccessService, useValue: access },
      ],
    }).compileComponents();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/delegations').flush(rows);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return navigate;
  }

  it('un responsable limité à une délégation est envoyé sur sa fiche', async () => {
    const navigate = await setupWith('OWN', [ROWS[1]]);
    expect(navigate).toHaveBeenCalledWith(['/delegations', 2], { replaceUrl: true });
  });

  it('un compte à portée complète ou avec plusieurs délégations garde la liste', async () => {
    const all = await setupWith('ALL', [ROWS[1]]);
    expect(all).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    const several = await setupWith('OWN', [ROWS[0], ROWS[1]]);
    expect(several).not.toHaveBeenCalled();
  });
});
