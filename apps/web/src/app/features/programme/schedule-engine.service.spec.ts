import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProgramSequence, ProgramSequenceStatus } from '../../models/models';
import { ScheduleEngineService } from './schedule-engine.service';

const EVENT_DATE = '2027-10-31';
const LOCATION = 'Grand Chapiteau';

function seq(partial: Partial<ProgramSequence> & Pick<ProgramSequence, 'id' | 'title' | 'startTime' | 'durationMinutes'>): ProgramSequence {
  return {
    eventDate: EVENT_DATE,
    location: LOCATION,
    endTime: '00:00',
    status: ProgramSequenceStatus.MOBILE,
    minDurationMinutes: null,
    minMarginMinutes: null,
    previousSequenceId: null,
    anchorSequenceId: null,
    volunteerTeamId: null,
    volunteerTeamName: null,
    missionIds: [],
    documentLinks: [],
    notes: null,
    frozenByUserId: null,
    frozenByUserName: null,
    frozenAt: null,
    ...partial,
  };
}

function buildSampleChain(): ProgramSequence[] {
  // a -> b -> c -> d, chacune de 60 min à partir de 08:00
  const a = seq({ id: 'a', title: 'Accueil', startTime: '08:00', durationMinutes: 60, minDurationMinutes: 20 });
  const b = seq({
    id: 'b',
    title: 'Temps fort',
    startTime: '09:00',
    durationMinutes: 60,
    minDurationMinutes: 30,
    previousSequenceId: 'a',
  });
  const c = seq({
    id: 'c',
    title: 'Repas',
    startTime: '10:00',
    durationMinutes: 60,
    minDurationMinutes: 45,
    previousSequenceId: 'b',
  });
  const d = seq({
    id: 'd',
    title: 'Clôture',
    startTime: '11:00',
    durationMinutes: 60,
    minDurationMinutes: 20,
    previousSequenceId: 'c',
  });
  return [a, b, c, d];
}

describe('ScheduleEngineService', () => {
  let service: ScheduleEngineService;

  function setup() {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScheduleEngineService);
  }

  it('buildChain reconstruit la chaîne ordonnée depuis les pointeurs previousSequenceId', () => {
    setup();
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    expect(chain.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it("previewInsert répartit l'impact 50/50 sur les deux voisins quand c'est possible", () => {
    setup();
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewInsert(chain, 'b', {
      eventDate: EVENT_DATE,
      location: LOCATION,
      title: 'Nouveau créneau',
      durationMinutes: 20,
      volunteerTeamId: null,
      notes: null,
    });

    expect(preview.outcome).toBe('ok');
    expect(preview.affected).toHaveLength(2);
    const bDiff = preview.affected.find((d) => d.sequenceId === 'b')!;
    const cDiff = preview.affected.find((d) => d.sequenceId === 'c')!;
    expect(bDiff.after.durationMinutes).toBe(50);
    expect(cDiff.after.durationMinutes).toBe(50);
    expect(preview.newSequence.durationMinutes).toBe(20);
    expect(preview.newSequence.startTime).toBe(bDiff.after.endTime);
  });

  it('previewInsert reporte sur le seul voisin disponible si un voisin est figé', () => {
    setup();
    const chainData = buildSampleChain();
    chainData[2] = { ...chainData[2], status: ProgramSequenceStatus.FROZEN }; // c figé
    const chain = service.buildChain(chainData, EVENT_DATE, LOCATION);

    const preview = service.previewInsert(chain, 'b', {
      eventDate: EVENT_DATE,
      location: LOCATION,
      title: 'Nouveau créneau',
      durationMinutes: 20,
      volunteerTeamId: null,
      notes: null,
    });

    expect(preview.outcome).toBe('ok');
    expect(preview.affected).toHaveLength(1);
    expect(preview.affected[0].sequenceId).toBe('b');
    expect(preview.affected[0].after.durationMinutes).toBe(40);
  });

  it('previewInsert renvoie impossible si aucun voisin ne peut absorber', () => {
    setup();
    const chainData = buildSampleChain();
    chainData[1] = { ...chainData[1], status: ProgramSequenceStatus.FROZEN }; // b figé
    chainData[2] = { ...chainData[2], status: ProgramSequenceStatus.FROZEN }; // c figé
    const chain = service.buildChain(chainData, EVENT_DATE, LOCATION);

    const preview = service.previewInsert(chain, 'b', {
      eventDate: EVENT_DATE,
      location: LOCATION,
      title: 'Nouveau créneau',
      durationMinutes: 20,
      volunteerTeamId: null,
      notes: null,
    });

    expect(preview.outcome).toBe('impossible');
    expect(preview.affected).toHaveLength(0);
  });

  it('previewResize (agrandissement) absorbe le delta sur les créneaux flexibles suivants', () => {
    setup();
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewResize(chain, 'a', 80); // +20 min

    expect(preview.outcome).toBe('ok');
    expect(preview.affected).toHaveLength(1);
    expect(preview.affected[0].sequenceId).toBe('b');
    expect(preview.affected[0].after.durationMinutes).toBe(40);
    expect(preview.affected[0].after.startTime).toBe('09:20');
  });

  it('previewResize (agrandissement) s’arrête au premier créneau figé et le signale', () => {
    setup();
    const chainData = buildSampleChain();
    chainData[1] = { ...chainData[1], status: ProgramSequenceStatus.FROZEN }; // b figé
    const chain = service.buildChain(chainData, EVENT_DATE, LOCATION);

    const preview = service.previewResize(chain, 'a', 80);

    expect(preview.stoppedAtFrozenId).toBe('b');
    expect(preview.outcome).toBe('impossible');
    expect(preview.affected).toHaveLength(0);
  });

  it('previewResize (réduction) avance la suite flexible et laisse une marge libre en fin de programme', () => {
    setup();
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewResize(chain, 'a', 40); // -20 min

    expect(preview.outcome).toBe('ok');
    expect(preview.marginMinutes).toBe(20);
    expect(preview.affected).toHaveLength(3);
    expect(preview.affected.find((d) => d.sequenceId === 'b')!.after.startTime).toBe('08:40');
    expect(preview.affected.find((d) => d.sequenceId === 'd')!.after.startTime).toBe('10:40');
  });

  it('previewResize (réduction) s’arrête au premier créneau figé sans toucher la suite', () => {
    setup();
    const chainData = buildSampleChain();
    chainData[2] = { ...chainData[2], status: ProgramSequenceStatus.FROZEN }; // c figé
    const chain = service.buildChain(chainData, EVENT_DATE, LOCATION);

    const preview = service.previewResize(chain, 'a', 40);

    expect(preview.stoppedAtFrozenId).toBe('c');
    expect(preview.marginMinutes).toBeNull();
    expect(preview.affected).toHaveLength(1);
    expect(preview.affected[0].sequenceId).toBe('b');
  });

  it('applyInsert matérialise la nouvelle chaîne avec la séquence insérée reliée', () => {
    setup();
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewInsert(chain, 'b', {
      eventDate: EVENT_DATE,
      location: LOCATION,
      title: 'Nouveau créneau',
      durationMinutes: 20,
      volunteerTeamId: null,
      notes: null,
    });

    const updatedChain = service.applyInsert(chain, preview);
    expect(updatedChain.map((s) => s.id)).toEqual(['a', 'b', preview.newSequence.id, 'c', 'd']);
    const newIndex = updatedChain.findIndex((s) => s.id === preview.newSequence.id);
    expect(updatedChain[newIndex + 1].previousSequenceId).toBe(preview.newSequence.id);
  });

  it('applyResize matérialise les nouvelles durées/heures dans la chaîne', () => {
    setup();
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewResize(chain, 'a', 40);
    const updatedChain = service.applyResize(chain, preview);

    expect(updatedChain.find((s) => s.id === 'a')!.durationMinutes).toBe(40);
    expect(updatedChain.find((s) => s.id === 'b')!.startTime).toBe('08:40');
  });

  it('freeze/unfreeze basculent le statut et les métadonnées de traçabilité', () => {
    setup();
    const [a] = buildSampleChain();
    const frozen = service.freeze(a, 42, 'Coordination');
    expect(frozen.status).toBe(ProgramSequenceStatus.FROZEN);
    expect(frozen.frozenByUserId).toBe(42);
    expect(frozen.frozenAt).not.toBeNull();

    const unfrozen = service.unfreeze(frozen);
    expect(unfrozen.status).toBe(ProgramSequenceStatus.MOBILE);
    expect(unfrozen.frozenByUserId).toBeNull();
  });
});
