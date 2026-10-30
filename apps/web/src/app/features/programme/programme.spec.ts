import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { ProgramInsertPreview, ProgramSequence, ProgramSequenceStatus } from '../../models/models';
import { ProgrammePage } from './programme';
import { PROGRAM_EVENT_DAYS } from './schedule-chain.util';

const DAY = PROGRAM_EVENT_DAYS[1];

function seq(
  id: number,
  startTime: string,
  previousSequenceId: number | null,
  overrides: Partial<ProgramSequence> = {},
): ProgramSequence {
  return {
    id,
    eventDate: DAY,
    location: 'Grand Chapiteau',
    title: `Séquence ${id}`,
    startTime,
    durationMinutes: 60,
    endTime: '00:00',
    status: ProgramSequenceStatus.MOBILE,
    minDurationMinutes: 30,
    minMarginMinutes: null,
    previousSequenceId,
    anchorSequenceId: null,
    volunteerTeamId: null,
    volunteerTeamName: null,
    missionIds: [],
    documentLinks: [],
    notes: null,
    frozenByUserId: null,
    frozenByUserName: null,
    frozenAt: null,
    ...overrides,
  };
}

const SEQUENCES = [
  seq(1, '08:00', null),
  seq(2, '09:00', 1),
  seq(3, '10:00', 2),
  seq(4, '08:00', null, { location: 'Salle A', anchorSequenceId: 2 }),
];

function setup(roles: string[]) {
  TestBed.configureTestingModule({
    imports: [ProgrammePage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: AuthService,
        useValue: {
          hasAnyRole: (required: string[]) => required.some((r) => roles.includes(r)),
          currentUser: () => ({ id: 1, email: 'coordination@allegria2027.fr', roles }),
        },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ProgrammePage);
  fixture.detectChanges();
  const component = fixture.componentInstance;

  const flushDay = (sequences: ProgramSequence[] = SEQUENCES) =>
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences });

  return { component, http, flushDay };
}

describe('ProgrammePage', () => {
  it('charge le jour depuis l’API et affiche chaîne et KPI', () => {
    const { component, http, flushDay } = setup(['VIEWER']);
    flushDay();

    expect(component.chain().map((s) => s.id)).toEqual([1, 2, 3]);
    expect(component.kpis().total).toBe(3);
    expect(component.kpis().branches).toBe(1);
    http.verify();
  });

  it('change de jour en rechargeant depuis l’API', () => {
    const { component, http, flushDay } = setup(['VIEWER']);
    flushDay();

    component.setDay(2);
    http
      .expectOne(`/api/program/days/${PROGRAM_EVENT_DAYS[2]}`)
      .flush({ date: PROGRAM_EVENT_DAYS[2], sequences: [] });

    expect(component.allSequences()).toEqual([]);
    http.verify();
  });

  it('demande un aperçu d’insertion sans rien appliquer, puis applique avec la version après confirmation', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.openInsertForm(2);
    component.updateInsertDraft({ title: 'Pause', durationMinutes: 10 });
    component.previewInsertAction();

    const previewReq = http.expectOne('/api/program/sequences/2/insert-after/preview');
    expect(previewReq.request.method).toBe('POST');
    expect(previewReq.request.body).toMatchObject({ title: 'Pause', durationMinutes: 10 });
    const preview: ProgramInsertPreview = {
      kind: 'insert',
      afterSequenceId: 2,
      draft: { title: 'Pause', durationMinutes: 10, volunteerTeamId: null, notes: null },
      newSequence: {
        eventDate: DAY,
        location: 'Grand Chapiteau',
        title: 'Pause',
        startTime: '09:55',
        endTime: '10:05',
        durationMinutes: 10,
      },
      affected: [],
      outcome: 'ok',
      message: 'ok',
      version: 'v1',
    };
    previewReq.flush(preview);
    http.expectNone('/api/program/sequences/2/insert-after/apply');
    expect(component.preview()).not.toBeNull();

    component.confirmPreview();
    const applyReq = http.expectOne('/api/program/sequences/2/insert-after/apply');
    expect(applyReq.request.body).toMatchObject({ title: 'Pause', version: 'v1' });
    applyReq.flush({ sequence: seq(9, '09:55', 2), affected: [] });

    expect(component.preview()).toBeNull();
    expect(component.actionMessage()?.appearance).toBe('positive');
    flushDay([...SEQUENCES, seq(9, '09:55', 2)]);
    http.verify();
  });

  it('recharge le jour et ferme l’aperçu sur un conflit 409 (aperçu périmé)', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.resizeSequenceId.set(1);
    component.resizeDuration.set(40);
    component.previewResizeAction();
    http.expectOne('/api/program/sequences/1/resize/preview').flush({
      kind: 'resize',
      sequenceId: 1,
      previousDurationMinutes: 60,
      newDurationMinutes: 40,
      affected: [],
      stoppedAtFrozenId: null,
      marginMinutes: 20,
      outcome: 'ok',
      message: 'ok',
      version: 'v1',
    });

    component.confirmPreview();
    http
      .expectOne('/api/program/sequences/1/resize/apply')
      .flush(
        { message: 'Le programme a été modifié depuis l’aperçu.' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(component.actionMessage()?.appearance).toBe('negative');
    expect(component.preview()).toBeNull();
    flushDay();
    http.verify();
  });

  it('fige puis défige via l’API pour un rôle coordination', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.toggleFreeze(component.chain()[1]);
    http
      .expectOne('/api/program/sequences/2/freeze')
      .flush(seq(2, '09:00', 1, { status: ProgramSequenceStatus.FROZEN }));
    flushDay([
      SEQUENCES[0],
      seq(2, '09:00', 1, { status: ProgramSequenceStatus.FROZEN }),
      SEQUENCES[2],
      SEQUENCES[3],
    ]);

    component.toggleFreeze(component.chain()[1]);
    http.expectOne('/api/program/sequences/2/unfreeze').flush(SEQUENCES[1]);
    flushDay();
    http.verify();
  });

  it('n’appelle pas l’API de figement pour un rôle lecture seule', () => {
    const { component, http, flushDay } = setup(['VIEWER']);
    flushDay();

    component.toggleFreeze(component.chain()[1]);
    http.verify();
  });

  it('charge le journal du jour à l’ouverture', () => {
    const { component, http, flushDay } = setup(['VIEWER']);
    flushDay();

    component.toggleChangeLog();
    http.expectOne(`/api/program/change-log?date=${DAY}`).flush([
      {
        id: 1,
        action: 'FREEZE',
        eventDate: DAY,
        authorUserId: 1,
        authorUserName: 'coordination@allegria.local',
        createdAt: '2027-10-31T08:00:00.000Z',
        affectedSequenceIds: [2],
        comment: null,
      },
    ]);

    expect(component.changeLog()).toHaveLength(1);
    http.verify();
  });

  it('modifie une séquence (équipe, liens) via l’API puis recharge le jour', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.openEditForm(component.chain()[1]);
    http.expectOne('/api/volunteer-teams').flush([]);
    http.expectOne('/api/volunteer-missions').flush([
      { id: 5, title: 'Accueil', location: 'Hall' },
      { id: 6, title: 'Buvette', location: null },
    ]);
    component.toggleMission(5);
    component.updateEditDraft({ title: 'Titre édité', volunteerTeamId: 3 });
    component.addDocumentLink();
    component.updateDocumentLink(0, { label: 'RoS', url: 'https://drive.example.org/ros' });
    component.submitEdit();

    const req = http.expectOne('/api/program/sequences/2');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toMatchObject({
      title: 'Titre édité',
      volunteerTeamId: 3,
      missionIds: [5],
      documentLinks: [{ label: 'RoS', url: 'https://drive.example.org/ros' }],
    });
    req.flush(SEQUENCES[1]);
    flushDay();
    expect(component.editSequenceId()).toBeNull();
    http.verify();
  });

  it('crée la première séquence d’un lieu vide', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay([]);

    component.openCreateForm();
    component.updateCreateDraft({ title: 'Accueil', location: 'Salle C' });
    component.submitCreate();

    const req = http.expectOne('/api/program/sequences');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      eventDate: DAY,
      location: 'Salle C',
      title: 'Accueil',
      startTime: '09:00',
      durationMinutes: 30,
    });
    req.flush(seq(9, '09:00', null, { location: 'Salle C' }));
    flushDay([seq(9, '09:00', null, { location: 'Salle C' })]);
    expect(component.location()).toBe('Salle C');
    http.verify();
  });

  it('supprime une séquence mobile en comblant le trou si demandé', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.deleteSequence(component.chain()[1]);
    expect(component.deleteHasFollowing()).toBe(true);
    component.closeGap.set(true);
    component.confirmDelete();
    const req = http.expectOne('/api/program/sequences/2?closeGap=true');
    expect(req.request.method).toBe('DELETE');
    req.flush({ deletedId: 2, shiftedMinutes: 60 });
    flushDay();
    expect(component.deleteTargetId()).toBeNull();
    http.verify();
  });

  it('redimensionne à la souris via la poignée : aperçu seulement, calé sur 5 min', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    const target = { setPointerCapture: vi.fn() };
    const down = {
      clientY: 100,
      pointerId: 1,
      currentTarget: target,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    } as unknown as PointerEvent;
    component.startResize(down, component.chain()[1]);
    expect(down.stopPropagation).toHaveBeenCalled();

    // 2 px par minute : +40 px = +20 min
    component.onDragMove({ clientY: 140 } as PointerEvent);
    expect(component.blockHeight(component.chain()[1])).toBe((60 + 20) * 2);
    component.endResize();

    const req = http.expectOne('/api/program/sequences/2/resize/preview');
    expect(req.request.body).toEqual({ durationMinutes: 80 });
    expect(component.resizeDragState()).toBeNull();
    http.verify();
  });

  it('supprime une séquence mobile sans combler par défaut', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.deleteSequence(component.chain()[2]);
    expect(component.deleteHasFollowing()).toBe(false);
    component.confirmDelete();
    http.expectOne('/api/program/sequences/3').flush({ deletedId: 3, shiftedMinutes: 0 });
    flushDay();
    http.verify();
  });

  it('charge les 4 jours pour la vue d’ensemble en lecture seule', () => {
    const { component, http, flushDay } = setup(['VIEWER']);
    flushDay();

    component.showOverview();
    const requests = PROGRAM_EVENT_DAYS.map((date) => http.expectOne(`/api/program/days/${date}`));
    requests.forEach((req, index) =>
      req.flush({ date: PROGRAM_EVENT_DAYS[index], sequences: index === 1 ? SEQUENCES : [] }),
    );

    const day2 = component.overview()[1];
    expect(day2.locations.map((l) => [l.name, l.isBranch])).toEqual([
      ['Grand Chapiteau', false],
      ['Salle A', true],
    ]);
    http.verify();
  });
});
