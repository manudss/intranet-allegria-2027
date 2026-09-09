import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../core/auth.service';
import {
  DashboardGlobalSummary,
  DashboardShiftsByStatus,
  DashboardTodoList,
  DashboardWhoDoesWhatResult,
  VolunteerTeam,
} from '../models/models';
import {
  OperationalDashboardApiService,
  VolunteerMissionsApiService,
  VolunteerTeamsApiService,
} from '../services/api.services';
import { JourJ } from './jour-j';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const emptyByStatus = (): DashboardShiftsByStatus => ({
  TODO: 0, ASSIGNED: 0, IN_PROGRESS: 0, DONE: 0, CANCELLED: 0, NOT_DONE: 0,
});

const globalSummary: DashboardGlobalSummary = {
  date: '2027-07-24',
  missionCount: 5,
  shiftCount: 12,
  shiftsByStatus: { ...emptyByStatus(), TODO: 3, IN_PROGRESS: 2, DONE: 7 },
  shiftsWithoutConfirmedAssignment: 4,
  understaffedShifts: 2,
  assignedVolunteers: 15,
  provisionalVolunteers: 3,
};

const emptyTodo: DashboardTodoList = {
  mandatoryIncomplete: [],
  unstarted: [],
  withoutConfirmedStaff: [],
  optionalIncomplete: [],
};

const emptyWho: DashboardWhoDoesWhatResult = {
  items: [],
  total: 0,
  limit: 20,
  offset: 0,
};

const team: VolunteerTeam = { id: 1, name: 'Logistique', code: 'LOG', description: null, isActive: true };

function makeDashApiMock(overrides?: object) {
  return {
    getGlobalSummary: vi.fn((_date: string, _teamId: number | null) => of(globalSummary)),
    getTeamsSummary: vi.fn(() => of([])),
    getLocationsSummary: vi.fn(() => of([])),
    getWhoDoesWhat: vi.fn(() => of(emptyWho)),
    getTodoList: vi.fn(() => of(emptyTodo)),
    ...overrides,
  };
}

async function setup(dashOverrides?: object, authHasRole = true) {
  const dashApiMock = makeDashApiMock(dashOverrides);
  await TestBed.configureTestingModule({
    imports: [JourJ],
    providers: [
      provideZonelessChangeDetection(),
      { provide: OperationalDashboardApiService, useValue: dashApiMock },
      { provide: VolunteerMissionsApiService, useValue: { changeShiftStatus: vi.fn(() => of({})) } },
      { provide: VolunteerTeamsApiService, useValue: { list: vi.fn(() => of([team])) } },
      { provide: AuthService, useValue: { hasAnyRole: (roles: string[]) => authHasRole && roles.includes('ADMIN') } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(JourJ);
  fixture.componentInstance.ngOnInit();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, dashApiMock, component: fixture.componentInstance };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('JourJ', () => {
  it('charge les données globales au démarrage', async () => {
    const { component, dashApiMock } = await setup();
    expect(dashApiMock.getGlobalSummary).toHaveBeenCalled();
    expect(component.global()?.missionCount).toBe(5);
    expect(component.global()?.shiftCount).toBe(12);
  });

  it('affiche le titre de la page', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.textContent).toContain('Tableau de bord Jour J');
  });

  it('charge la liste des équipes disponibles', async () => {
    const { component } = await setup();
    expect(component.teams()).toHaveLength(1);
    expect(component.teams()[0].code).toBe('LOG');
  });

  it('démarre avec l\'onglet missions actif', async () => {
    const { component } = await setup();
    expect(component.activeTab()).toBe('missions');
  });

  it('change d\'onglet correctement', async () => {
    const { component } = await setup();
    component.setTab('teams');
    expect(component.activeTab()).toBe('teams');
    component.setTab('alerts');
    expect(component.activeTab()).toBe('alerts');
  });

  it('calcule les alertes depuis les données globales', async () => {
    const { component } = await setup();
    const msgs = component.alerts().map((a) => a.message);
    expect(msgs.some((m) => m.includes('sous-doté'))).toBe(true);
    expect(msgs.some((m) => m.includes('sans effectif confirmé'))).toBe(true);
    expect(msgs.some((m) => m.includes('provisoire'))).toBe(true);
  });

  it('alertCount() reflète le nombre d\'alertes calculées', async () => {
    const { component } = await setup();
    expect(component.alertCount()).toBeGreaterThan(0);
  });

  it('rafraîchit toutes les données à la date choisie', async () => {
    const { component, dashApiMock } = await setup();
    const callsBefore = dashApiMock.getGlobalSummary.mock.calls.length;
    component.setDate('2027-07-25');
    expect(dashApiMock.getGlobalSummary.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('filtre par équipe quand setTeam() est appelé', async () => {
    const { component, dashApiMock } = await setup();
    component.setTeam('1');
    expect(component.selectedTeamId()).toBe(1);
    const calls = dashApiMock.getGlobalSummary.mock.calls;
    expect(calls[calls.length - 1][1]).toBe(1);
  });

  it('réinitialise le teamId quand la sélection est vidée', async () => {
    const { component } = await setup();
    component.setTeam('2');
    component.setTeam('');
    expect(component.selectedTeamId()).toBeNull();
  });

  it('la pagination "Qui fait quoi" avance correctement', async () => {
    const { component } = await setup({
      getWhoDoesWhat: vi.fn(() =>
        of({ items: [{ volunteerId: 1, firstName: 'Alice', lastName: 'M', shifts: [] }], total: 40, limit: 20, offset: 0 } satisfies DashboardWhoDoesWhatResult),
      ),
    });
    component.whoNextPage();
    expect(component.whoPage()).toBe(2);
  });

  it('ne passe pas à la page précédente depuis la première page', async () => {
    const { component } = await setup();
    component.whoPrevPage();
    expect(component.whoPage()).toBe(1);
  });

  it('shiftStatusClass retourne la bonne classe CSS', async () => {
    const { component } = await setup();
    expect(component.shiftStatusClass('DONE')).toBe('status-done');
    expect(component.shiftStatusClass('IN_PROGRESS')).toBe('status-in-progress');
    expect(component.shiftStatusClass('CANCELLED')).toBe('status-negative');
    expect(component.shiftStatusClass('TODO')).toBe('status-todo');
  });

  it('assignmentStatusLabel retourne le bon libellé', async () => {
    const { component } = await setup();
    expect(component.assignmentStatusLabel('CONFIRMED')).toBe('Confirmée');
    expect(component.assignmentStatusLabel('PROVISIONAL')).toBe('Provisoire');
    expect(component.assignmentStatusLabel('CANCELLED')).toBe('Annulée');
  });

  it('confirmedCountClass signale le manque d\'effectif', async () => {
    const { component } = await setup();
    expect(component.confirmedCountClass(0, 4)).toBe('status-negative');
    expect(component.confirmedCountClass(2, 4)).toBe('status-warning');
    expect(component.confirmedCountClass(4, 4)).toBe('status-done');
    expect(component.confirmedCountClass(2, null)).toBe('');
  });

  it('canWrite() retourne true pour ADMIN', async () => {
    const { component } = await setup();
    expect(component.canWrite()).toBe(true);
  });

  it('canWrite() retourne false pour VIEWER', async () => {
    TestBed.resetTestingModule();
    const { component } = await setup(undefined, false);
    expect(component.canWrite()).toBe(false);
  });

  it('setRefreshInterval configure l\'intervalle et le nettoie', async () => {
    const { component } = await setup();
    component.setRefreshInterval(30_000);
    expect(component.refreshInterval()).toBe(30_000);
    component.setRefreshInterval(0);
    expect(component.refreshInterval()).toBe(0);
    component.ngOnDestroy();
  });

  it('whoTotalPages() calcule correctement le nombre de pages', async () => {
    const { component } = await setup({
      getWhoDoesWhat: vi.fn(() =>
        of({ items: [], total: 45, limit: 20, offset: 0 } satisfies DashboardWhoDoesWhatResult),
      ),
    });
    // déclenchement de loadWho via l'onglet
    component.setTab('who');
    expect(component.whoTotalPages()).toBe(3);
  });
});
