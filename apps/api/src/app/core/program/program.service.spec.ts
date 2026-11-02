import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';
import {
  ProgramChangeLog,
  ProgramChangeLogAction,
  ProgramSequence,
  ProgramSequenceStatus,
} from '../entities';
import { ProgramRecalcService } from './program-recalc.service';
import { ProgramService } from './program.service';

const DATE = '2027-10-31';
const LOCATION = 'Grande salle';
const USER = { id: 7, email: 'coord@allegria.local', roles: ['COORDINATOR'] };

function row(id: number, startTime: string, previousSequenceId: number | null, min: number) {
  return {
    id,
    eventDate: DATE,
    location: LOCATION,
    title: `Seq ${id}`,
    startTime,
    durationMinutes: 60,
    endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, '0')}:00`,
    status: ProgramSequenceStatus.MOBILE,
    minDurationMinutes: min,
    minMarginMinutes: null,
    previousSequenceId,
    anchorSequenceId: null,
    volunteerTeamId: null,
    notes: null,
    missionIds: [],
    documentLinks: [],
    frozenByUserId: null,
    frozenAt: null,
    volunteerTeam: null,
    frozenByUser: null,
  } as unknown as ProgramSequence;
}

/** DataSource factice en mémoire : suffisant pour exercer la logique du service. */
function createFakeDataSource() {
  const state = {
    sequences: [
      row(1, '08:00', null, 20),
      row(2, '09:00', 1, 30),
      row(3, '10:00', 2, 45),
    ] as ProgramSequence[],
    logs: [] as ProgramChangeLog[],
    nextId: 100,
  };

  const manager = {
    find: async (entity: unknown, options: { where?: Record<string, unknown> } = {}) => {
      const list = (entity === ProgramSequence ? state.sequences : state.logs) as unknown as Record<
        string,
        unknown
      >[];
      const where = options.where ?? {};
      return list.filter((item) => Object.entries(where).every(([k, v]) => item[k] === v));
    },
    findOne: async (_entity: unknown, options: { where: { id: number } }) =>
      state.sequences.find((s) => s.id === options.where.id) ?? null,
    findOneOrFail: async (_entity: unknown, options: { where: { id: number } }) =>
      state.sequences.find((s) => s.id === options.where.id) as ProgramSequence,
    create: (_entity: unknown, data: object) => ({ ...data }),
    save: async (data: Record<string, unknown>) => {
      if ('action' in data) {
        const log = { ...data, id: state.nextId++, createdAt: new Date() };
        state.logs.push(log as unknown as ProgramChangeLog);
        return log;
      }
      const sequence = { ...data, id: state.nextId++ } as unknown as ProgramSequence;
      state.sequences.push(sequence);
      return sequence;
    },
    update: async (_entity: unknown, id: number, patch: object) => {
      const index = state.sequences.findIndex((s) => s.id === id);
      state.sequences[index] = { ...state.sequences[index], ...patch };
    },
    delete: async (_entity: unknown, id: number) => {
      state.sequences = state.sequences.filter((s) => s.id !== id);
    },
  };

  const dataSource = {
    manager,
    transaction: async (work: (m: typeof manager) => Promise<unknown>) => work(manager),
  } as unknown as DataSource;

  return { state, service: new ProgramService(dataSource, new ProgramRecalcService()) };
}

const INSERT = { title: 'Nouveau', durationMinutes: 20 };

describe('ProgramService', () => {
  it('getDay renvoie les séquences du jour', async () => {
    const { service } = createFakeDataSource();
    const day = await service.getDay(DATE);
    expect(day.sequences.map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it('getDay refuse une date invalide', async () => {
    const { service } = createFakeDataSource();
    await expect(service.getDay('31/10/2027')).rejects.toBeInstanceOf(BadRequestException);
  });

  it("previewInsert n'écrit rien et renvoie une version", async () => {
    const { service, state } = createFakeDataSource();
    const preview = await service.previewInsert(2, INSERT);
    expect(preview.outcome).toBe('ok');
    expect(preview.version).toBeTruthy();
    expect(state.sequences).toHaveLength(3);
    expect(state.logs).toHaveLength(0);
  });

  it('applyInsert persiste, reconnecte la suivante et journalise', async () => {
    const { service, state } = createFakeDataSource();
    const { version } = await service.previewInsert(2, INSERT);

    const result = await service.applyInsert(USER, 2, INSERT, version);

    expect(state.sequences).toHaveLength(4);
    expect(state.sequences.find((s) => s.id === 2)!.durationMinutes).toBe(50);
    expect(state.sequences.find((s) => s.id === 3)!.durationMinutes).toBe(50);
    expect(state.sequences.find((s) => s.id === 3)!.previousSequenceId).toBe(result.sequence.id);
    expect(result.sequence.previousSequenceId).toBe(2);
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0].action).toBe(ProgramChangeLogAction.INSERT);
    expect(state.logs[0].authorUserId).toBe(USER.id);
  });

  it('applyInsert refuse une version périmée (modification concurrente)', async () => {
    const { service, state } = createFakeDataSource();
    const { version } = await service.previewInsert(2, INSERT);
    state.sequences[2] = { ...state.sequences[2], durationMinutes: 55 };

    await expect(service.applyInsert(USER, 2, INSERT, version)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(state.sequences).toHaveLength(3);
  });

  it('applyInsert refuse quand aucun voisin ne peut absorber', async () => {
    const { service, state } = createFakeDataSource();
    state.sequences[1] = { ...state.sequences[1], status: ProgramSequenceStatus.FROZEN };
    state.sequences[2] = { ...state.sequences[2], status: ProgramSequenceStatus.FROZEN };
    const { version } = await service.previewInsert(2, INSERT);

    await expect(service.applyInsert(USER, 2, INSERT, version)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('applyResize (réduction) décale la suite et journalise RESIZE', async () => {
    const { service, state } = createFakeDataSource();
    const { version } = await service.previewResize(1, { durationMinutes: 40 });

    await service.applyResize(USER, 1, { durationMinutes: 40 }, version);

    expect(state.sequences.find((s) => s.id === 1)!.durationMinutes).toBe(40);
    expect(state.sequences.find((s) => s.id === 1)!.endTime).toBe('08:40');
    expect(state.sequences.find((s) => s.id === 2)!.startTime).toBe('08:40');
    expect(state.logs[0].action).toBe(ProgramChangeLogAction.RESIZE);
  });

  it('previewResize refuse de redimensionner une séquence figée', async () => {
    const { service, state } = createFakeDataSource();
    state.sequences[0] = { ...state.sequences[0], status: ProgramSequenceStatus.FROZEN };
    await expect(service.previewResize(1, { durationMinutes: 40 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuse une durée invalide', async () => {
    const { service } = createFakeDataSource();
    await expect(service.previewResize(1, { durationMinutes: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.previewInsert(2, { title: 'x', durationMinutes: 1.5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('freeze puis unfreeze tracent auteur, statut et journal', async () => {
    const { service, state } = createFakeDataSource();

    const frozen = await service.freeze(USER, 2);
    expect(frozen.status).toBe(ProgramSequenceStatus.FROZEN);
    expect(frozen.frozenByUserId).toBe(USER.id);
    expect(frozen.frozenAt).not.toBeNull();
    await expect(service.freeze(USER, 2)).rejects.toBeInstanceOf(ConflictException);

    const unfrozen = await service.unfreeze(USER, 2);
    expect(unfrozen.status).toBe(ProgramSequenceStatus.MOBILE);
    expect(unfrozen.frozenByUserId).toBeNull();
    expect(state.logs.map((l) => l.action)).toEqual([
      ProgramChangeLogAction.FREEZE,
      ProgramChangeLogAction.UNFREEZE,
    ]);
  });

  it('renvoie 404 pour une séquence inconnue', async () => {
    const { service } = createFakeDataSource();
    await expect(service.freeze(USER, 999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createSequence crée la tête d’un lieu vide et refuse un lieu déjà rempli', async () => {
    const { service, state } = createFakeDataSource();
    const created = await service.createSequence(USER, {
      eventDate: DATE,
      location: 'Salle A',
      title: 'Accueil',
      startTime: '09:30',
      durationMinutes: 45,
    });
    expect(created.endTime).toBe('10:15');
    expect(created.previousSequenceId).toBeNull();
    expect(state.logs[0].action).toBe(ProgramChangeLogAction.INSERT);

    await expect(
      service.createSequence(USER, {
        eventDate: DATE,
        location: LOCATION,
        title: 'Doublon',
        startTime: '09:00',
        durationMinutes: 10,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.createSequence(USER, {
        eventDate: DATE,
        location: 'Salle B',
        title: 'Heure KO',
        startTime: '25:00',
        durationMinutes: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createSequence rattache une branche à un repère du même jour', async () => {
    const { service } = createFakeDataSource();
    const branch = await service.createSequence(USER, {
      eventDate: DATE,
      location: 'Salle B',
      title: 'Atelier',
      startTime: '10:00',
      durationMinutes: 30,
      anchorSequenceId: 2,
    });
    expect(branch.anchorSequenceId).toBe(2);
  });

  it('updateSequence modifie liens et équipe, valide les URLs et journalise UPDATE', async () => {
    const { service, state } = createFakeDataSource();
    const updated = await service.updateSequence(USER, 2, {
      title: '  Nouveau titre ',
      volunteerTeamId: 4,
      documentLinks: [{ label: 'Run of show', url: 'https://drive.example.org/x' }],
    });
    expect(updated.title).toBe('Nouveau titre');
    expect(updated.documentLinks).toHaveLength(1);
    expect(state.sequences.find((s) => s.id === 2)!.volunteerTeamId).toBe(4);
    expect(state.logs[0].action).toBe(ProgramChangeLogAction.UPDATE);

    await expect(
      service.updateSequence(USER, 2, { documentLinks: [{ label: 'x', url: 'javascript:alert(1)' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateSequence(USER, 2, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deleteSequence reconnecte la suivante, refuse une séquence figée', async () => {
    const { service, state } = createFakeDataSource();
    await service.deleteSequence(USER, 2);
    expect(state.sequences.map((s) => s.id)).toEqual([1, 3]);
    expect(state.sequences.find((s) => s.id === 3)!.previousSequenceId).toBe(1);
    expect(state.logs[0].action).toBe(ProgramChangeLogAction.DELETE);

    await service.freeze(USER, 3);
    await expect(service.deleteSequence(USER, 3)).rejects.toBeInstanceOf(ConflictException);
  });

  it('deleteSequence avec closeGap avance la queue de chaîne, refuse si une séquence figée suit', async () => {
    const { service, state } = createFakeDataSource();
    const result = await service.deleteSequence(USER, 2, { closeGap: true });
    expect(result.shiftedMinutes).toBe(60);
    const moved = state.sequences.find((s) => s.id === 3)!;
    expect(moved.startTime).toBe('09:00');
    expect(moved.endTime).toBe('10:00');

    const other = createFakeDataSource();
    await other.service.freeze(USER, 3);
    await expect(other.service.deleteSequence(USER, 2, { closeGap: true })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(other.state.sequences).toHaveLength(3);
  });

  it('getChangeLog filtre par date', async () => {
    const { service } = createFakeDataSource();
    await service.freeze(USER, 2);
    expect(await service.getChangeLog({ date: DATE })).toHaveLength(1);
    expect(await service.getChangeLog({ date: '2027-11-01' })).toHaveLength(0);
  });
  it('refuse preview/apply sous le minimum sans écriture ni journal', async () => {
    const { service, state } = createFakeDataSource();
    const { version } = await service.previewResize(1, { durationMinutes: 20 });
    await expect(service.previewResize(1, { durationMinutes: 5 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.applyResize(USER, 1, { durationMinutes: 5 }, version)).rejects.toBeInstanceOf(BadRequestException);
    expect(state.sequences[0].durationMinutes).toBe(60);
    expect(state.logs).toHaveLength(0);
    await service.applyResize(USER, 1, { durationMinutes: 20 }, version);
    expect(state.sequences[0].durationMinutes).toBe(20);
  });

});
