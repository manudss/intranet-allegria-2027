import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { EventMissionLinksComponent } from './event-mission-links';
import {
  ProgramApiService,
  VolunteerMissionsApiService,
  VolunteerTeamsApiService,
} from '../../../services/api.services';
import { ProgramSequenceDetail, VolunteerMission } from '../../../models/models';
describe('EventMissionLinks', () => {
  const api = {
    getSequence: vi.fn(() => of({ id: 2, missionIds: [1, 1, 2], groupIds: [] })),
    missionTiming: vi.fn(() => of({ phases: [], bindings: [] })),
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ProgramApiService, useValue: api },
        { provide: VolunteerMissionsApiService, useValue: { list: () => of([]) } },
        { provide: VolunteerTeamsApiService, useValue: { list: () => of([]) } },
      ],
    });
  });
  const create = () => TestBed.runInInjectionContext(() => new EventMissionLinksComponent());
  it('classe les liens historiques à classer sans imposer Pendant', () => {
    const c = create();
    expect(c.phaseOf(9)).toBe(null);
    expect(c.addPhase()).toBe(null);
  });
  it('dédoublonne les missions par identifiant et conserve deux missions homonymes', () => {
    const c = create();
    c.sequence.set({ missionIds: [1, 2] } as ProgramSequenceDetail);
    c.missions.set([
      { id: 1, title: 'Accueil' },
      { id: 1, title: 'Accueil' },
      { id: 2, title: 'Accueil' },
    ] as VolunteerMission[]);
    expect(c.linked().map((m) => m.id)).toEqual([1, 2]);
  });
  it('groupe selon le lien à cet événement', () => {
    const c = create();
    c.sequence.set({ missionIds: [1, 2] } as ProgramSequenceDetail);
    c.missions.set([
      { id: 1, title: 'Avant' },
      { id: 2, title: 'Après' },
    ] as VolunteerMission[]);
    c.timing.set({
      phases: [
        { missionId: 1, phase: 'BEFORE' },
        { missionId: 2, phase: 'AFTER' },
      ],
      bindings: [],
    });
    expect(c.inPhase('BEFORE').map((m) => m.id)).toEqual([1]);
    expect(c.inPhase('DURING')).toEqual([]);
    expect(c.inPhase('AFTER').map((m) => m.id)).toEqual([2]);
  });
  it('aucun horaire ou décalage 30 présélectionné', () => {
    const c = create();
    expect(c.startAnchor()).toBe('');
    expect(c.startOffset()).toBe(null);
    expect(c.endOffset()).toBe(null);
    expect(c.draft()).toBe(null);
  });
  it('changer une sélection invalide l’aperçu', () => {
    const c = create();
    c.preview.set({ version: 'old', shifts: [], conflicts: [], previousSequenceId: null });
    c.selectShift(7);
    expect(c.preview()).toBe(null);
    expect(c.startOffset()).toBe(null);
  });
  it('erreur conserve les saisies et libère le bouton', () => {
    const c = create();
    c.newTitle.set('Mission à garder');
    c.busy.set(true);
    c.fail({ error: { message: 'Conflit' } });
    expect(c.newTitle()).toBe('Mission à garder');
    expect(c.error()).toBe('Conflit');
    expect(c.busy()).toBe(false);
  });
});
