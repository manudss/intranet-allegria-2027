import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth.service';
import {
  Group,
  ProgramSequenceDetail,
  ProgramSequenceStatus,
  ProgramSequenceTrack,
  ProgramSequenceVisibility,
} from '../../../models/models';
import { FicheEvenementPage } from './fiche-evenement';

const DAY = '2027-10-31';

function detail(overrides: Partial<ProgramSequenceDetail> = {}): ProgramSequenceDetail {
  return {
    id: 1,
    eventDate: DAY,
    location: 'Grande salle',
    title: 'Célébration d’ouverture',
    startTime: '13:30',
    durationMinutes: 120,
    endTime: '15:30',
    status: ProgramSequenceStatus.MOBILE,
    track: ProgramSequenceTrack.TA,
    visibility: ProgramSequenceVisibility.PUBLIC,
    minDurationMinutes: null,
    minMarginMinutes: null,
    previousSequenceId: null,
    anchorSequenceId: null,
    volunteerTeamId: 3,
    volunteerTeamName: 'Animation',
    missionIds: [42],
    documentLinks: [{ label: 'Run of show', url: 'https://example.org/ros' }],
    notes: null,
    frozenByUserId: null,
    frozenByUserName: null,
    frozenAt: null,
    groupIds: [11],
    ...overrides,
  };
}

function flushInitialLoad(
  http: HttpTestingController,
  seq: ProgramSequenceDetail = detail(),
  daySequences: unknown[] = [],
  linked: unknown[] = [],
) {
  http.expectOne('/api/program/sequences/1').flush(seq);
  http.expectOne('/api/program/sequences/1/tasks').flush([]);
  http.expectOne('/api/volunteer-missions').flush([
    { id: 42, title: 'Accueil des groupes', location: 'Parvis' },
    { id: 43, title: 'Service café', location: null },
  ]);
  http.expectOne('/api/volunteer-teams').flush([{ id: 3, name: 'Animation' }]);
  http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences: daySequences });
  http.expectOne('/api/gathering/sequences/1/repartitions').flush(linked);
  http.expectOne('/api/gathering/repartitions').flush([]);
}

describe('FicheEvenementPage', () => {
  function setup(roles: string[] = ['ADMIN']) {
    const navigate = vi.fn();
    TestBed.configureTestingModule({
      imports: [FicheEvenementPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { hasAnyRole: (required: string[]) => required.some((r) => roles.includes(r)) },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: '1' })) },
        },
        { provide: Router, useValue: { navigate } },
      ],
    });
    const fixture = TestBed.createComponent(FicheEvenementPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    return { fixture, http, component: fixture.componentInstance, navigate };
  }

  it('charge la fiche : détail, groupes, missions et équipe', () => {
    const { fixture, http, component } = setup();
    flushInitialLoad(http);
    fixture.detectChanges();
    expect(component.sequence()?.title).toBe('Célébration d’ouverture');
    expect(component.linkedGatheringGroups()).toEqual([]);
    expect(component.linkedMissions().map((m) => m.title)).toEqual(['Accueil des groupes']);
    expect(component.loading()).toBe(false);
    http.verify();
  });

  it('charge le journal filtré au premier affichage de l’onglet Historique', () => {
    const { fixture, http, component } = setup();
    flushInitialLoad(http);
    component.selectTab(4);
    http
      .expectOne((r) => r.url === '/api/program/change-log' && r.params.get('sequenceId') === '1')
      .flush([
        {
          id: 9,
          action: 'UPDATE',
          eventDate: DAY,
          authorUserId: 7,
          authorUserName: 'coord@allegria.local',
          createdAt: '2027-10-01T10:00:00Z',
          affectedSequenceIds: [1],
          comment: 'Titre modifié',
        },
      ]);
    expect(component.logs()).toHaveLength(1);
    expect(component.logsLoaded()).toBe(true);
    http.verify();
  });

  it('ajoute une tâche avec échéance relative', () => {
    const { fixture, http, component } = setup();
    flushInitialLoad(http);
    component.taskDraft.set({
      title: 'Imprimer les feuilles de route',
      dueKind: 'offset',
      dueOffsetMinutes: 180,
      dueDate: '',
      responsible: 'M. Vial',
    });
    component.addTask();
    const request = http.expectOne('/api/program/sequences/1/tasks');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      title: 'Imprimer les feuilles de route',
      dueOffsetMinutes: 180,
      dueDate: null,
      responsible: 'M. Vial',
    });
    request.flush({
      id: 5,
      sequenceId: 1,
      title: 'Imprimer les feuilles de route',
      dueOffsetMinutes: 180,
      dueDate: null,
      responsible: 'M. Vial',
      isDone: false,
      doneAt: null,
      createdAt: '2027-10-01T08:00:00Z',
    });
    expect(component.tasks()).toHaveLength(1);
    expect(fixture.componentInstance.taskDueLabel(component.tasks()[0])).toBe('3 h avant le début');
    http.verify();
  });

  it('bascule une tâche en faite', () => {
    const { http, component } = setup();
    flushInitialLoad(http);
    const task = {
      id: 5,
      sequenceId: 1,
      title: 'Météo',
      dueOffsetMinutes: null,
      dueDate: '2027-10-30',
      responsible: null,
      isDone: false,
      doneAt: null,
      createdAt: '2027-10-01T08:00:00Z',
    };
    component.tasks.set([task]);
    component.toggleTask(task);
    const request = http.expectOne('/api/program/sequences/1/tasks/5');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ isDone: true });
    request.flush({ ...task, isDone: true, doneAt: '2027-10-01T09:00:00Z' });
    expect(component.tasks()[0].isDone).toBe(true);
    http.verify();
  });

  it('détache une répartition du créneau', () => {
    const { http, component } = setup();
    flushInitialLoad(http);
    component.unlinkRepartition(5);
    const request = http.expectOne('/api/gathering/repartitions/5');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ programSequenceId: null });
    request.flush({});
    http.expectOne('/api/gathering/sequences/1/repartitions').flush([]);
    http.expectOne('/api/gathering/repartitions').flush([]);
    http.verify();
  });

  it('duplique le créneau et navigue vers la copie', () => {
    const { http, component, navigate } = setup();
    flushInitialLoad(http);
    component.duplicate();
    const request = http.expectOne('/api/program/sequences/1/duplicate');
    expect(request.request.method).toBe('POST');
    request.flush(detail({ id: 99, title: 'Célébration d’ouverture (copie)' }));
    expect(navigate).toHaveBeenCalledWith(['/programme/evenements', 99]);
    http.verify();
  });

  it('fige puis recharge la fiche', () => {
    const { http, component } = setup();
    flushInitialLoad(http);
    component.toggleFreeze();
    http.expectOne('/api/program/sequences/1/freeze').flush(detail({ status: ProgramSequenceStatus.FROZEN }));
    http.expectOne('/api/program/sequences/1').flush(detail({ status: ProgramSequenceStatus.FROZEN }));
    expect(component.sequence()?.status).toBe(ProgramSequenceStatus.FROZEN);
    http.verify();
  });

  it('masque les actions d’écriture pour un lecteur', () => {
    const { http, component } = setup(['VIEWER']);
    flushInitialLoad(http);
    expect(component.canEdit()).toBe(false);
    http.verify();
  });

  it('crée une mission puis la lie au créneau', () => {
    const { http, component } = setup();
    flushInitialLoad(http);
    component.startNewMission();
    component.updateNewMission({ title: 'Régie son', volunteerTeamId: 3, location: 'Grande salle' });
    component.createAndLinkMission();
    const createRequest = http.expectOne('/api/volunteer-missions');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body.title).toBe('Régie son');
    expect(createRequest.request.body.status).toBe('DRAFT');
    createRequest.flush({ id: 50, title: 'Régie son', location: 'Grande salle' });
    const linkRequest = http.expectOne('/api/program/sequences/1');
    expect(linkRequest.request.method).toBe('PATCH');
    expect(linkRequest.request.body).toEqual({ missionIds: [42, 50] });
    linkRequest.flush(detail({ missionIds: [42, 50] }));
    http.expectOne('/api/program/sequences/1').flush(detail({ missionIds: [42, 50] }));
    expect(component.missions().some((m) => m.id === 50)).toBe(true);
    expect(component.tabLabels()[1]).toBe('Missions & tâches 2 · 0');
    http.verify();
  });

  it('exige un titre pour créer une mission', () => {
    const { http, component } = setup();
    flushInitialLoad(http);
    component.startNewMission();
    component.createAndLinkMission();
    expect(component.missionFormError()).toBeTruthy();
    http.verify();
  });

  it('affiche les compteurs dans les onglets', () => {
    const { http, component } = setup();
    flushInitialLoad(http);
    expect(component.tabLabels()).toEqual([
      'Détails',
      'Missions & tâches 1 · 0',
      'Groupes concernés 0',
      'Documents 1',
      'Historique',
    ]);
    http.verify();
  });

  const RESIZE_PREVIEW = {
    kind: 'resize',
    sequenceId: 1,
    previousDurationMinutes: 120,
    newDurationMinutes: 150,
    affected: [
      {
        sequenceId: 2,
        title: 'Goûter',
        before: { startTime: '15:30', endTime: '16:30', durationMinutes: 60 },
        after: { startTime: '16:00', endTime: '17:00', durationMinutes: 60 },
      },
    ],
    stoppedAtFrozenId: null,
    marginMinutes: null,
    outcome: 'ok',
    message: '1 créneau décalé',
    version: 'v1',
  };

  it('prévisualise puis applique un changement de durée', () => {
    const { http, component } = setup();
    flushInitialLoad(http);
    component.startTimeEdit();
    component.updateTimeEdit({ durationMinutes: 150 });
    component.previewTimeChange();
    const previewRequest = http.expectOne('/api/program/sequences/1/resize/preview');
    expect(previewRequest.request.method).toBe('PATCH');
    expect(previewRequest.request.body).toEqual({ durationMinutes: 150 });
    previewRequest.flush(RESIZE_PREVIEW);
    expect(component.timePreview()?.outcome).toBe('ok');
    component.applyTimeChange();
    const applyRequest = http.expectOne('/api/program/sequences/1/resize/apply');
    expect(applyRequest.request.body).toEqual({ durationMinutes: 150, version: 'v1' });
    applyRequest.flush({ affected: [] });
    http.expectOne('/api/program/sequences/1').flush(detail({ durationMinutes: 150, endTime: '16:00' }));
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences: [] });
    expect(component.timeEdit()).toBeNull();
    http.verify();
  });

  it('décale le début en redimensionnant le prédécesseur', () => {
    const { http, component } = setup();
    const previous = detail({ id: 5, title: 'Trajet', previousSequenceId: null, durationMinutes: 45 });
    flushInitialLoad(http, detail({ previousSequenceId: 5 }), [previous]);
    component.startTimeEdit();
    component.updateTimeEdit({ startTime: '14:00' });
    component.previewTimeChange();
    // +30 min de décalage => le prédécesseur passe de 45 à 75 min
    const previewRequest = http.expectOne('/api/program/sequences/5/resize/preview');
    expect(previewRequest.request.body).toEqual({ durationMinutes: 75 });
    previewRequest.flush({ ...RESIZE_PREVIEW, sequenceId: 5 });
    component.applyTimeChange();
    http.expectOne('/api/program/sequences/5/resize/apply').flush({ affected: [] });
    http.expectOne('/api/program/sequences/1').flush(detail({ previousSequenceId: 5 }));
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences: [] });
    http.verify();
  });

  it('refuse de valider début et durée ensemble, et le début en tête de chaîne', () => {
    const { http, component } = setup();
    flushInitialLoad(http);
    component.startTimeEdit();
    component.updateTimeEdit({ startTime: '14:00', durationMinutes: 150 });
    component.previewTimeChange();
    expect(component.timeError()).toContain('début ou la durée');
    // Tête de chaîne (previousSequenceId null) : début non décalable
    component.updateTimeEdit({ startTime: '14:00', durationMinutes: 120 });
    component.previewTimeChange();
    expect(component.timeError()).toContain('Premier créneau');
    http.verify();
  });

  it('bloque l’application quand l’aperçu n’est pas ok', () => {
    const { http, component } = setup();
    flushInitialLoad(http);
    component.startTimeEdit();
    component.updateTimeEdit({ durationMinutes: 300 });
    component.previewTimeChange();
    http
      .expectOne('/api/program/sequences/1/resize/preview')
      .flush({ ...RESIZE_PREVIEW, outcome: 'partial', stoppedAtFrozenId: 9, message: 'Bloqué par un créneau figé' });
    component.applyTimeChange();
    http.expectNone('/api/program/sequences/1/resize/apply');
    http.verify();
  });
});
