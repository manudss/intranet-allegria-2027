import { describe, expect, it } from 'vitest';
import { ProgramSequenceStatus } from '../entities';
import { ProgramRecalcService } from './program-recalc.service';
import { ProgramSequenceData } from './program-recalc.types';

const EVENT_DATE = '2027-10-31';
const LOCATION = 'Grande salle';

const DRAFT = {
  eventDate: EVENT_DATE,
  location: LOCATION,
  title: 'Nouveau créneau',
  durationMinutes: 20,
  volunteerTeamId: null,
  notes: null,
};

function seq(
  partial: Partial<ProgramSequenceData> &
    Pick<ProgramSequenceData, 'id' | 'title' | 'startTime' | 'durationMinutes'>,
): ProgramSequenceData {
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
    notes: null,
    ...partial,
  };
}

/** a -> b -> c -> d, chacune de 60 min à partir de 08:00 (ids 1..4). */
function buildSampleChain(): ProgramSequenceData[] {
  return [
    seq({
      id: 1,
      title: 'Accueil',
      startTime: '08:00',
      durationMinutes: 60,
      minDurationMinutes: 20,
    }),
    seq({
      id: 2,
      title: 'Temps fort',
      startTime: '09:00',
      durationMinutes: 60,
      minDurationMinutes: 30,
      previousSequenceId: 1,
    }),
    seq({
      id: 3,
      title: 'Repas',
      startTime: '10:00',
      durationMinutes: 60,
      minDurationMinutes: 45,
      previousSequenceId: 2,
    }),
    seq({
      id: 4,
      title: 'Clôture',
      startTime: '11:00',
      durationMinutes: 60,
      minDurationMinutes: 20,
      previousSequenceId: 3,
    }),
  ];
}

describe('ProgramRecalcService', () => {
  const service = new ProgramRecalcService();

  it('buildChain reconstruit la chaîne ordonnée depuis les pointeurs previousSequenceId', () => {
    const shuffled = buildSampleChain().reverse();
    const chain = service.buildChain(shuffled, EVENT_DATE, LOCATION);
    expect(chain.map((s) => s.id)).toEqual([1, 2, 3, 4]);
  });

  it("previewInsert répartit l'impact 50/50 sur les deux voisins quand c'est possible", () => {
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewInsert(chain, 2, DRAFT);

    expect(preview.outcome).toBe('ok');
    expect(preview.affected).toHaveLength(2);
    const bDiff = preview.affected.find((d) => d.sequenceId === 2)!;
    const cDiff = preview.affected.find((d) => d.sequenceId === 3)!;
    expect(bDiff.after.durationMinutes).toBe(50);
    expect(cDiff.after.durationMinutes).toBe(50);
    expect(preview.newSequence.durationMinutes).toBe(20);
    expect(preview.newSequence.startTime).toBe(bDiff.after.endTime);
    expect(preview.newSequence.previousSequenceId).toBe(2);
  });

  it('previewInsert reporte sur le seul voisin disponible si un voisin est figé', () => {
    const data = buildSampleChain();
    data[2] = { ...data[2], status: ProgramSequenceStatus.FROZEN };
    const chain = service.buildChain(data, EVENT_DATE, LOCATION);

    const preview = service.previewInsert(chain, 2, DRAFT);

    expect(preview.outcome).toBe('ok');
    expect(preview.affected).toHaveLength(1);
    expect(preview.affected[0].sequenceId).toBe(2);
    expect(preview.affected[0].after.durationMinutes).toBe(40);
  });

  it('previewInsert renvoie impossible si aucun voisin ne peut absorber', () => {
    const data = buildSampleChain();
    data[1] = { ...data[1], status: ProgramSequenceStatus.FROZEN };
    data[2] = { ...data[2], status: ProgramSequenceStatus.FROZEN };
    const chain = service.buildChain(data, EVENT_DATE, LOCATION);

    const preview = service.previewInsert(chain, 2, DRAFT);

    expect(preview.outcome).toBe('impossible');
    expect(preview.affected).toHaveLength(0);
  });

  it('previewResize (agrandissement) absorbe le delta sur les créneaux flexibles suivants', () => {
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewResize(chain, 1, 80);

    expect(preview.outcome).toBe('ok');
    expect(preview.affected).toHaveLength(1);
    expect(preview.affected[0].sequenceId).toBe(2);
    expect(preview.affected[0].after.durationMinutes).toBe(40);
    expect(preview.affected[0].after.startTime).toBe('09:20');
  });

  it("previewResize (agrandissement) s'arrête au premier créneau figé et le signale", () => {
    const data = buildSampleChain();
    data[1] = { ...data[1], status: ProgramSequenceStatus.FROZEN };
    const chain = service.buildChain(data, EVENT_DATE, LOCATION);

    const preview = service.previewResize(chain, 1, 80);

    expect(preview.stoppedAtFrozenId).toBe(2);
    expect(preview.outcome).toBe('impossible');
    expect(preview.affected).toHaveLength(0);
  });

  it('previewResize (réduction) avance la suite flexible et laisse une marge libre en fin de programme', () => {
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewResize(chain, 1, 40);

    expect(preview.outcome).toBe('ok');
    expect(preview.marginMinutes).toBe(20);
    expect(preview.affected).toHaveLength(3);
    expect(preview.affected.find((d) => d.sequenceId === 2)!.after.startTime).toBe('08:40');
    expect(preview.affected.find((d) => d.sequenceId === 4)!.after.startTime).toBe('10:40');
  });

  it("previewResize (réduction) s'arrête au premier créneau figé sans toucher la suite", () => {
    const data = buildSampleChain();
    data[2] = { ...data[2], status: ProgramSequenceStatus.FROZEN };
    const chain = service.buildChain(data, EVENT_DATE, LOCATION);

    const preview = service.previewResize(chain, 1, 40);

    expect(preview.stoppedAtFrozenId).toBe(3);
    expect(preview.marginMinutes).toBeNull();
    expect(preview.affected).toHaveLength(1);
    expect(preview.affected[0].sequenceId).toBe(2);
  });

  it('applyInsert matérialise les nouvelles durées et expose la séquence à reconnecter', () => {
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewInsert(chain, 2, DRAFT);

    const { updated, followingSequenceId } = service.applyInsert(chain, preview);

    expect(updated.find((s) => s.id === 2)!.durationMinutes).toBe(50);
    expect(updated.find((s) => s.id === 3)!.durationMinutes).toBe(50);
    expect(followingSequenceId).toBe(3);
  });

  it('applyResize matérialise les nouvelles durées/heures dans la chaîne', () => {
    const chain = service.buildChain(buildSampleChain(), EVENT_DATE, LOCATION);
    const preview = service.previewResize(chain, 1, 40);
    const updated = service.applyResize(chain, preview);

    expect(updated.find((s) => s.id === 1)!.durationMinutes).toBe(40);
    expect(updated.find((s) => s.id === 2)!.startTime).toBe('08:40');
  });
});
