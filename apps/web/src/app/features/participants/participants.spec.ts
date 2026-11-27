import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { Group, Participant } from '../../models/models';
import {
  GroupsApiService,
  HealthApiService,
  ParticipantsApiService,
} from '../../services/api.services';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { DelegationsApiService, PersonJourneys } from '../delegations/delegations-api.service';
import { ParticipantsPage } from './participants';

const group: Group = {
  id: 48,
  name: 'Délégation de Lyon',
  diocese: 'Lyon',
  arrivalDatetime: null,
  departureDatetime: null,
  notes: null,
};

const participant: Participant = {
  id: 7,
  firstName: 'Test',
  lastName: 'Personne',
  dateOfBirth: '2010-01-01',
  sex: null,
  mejAgeGroup: null,
  type: 'JEUNE',
  emergencyContactName: null,
  emergencyContactPhone: null,
  diocese: null,
  city: null,
  group,
};

const journeys: PersonJourneys = {
  personType: 'PARTICIPANT',
  personId: 7,
  journeys: [
    {
      direction: 'ALLER',
      status: 'TO_ASSIGN',
      assignmentId: 0,
      delegation: { id: 48, name: 'Délégation de Lyon' },
      exception: false,
      transport: null,
    },
  ],
};

function makeDelegationsApi(listSummariesImpl: () => unknown) {
  return {
    journeysForFiche: vi.fn(() => of(journeys)),
    listSummaries: vi.fn(listSummariesImpl),
    listTransports: vi.fn(() => of([])),
    assign: vi.fn(() => of({})),
    unassign: vi.fn(() => of({})),
    createException: vi.fn(() => of({})),
  };
}

async function makePage(delegationsApi: unknown) {
  await TestBed.configureTestingModule({
    imports: [ParticipantsPage],
    providers: [
      {
        provide: ParticipantsApiService,
        useValue: { getParticipants: vi.fn(() => of([participant])) },
      },
      { provide: GroupsApiService, useValue: { list: vi.fn(() => of([group])) } },
      { provide: DelegationsApiService, useValue: delegationsApi },
      { provide: ConfirmDialogService, useValue: { confirm: vi.fn(() => of(true)) } },
      { provide: HealthApiService, useValue: {} },
      { provide: AuthService, useValue: { hasAnyRole: () => true } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: { get: () => null } } },
      },
    ],
  })
    // Template vide : on teste la logique, pas le rendu des formulaires Taiga
    // (qui lève des NG0950 non gérés hors navigateur).
    .overrideComponent(ParticipantsPage, { set: { template: '', imports: [] } })
    .compileComponents();
  const fixture = TestBed.createComponent(ParticipantsPage);
  // Pas de detectChanges : on teste la logique du composant, sans rendre le
  // template complet (formulaires signal-forms et selects Taiga, erreurs NG0950).
  return fixture.componentInstance;
}

type Testable = ParticipantsPage & {
  saveJourney(direction: 'ALLER' | 'RETOUR'): void;
  loadDelegationOptions(): void;
};

describe('ParticipantsPage - garde-fou trajets (lot 6)', () => {
  it("signale l'échec de chargement des délégations et bloque l'enregistrement", async () => {
    const api = makeDelegationsApi(() => throwError(() => new Error('500')));
    const page = (await makePage(api)) as Testable;

    page.open(participant);

    expect(page.delegationOptionsError()).toContain("n'a pas pu être chargée");
    expect(page.delegationOptions()).toEqual([]);

    page.saveJourney('ALLER');

    expect(page.journeyError()).toContain('enregistrement impossible');
    expect(api.assign).not.toHaveBeenCalled();
    expect(api.unassign).not.toHaveBeenCalled();
    expect(api.createException).not.toHaveBeenCalled();
  });

  it("débloque l'enregistrement après un rechargement réussi", async () => {
    let fail = true;
    const api = makeDelegationsApi(() =>
      fail ? throwError(() => new Error('500')) : of([{ id: 48, name: 'Délégation de Lyon' }]),
    );
    const page = (await makePage(api)) as Testable;

    page.open(participant);
    expect(page.delegationOptionsError()).not.toBe('');

    // Réessai réussi : l'erreur s'efface et l'enregistrement redevient possible.
    fail = false;
    page.loadDelegationOptions();

    expect(page.delegationOptionsError()).toBe('');
    expect(page.delegationOptions().length).toBe(1);

    page.saveJourney('ALLER');

    // Même délégation, pas de transport choisi : aucun appel réseau, pas d'erreur.
    expect(page.journeyError()).toBe('');
  });
});
