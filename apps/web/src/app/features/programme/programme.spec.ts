import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import {
  ProgramInsertPreview,
  ProgramSequence,
  ProgramSequenceStatus,
  ProgramSequenceTrack,
  ProgramSequenceVisibility,
} from '../../models/models';
import { ProgrammePage } from './programme';
import { PROGRAM_EVENT_DAYS } from './schedule-chain.util';

const DAY = PROGRAM_EVENT_DAYS[0];

function seq(
  id: number,
  startTime: string,
  previousSequenceId: number | null,
  overrides: Partial<ProgramSequence> = {},
): ProgramSequence {
  return {
    id,
    eventDate: DAY,
    location: 'Grande salle',
    title: `Séquence ${id}`,
    startTime,
    durationMinutes: 60,
    endTime: '00:00',
    status: ProgramSequenceStatus.MOBILE,
    track: ProgramSequenceTrack.COMMON,
    visibility: ProgramSequenceVisibility.INTERNAL,
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
      provideRouter([]),
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

  const flushDay = (sequences: ProgramSequence[] = SEQUENCES) => {
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences });
    http.expectOne('/api/program/public-export').flush([]);
    http.expectOne('/api/program/change-log').flush([]);
  };

  return { component, http, flushDay, fixture };
}

describe('ProgrammePage', () => {
  it('pré-positionne jour et lieu depuis un lien profond (fiche événement)', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();
    component.applyQueryParams(
      convertToParamMap({ date: PROGRAM_EVENT_DAYS[1], lieu: 'Salle A' }),
    );
    expect(component.dayIndex()).toBe(1);
    expect(component.location()).toBe('Salle A');
    component.applyQueryParams(convertToParamMap({ date: '2030-01-01' }));
    expect(component.dayIndex()).toBe(1);
    http.verify();
  });

  it('envoie la visibilité choisie à la création (réservé par défaut)', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.openCreateForm();
    expect(component.createDraft().visibility).toBe(ProgramSequenceVisibility.INTERNAL);
    component.updateCreateDraft({
      location: 'Chapelle',
      title: 'Veillée',
      visibility: ProgramSequenceVisibility.PUBLIC,
    });
    component.submitCreate();

    const req = http.expectOne('/api/program/sequences');
    expect(req.request.body.visibility).toBe(ProgramSequenceVisibility.PUBLIC);
    req.flush(SEQUENCES[0]);
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences: SEQUENCES });
    http.expectOne('/api/program/public-export').flush([]);
  });

  it('le bouton « Mettre à jour la liste publique » régénère l’instantané', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.publishPublicProgram();
    const req = http.expectOne('/api/program/public-export');
    expect(req.request.method).toBe('POST');
    req.flush({ dates: [DAY], generatedAt: '2027-10-31T10:00:00.000Z' });
    http.expectOne('/api/program/public-export').flush([
      { eventDate: DAY, generatedAt: '2027-10-31T10:00:00.000Z', sequenceCount: 3 },
    ]);

    expect(component.actionMessage()?.appearance).toBe('positive');
    expect(component.publicExportStatus()?.length).toBe(1);
    http.verify();
  });

  it('charge le jour depuis l’API et affiche chaîne et KPI', () => {
    const { component, http, flushDay } = setup(['VIEWER']);
    flushDay();

    expect(component.chain().map((s) => s.id)).toEqual([1, 2, 3]);
    expect(component.dayStats().total).toBe(4);
    expect(component.dayStats().branches).toBe(1);
    http.verify();
  });

  it('change de jour en rechargeant depuis l’API', () => {
    const { component, http, flushDay } = setup(['VIEWER']);
    flushDay();

    component.setDay(2);
    http
      .expectOne(`/api/program/days/${PROGRAM_EVENT_DAYS[2]}`)
      .flush({ date: PROGRAM_EVENT_DAYS[2], sequences: [] });
    http.expectOne('/api/program/public-export').flush([]);
    http.expectOne('/api/program/change-log').flush([]);

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
        location: 'Grande salle',
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

  it('charge le journal complet au chargement et compte les entrées du jour affiché', () => {
    const { component, http } = setup(['VIEWER']);
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences: SEQUENCES });
    http.expectOne('/api/program/public-export').flush([]);
    http.expectOne('/api/program/change-log').flush([
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
      {
        id: 2,
        action: 'INSERT',
        eventDate: PROGRAM_EVENT_DAYS[1],
        authorUserId: 1,
        authorUserName: null,
        createdAt: '2027-11-01T08:00:00.000Z',
        affectedSequenceIds: [9],
        comment: null,
      },
    ]);

    expect(component.changeLog()).toHaveLength(2);
    expect(component.journalCount()).toBe(1);
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

  it('filtre les créneaux par piste dans le calendrier, sans toucher aux données', () => {
    const { component, flushDay } = setup(['VIEWER']);
    flushDay([
      seq(1, '08:00', null, { track: ProgramSequenceTrack.TA }),
      seq(2, '09:00', 1, { track: ProgramSequenceTrack.ES }),
      seq(3, '10:00', 2),
    ]);

    expect(component.columns()[0].blocks).toHaveLength(3);
    component.setTrackFilter(ProgramSequenceTrack.TA);
    expect(component.columns()[0].blocks.map((b) => b.sequence?.id)).toEqual([1]);
    component.setTrackFilter(ProgramSequenceTrack.ES);
    expect(component.columns()[0].blocks.map((b) => b.sequence?.id)).toEqual([2]);
    component.setTrackFilter(ProgramSequenceTrack.COMMON);
    expect(component.columns()[0].blocks.map((b) => b.sequence?.id)).toEqual([3]);
    component.setTrackFilter('ALL');
    expect(component.columns()[0].blocks).toHaveLength(3);
  });

  it('vue « Par piste » : communs pleine largeur, TA/ES appariés sur le même horaire, filtre appliqué', () => {
    const { component, flushDay } = setup(['VIEWER']);
    flushDay([
      seq(1, '09:00', null, { title: 'Rassemblement' }), // commun
      seq(2, '10:00', 1, { title: 'Jeu ville', track: ProgramSequenceTrack.TA }),
      seq(3, '10:00', 2, { title: 'Atelier', track: ProgramSequenceTrack.ES }),
      seq(4, '14:00', 3, { title: 'Sortie', track: ProgramSequenceTrack.TA }),
    ]);

    component.setDayLayout('tracks');
    const rows = component.trackRows();
    expect(rows.map((r) => (r.common ? 'common' : 'pair'))).toEqual(['common', 'pair', 'pair']);
    expect(rows[0].common?.title).toBe('Rassemblement');
    expect(rows[1].ta?.title).toBe('Jeu ville');
    expect(rows[1].es?.title).toBe('Atelier'); // appariés : même horaire
    expect(rows[2].ta?.title).toBe('Sortie');
    expect(rows[2].es).toBeNull(); // TA seul : moitié vide, pas de déplacement

    // Le filtre par piste s'applique aussi à cette vue.
    component.setTrackFilter(ProgramSequenceTrack.ES);
    const filtered = component.trackRows();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].es?.title).toBe('Atelier');
  });

  it('vue « Par piste » : le cadre de scission noté « Temps séparé » n\u2019est pas rendu en double', () => {
    const { component, flushDay } = setup(['VIEWER']);
    const split = 'Temps séparé : un programme par groupe (TA / ES).';
    flushDay([
      // Cadre noté + paire ancrée au même horaire : masqué.
      seq(1, '09:00', null, { title: 'Messe en paroisse', notes: split, endTime: '11:00' }),
      seq(2, '09:00', 1, { title: 'Messe TA', track: ProgramSequenceTrack.TA, anchorSequenceId: 1, endTime: '11:00' }),
      seq(3, '09:00', 2, { title: 'Messe ES', track: ProgramSequenceTrack.ES, anchorSequenceId: 1, endTime: '11:00' }),
      // Cadre noté non ancré (créneau de branche suivant) mais même fenêtre : masqué aussi.
      seq(4, '14:00', 3, { title: 'Jeu (cadre)', notes: split, endTime: '16:30' }),
      seq(5, '14:00', 4, { title: 'Jeu TA', track: ProgramSequenceTrack.TA, endTime: '16:30' }),
      seq(6, '14:00', 5, { title: 'Jeu ES', track: ProgramSequenceTrack.ES, endTime: '16:30' }),
      // Vrai temps commun au même horaire qu\u2019un créneau TA, SANS la note : toujours rendu.
      seq(7, '18:30', 6, { title: 'Dîner', endTime: '19:45' }),
      seq(8, '18:30', 7, { title: 'Dîner TA', track: ProgramSequenceTrack.TA, endTime: '19:45' }),
      // Cadre noté mais chevauchement partiel seulement (branches déplacées) : rendu, pas masqué.
      seq(9, '20:00', 8, { title: 'Veillée (cadre)', notes: split, endTime: '21:30' }),
      seq(10, '20:30', 9, { title: 'Veillée TA', track: ProgramSequenceTrack.TA, endTime: '21:30' }),
      seq(11, '12:00', 10, { title: 'Repas' }),
    ]);

    component.setDayLayout('tracks');
    const rows = component.trackRows();
    expect(rows.map((r) => (r.common ? r.common.title : 'pair'))).toEqual([
      'pair', 'Repas', 'pair', 'Dîner', 'pair', 'Veillée (cadre)', 'pair',
    ]);
    expect(rows[0].ta?.title).toBe('Messe TA');
    expect(rows[0].es?.title).toBe('Messe ES');
    expect(rows[2].ta?.title).toBe('Jeu TA');
    expect(rows[2].es?.title).toBe('Jeu ES');
    // Le dîner commun et son homonyme TA cohabitent : pas de masquage générique par horaire.
    expect(rows[3].common?.title).toBe('Dîner');
    expect(rows[4].ta?.title).toBe('Dîner TA');
    // Cadre noté dont les branches ont glissé : rendu pour ne pas perdre l\u2019information.
    expect(rows[5].common?.title).toBe('Veillée (cadre)');
    expect(rows[6].ta?.startTime).toBe('20:30');
  });

  it('envoie la piste choisie à la création comme à l’édition', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.openCreateForm();
    component.updateCreateDraft({ title: 'Atelier', location: 'Salle C', track: ProgramSequenceTrack.TA });
    component.submitCreate();
    const createReq = http.expectOne('/api/program/sequences');
    expect(createReq.request.body).toMatchObject({ track: ProgramSequenceTrack.TA });
    createReq.flush(seq(9, '09:00', null, { location: 'Salle C', track: ProgramSequenceTrack.TA }));
    flushDay();

    component.openEditForm(component.chain()[0]);
    expect(component.editDraft().track).toBe(ProgramSequenceTrack.COMMON);
    component.updateEditDraft({ track: ProgramSequenceTrack.ES });
    // Équipe et missions chargées en parallèle de l'ouverture.
    http.expectOne('/api/volunteer-teams').flush([]);
    http.expectOne('/api/volunteer-missions').flush([]);
    component.submitEdit();
    const editReq = http.expectOne('/api/program/sequences/1');
    expect(editReq.request.body).toMatchObject({ track: ProgramSequenceTrack.ES });
    editReq.flush(seq(1, '08:00', null, { track: ProgramSequenceTrack.ES }));
    flushDay();
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
    const block = component.columns()[0].blocks.find((b) => b.sequence?.id === 2)!;
    expect(component.liveHeight(block)).toBe((60 + 20) * 2);
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
      ['Grande salle', false],
      ['Salle A', true],
    ]);
    http.verify();
  });
  it.each([5, 15, 30])('garde les actions hors du bloc pour une durée de %i min', (durationMinutes) => {
    const { http, flushDay, fixture, component } = setup(['COORDINATOR']);
    flushDay([seq(1, '09:00', null, { durationMinutes, endTime: '09:30' })]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.sequence-block button')).toBeNull();
    // Les actions vivent dans le menu ouvert au clic, même pour un créneau très court.
    const block = component.columns()[0].blocks[0];
    component.onBlockClick(new MouseEvent('click', { clientX: 10, clientY: 10 }), block);
    fixture.detectChanges();
    const menu = root.querySelector('.sequence-menu')!;
    expect([...menu.querySelectorAll('.menu-item')].map((item) => item.textContent?.trim())).toEqual([
      'Ouvrir la fiche',
      'Modification rapide',
      'Insérer après',
      'Redimensionner',
      'Figer',
      'Supprimer',
    ]);
    http.verify();
  });

  it('affiche l’aperçu dans le calendrier : créneaux modifiés distincts, ancienne position en fantôme', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.resizeSequenceId.set(1);
    component.resizeDuration.set(90);
    component.previewResizeAction();
    http.expectOne('/api/program/sequences/1/resize/preview').flush({
      kind: 'resize',
      sequenceId: 1,
      previousDurationMinutes: 60,
      newDurationMinutes: 90,
      affected: [
        {
          sequenceId: 1,
          title: 'Séquence 1',
          before: { startTime: '08:00', endTime: '09:00', durationMinutes: 60 },
          after: { startTime: '08:00', endTime: '09:30', durationMinutes: 90 },
        },
        {
          sequenceId: 2,
          title: 'Séquence 2',
          before: { startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          after: { startTime: '09:30', endTime: '10:30', durationMinutes: 60 },
        },
      ],
      stoppedAtFrozenId: null,
      marginMinutes: null,
      outcome: 'ok',
      message: 'ok',
      version: 'v1',
    });

    const blocks = component.columns()[0].blocks;
    const first = blocks.find((b) => b.sequence?.id === 1)!;
    const second = blocks.find((b) => b.sequence?.id === 2)!;
    const third = blocks.find((b) => b.sequence?.id === 3)!;
    expect(first.change).toBe('changed');
    expect(first.heightPx).toBe(90 * 2);
    expect(second.change).toBe('changed');
    expect(second.startTime).toBe('09:30');
    expect(second.ghost?.label).toBe('09:00 – 10:00');
    expect(third.change).toBe('none');
    expect(component.pendingChangeCount()).toBe(2);

    component.cancelPreview();
    expect(component.columns()[0].blocks.every((b) => b.change === 'none' && !b.ghost)).toBe(true);
    http.verify();
  });

  it('montre un créneau en cours d’insertion comme « nouveau » dans la bonne colonne', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();
    component.preview.set({
      kind: 'insert',
      afterSequenceId: 2,
      draft: { title: 'Pause', durationMinutes: 15, volunteerTeamId: null, notes: null },
      newSequence: {
        eventDate: DAY,
        location: 'Grande salle',
        title: 'Pause',
        startTime: '10:00',
        endTime: '10:15',
        durationMinutes: 15,
      },
      affected: [],
      outcome: 'ok',
      message: 'ok',
      version: 'v1',
    });
    const grande = component.columns().find((c) => c.name === 'Grande salle')!;
    expect(grande.blocks.find((b) => b.key === 'new')?.change).toBe('new');
    expect(component.columns().find((c) => c.name === 'Salle A')!.blocks.some((b) => b.key === 'new')).toBe(false);
    http.verify();
  });

  it('aperçu de redimensionnement sans la cible dans affected : la cible est projetée et comptée', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();
    component.preview.set({
      kind: 'resize',
      sequenceId: 1,
      previousDurationMinutes: 60,
      newDurationMinutes: 75,
      affected: [
        {
          sequenceId: 2,
          title: 'Séquence 2',
          before: { startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          after: { startTime: '09:15', endTime: '10:00', durationMinutes: 45 },
        },
      ],
      stoppedAtFrozenId: null,
      marginMinutes: null,
      outcome: 'ok',
      message: 'ok',
      version: 'v1',
    });
    const first = component.columns()[0].blocks.find((b) => b.sequence?.id === 1)!;
    expect(first.change).toBe('changed');
    expect(first.heightPx).toBe(75 * 2);
    expect(first.ghost).not.toBeNull();
    expect(component.pendingChangeCount()).toBe(2);
    expect(component.previewDiffs().map((d) => d.sequenceId)).toEqual([1, 2]);
    const target = component.previewDiffs().find((d) => d.sequenceId === 1);
    expect(`${target?.after.startTime} - ${target?.after.endTime}`).toBe('08:00 - 09:15');
    http.verify();
  });

  it('aperçu partiel : bloqué en rouge, validation refusée, détail avant/après explicite', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();
    component.preview.set({
      kind: 'resize',
      sequenceId: 1,
      previousDurationMinutes: 60,
      newDurationMinutes: 90,
      affected: [
        {
          sequenceId: 2,
          title: 'Séquence 2',
          before: { startTime: '09:00', endTime: '10:00', durationMinutes: 60 },
          after: { startTime: '09:30', endTime: '10:15', durationMinutes: 45 },
        },
      ],
      stoppedAtFrozenId: 3,
      marginMinutes: null,
      outcome: 'partial',
      message: 'bloqué',
      version: 'v1',
    });
    expect(component.columns()[0].blocks.find((b) => b.sequence?.id === 2)?.change).toBe('blocked');
    const projected = component.previewDiffs().find((diff) => diff.sequenceId === 2);
    expect(projected?.after).toEqual({ startTime: '09:30', endTime: '10:15', durationMinutes: 45 });
    expect(component.preview()?.outcome).not.toBe('ok');
    component.confirmPreview();
    http.expectNone('/api/program/sequences/1/resize/apply');
    expect(component.previewDiffs().some((diff) => diff.sequenceId === 3)).toBe(false);
    http.verify();
  });

  it('recherche : seuls les créneaux correspondant au texte restent affichés', () => {
    const { component, flushDay } = setup(['VIEWER']);
    flushDay([
      seq(1, '08:00', null, { title: 'Grand Jeu', location: 'Stade' }),
      seq(2, '09:00', 1, { title: 'Repas', location: 'Stade' }),
      seq(3, '10:00', 2, { title: 'Veillée', location: 'Chapelle' }),
    ]);

    expect(component.columns().flatMap((column) => column.blocks)).toHaveLength(3);
    component.setSearchQuery('grand');
    expect(
      component.columns().flatMap((column) => column.blocks).map((b) => b.sequence?.id),
    ).toEqual([1]);
    component.setSearchQuery('chapelle');
    expect(
      component.columns().flatMap((column) => column.blocks).map((b) => b.sequence?.id),
    ).toEqual([3]);
    component.setSearchQuery('');
    expect(component.columns().flatMap((column) => column.blocks)).toHaveLength(3);
  });

  it('la recherche s’applique aussi à la vue « Par piste »', () => {
    const { component, flushDay } = setup(['VIEWER']);
    flushDay([
      seq(1, '08:00', null, { title: 'Grand Jeu', track: ProgramSequenceTrack.TA }),
      seq(2, '09:00', 1, { title: 'Repas', track: ProgramSequenceTrack.ES }),
    ]);

    expect(component.trackRows()).toHaveLength(2);
    component.setSearchQuery('repas');
    const rows = component.trackRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].es?.id).toBe(2);
  });

  it('clic sur un créneau : le menu d’actions s’ouvre près du pointeur puis se ferme', () => {
    const { component, flushDay } = setup(['COORDINATOR']);
    flushDay();

    const sequence = component.chain()[1];
    component.onSequenceClick(new MouseEvent('click', { clientX: 100, clientY: 200 }), sequence);
    expect(component.sequenceMenu()?.sequence.id).toBe(sequence.id);
    expect(component.sequenceMenu()?.x).toBe(100);
    expect(component.sequenceMenu()?.y).toBe(200);

    component.closeSequenceMenu();
    expect(component.sequenceMenu()).toBeNull();
  });

  it('le menu est borné par les bords de la fenêtre', () => {
    const { component, flushDay } = setup(['COORDINATOR']);
    flushDay();

    component.onSequenceClick(
      new MouseEvent('click', { clientX: 100000, clientY: 100000 }),
      component.chain()[0],
    );
    expect(component.sequenceMenu()!.x).toBeLessThan(100000);
    expect(component.sequenceMenu()!.y).toBeLessThan(100000);
  });

  it('les actions du menu ouvrent les formulaires existants du créneau', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    const sequence = component.chain()[1];
    component.onSequenceClick(new MouseEvent('click', { clientX: 10, clientY: 10 }), sequence);

    component.menuInsertAfter();
    expect(component.insertAfterId()).toBe(sequence.id);
    expect(component.sequenceMenu()).toBeNull();

    component.onSequenceClick(new MouseEvent('click', { clientX: 10, clientY: 10 }), sequence);
    component.menuResize();
    expect(component.resizeSequenceId()).toBe(sequence.id);
    expect(component.resizeDuration()).toBe(sequence.durationMinutes);

    component.onSequenceClick(new MouseEvent('click', { clientX: 10, clientY: 10 }), sequence);
    component.menuDelete();
    expect(component.deleteTarget()?.id).toBe(sequence.id);

    component.onSequenceClick(new MouseEvent('click', { clientX: 10, clientY: 10 }), sequence);
    component.menuToggleFreeze();
    http.expectOne(`/api/program/sequences/${sequence.id}/freeze`).flush(
      seq(sequence.id, '09:00', 1, { status: ProgramSequenceStatus.FROZEN }),
    );
    flushDay([
      SEQUENCES[0],
      seq(2, '09:00', 1, { status: ProgramSequenceStatus.FROZEN }),
      SEQUENCES[2],
      SEQUENCES[3],
    ]);
    http.verify();
  });

  it('la « Modification rapide » du menu ouvre l’éditeur du créneau', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    const sequence = component.chain()[1];
    component.onSequenceClick(new MouseEvent('click', { clientX: 10, clientY: 10 }), sequence);
    component.menuQuickEdit();

    http.expectOne('/api/volunteer-teams').flush([]);
    http.expectOne('/api/volunteer-missions').flush([]);
    expect(component.editingSequence()?.id).toBe(sequence.id);
    expect(component.sequenceMenu()).toBeNull();
    http.verify();
  });

  it('fin de glisser sans déplacement = clic : le menu s’ouvre sans aperçu', () => {
    const { component, http, flushDay } = setup(['COORDINATOR']);
    flushDay();

    const sequence = component.chain()[1];
    component.dragState.set({
      sequenceId: sequence.id,
      previousId: 1,
      baseDuration: 60,
      startClientY: 0,
      deltaMinutes: 0,
    });
    component.endDrag(new MouseEvent('pointerup', { clientX: 42, clientY: 43 }) as PointerEvent);

    expect(component.sequenceMenu()?.sequence.id).toBe(sequence.id);
    http.expectNone(`/api/program/sequences/1/resize/preview`);
    http.verify();
  });

  it('bandeau liste publique : jamais générée, à republier après modifications, sinon à jour', () => {
    const { component, http } = setup(['COORDINATOR']);
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences: SEQUENCES });
    http.expectOne('/api/program/public-export').flush([]);
    http.expectOne('/api/program/change-log').flush([]);
    expect(component.exportBanner()?.kind).toBe('never');

    component.loadPublicExportStatus();
    http.expectOne('/api/program/public-export').flush([
      { eventDate: DAY, generatedAt: '2027-10-30T10:00:00.000Z', sequenceCount: 3 },
    ]);
    component.refreshAfterQuickEdit();
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences: SEQUENCES });
    http.expectOne('/api/program/public-export').flush([
      { eventDate: DAY, generatedAt: '2027-10-30T10:00:00.000Z', sequenceCount: 3 },
    ]);
    http.expectOne('/api/program/change-log').flush([
      {
        id: 1,
        action: 'INSERT',
        eventDate: DAY,
        authorUserId: 1,
        authorUserName: null,
        createdAt: '2027-10-31T08:00:00.000Z',
        affectedSequenceIds: [1],
        comment: null,
      },
      {
        id: 2,
        action: 'UPDATE',
        eventDate: DAY,
        authorUserId: 1,
        authorUserName: null,
        createdAt: '2027-10-29T08:00:00.000Z',
        affectedSequenceIds: [2],
        comment: null,
      },
    ]);

    const banner = component.exportBanner();
    expect(banner?.kind).toBe('stale');
    expect(banner?.changesSince).toBe(1);
    http.verify();
  });

  it('le compteur « Journal (n) » reflète les entrées du jour affiché', () => {
    const { component, http } = setup(['VIEWER']);
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences: SEQUENCES });
    http.expectOne('/api/program/public-export').flush([]);
    http.expectOne('/api/program/change-log').flush([
      {
        id: 1,
        action: 'INSERT',
        eventDate: DAY,
        authorUserId: 1,
        authorUserName: null,
        createdAt: '2027-10-31T08:00:00.000Z',
        affectedSequenceIds: [1],
        comment: null,
      },
    ]);

    expect(component.journalCount()).toBe(1);
    http.verify();
  });

  it('n’affiche aucun bouton de démonstration, même pour un admin et un jour vide', () => {
    const { http, fixture } = setup(['ADMIN']);
    http.expectOne(`/api/program/days/${DAY}`).flush({ date: DAY, sequences: [] });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Aucune séquence pour ce jour.');
    expect(text.toLowerCase()).not.toContain('démo');
    expect(fixture.nativeElement.querySelector('.demo-reset')).toBeNull();
  });
});
