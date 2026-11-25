import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';
import {
  ProgramChangeLog,
  ProgramPublicExport,
  ProgramSequence,
  ProgramSequenceStatus,
  ProgramSequenceVisibility,
} from '../entities';
import { ProgramRecalcService } from './program-recalc.service';
import { ProgramService } from './program.service';

const DATE = '2027-10-31';
const USER = { id: 7, email: 'coord@allegria.local', roles: ['COORDINATOR'] };

function row(id: number, title: string, visibility: ProgramSequenceVisibility): ProgramSequence {
  return {
    id,
    eventDate: DATE,
    location: 'Grande salle',
    title,
    startTime: '0' + id + ':00',
    durationMinutes: 60,
    endTime: '0' + (id + 1) + ':00',
    status: ProgramSequenceStatus.MOBILE,
    visibility,
    minDurationMinutes: null,
    minMarginMinutes: null,
    previousSequenceId: null,
    anchorSequenceId: null,
    volunteerTeamId: null,
    missionIds: [],
    documentLinks: [],
    notes: 'consignes internes',
    frozenByUserId: null,
    frozenAt: null,
  } as unknown as ProgramSequence;
}

function createFakeDataSource(sequences: ProgramSequence[]) {
  const state = {
    sequences,
    exports: new Map<string, ProgramPublicExport>(),
    logs: [] as Record<string, unknown>[],
  };

  const exportsRepo = {
    find: async () =>
      [...state.exports.values()].sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    findOne: async (options: { where: { eventDate: string } }) =>
      state.exports.get(options.where.eventDate) ?? null,
    create: (data: object) => data as ProgramPublicExport,
    save: async (data: ProgramPublicExport) => {
      state.exports.set(data.eventDate, data);
      return data;
    },
    createQueryBuilder: () => ({
      delete: () => ({
        where: (_clause: string, params: { dates: string[] }) => ({
          execute: async () => {
            for (const key of [...state.exports.keys()]) {
              if (!params.dates.includes(key)) state.exports.delete(key);
            }
          },
        }),
      }),
    }),
  };

  const manager = {
    find: async (entity: unknown, options: { where?: Record<string, unknown> } = {}) => {
      if (entity === ProgramPublicExport) return exportsRepo.find();
      const where = options.where ?? {};
      return state.sequences.filter((item) =>
        Object.entries(where).every(
          ([k, v]) => (item as unknown as Record<string, unknown>)[k] === v,
        ),
      );
    },
    findOne: async (entity: unknown, options: { where: Record<string, unknown> }) => {
      if (entity === ProgramPublicExport) {
        return state.exports.get(options.where.eventDate as string) ?? null;
      }
      return state.sequences.find((s) => s.id === (options.where as { id: number }).id) ?? null;
    },
    findOneOrFail: async (_entity: unknown, options: { where: { id: number } }) =>
      state.sequences.find((s) => s.id === options.where.id) as ProgramSequence,
    create: (_entity: unknown, data: object) => ({ ...data }),
    save: async (data: Record<string, unknown>) => {
      if ('action' in data) {
        state.logs.push(data);
        return data;
      }
      const sequence = { ...data, id: 100 } as unknown as ProgramSequence;
      state.sequences.push(sequence);
      return sequence;
    },
    update: async (_entity: unknown, id: number, patch: object) => {
      const index = state.sequences.findIndex((s) => s.id === id);
      state.sequences[index] = { ...state.sequences[index], ...patch };
    },
    getRepository: (entity: unknown) => {
      if (entity === ProgramPublicExport) return exportsRepo;
      throw new Error('unexpected repo');
    },
  };

  const dataSource = {
    manager,
    transaction: async (work: (m: typeof manager) => Promise<unknown>) => work(manager),
  } as unknown as DataSource;

  return { state, service: new ProgramService(dataSource, new ProgramRecalcService()) };
}

describe('ProgramService — visibilité public / réservé', () => {
  it('crée un créneau interne par défaut', async () => {
    const { service } = createFakeDataSource([]);
    const created = await service.createSequence(USER, {
      eventDate: DATE,
      location: 'Grande salle',
      title: 'Veillée',
      startTime: '21:00',
      durationMinutes: 60,
    });
    expect(created.visibility).toBe(ProgramSequenceVisibility.INTERNAL);
  });

  it('refuse une visibilité invalide à la mise à jour', async () => {
    const { service } = createFakeDataSource([
      row(1, 'Veillée', ProgramSequenceVisibility.INTERNAL),
    ]);
    await expect(
      service.updateSequence(USER, 1, { visibility: 'PRIVATE' as never }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publie puis dépublie un créneau', async () => {
    const { service } = createFakeDataSource([
      row(1, 'Veillée', ProgramSequenceVisibility.INTERNAL),
    ]);
    const updated = await service.updateSequence(USER, 1, {
      visibility: ProgramSequenceVisibility.PUBLIC,
    });
    expect(updated.visibility).toBe(ProgramSequenceVisibility.PUBLIC);
    const back = await service.updateSequence(USER, 1, {
      visibility: ProgramSequenceVisibility.INTERNAL,
    });
    expect(back.visibility).toBe(ProgramSequenceVisibility.INTERNAL);
  });

  it('l’export public ne retient que les créneaux publics, réduits aux grands temps', async () => {
    const { state, service } = createFakeDataSource([
      row(1, 'Plénière', ProgramSequenceVisibility.PUBLIC),
      row(2, 'Temps de chant', ProgramSequenceVisibility.INTERNAL),
    ]);
    const result = await service.regeneratePublicExports(USER);
    expect(result.dates).toEqual([DATE]);
    const exported = state.exports.get(DATE);
    expect(exported?.sequences).toEqual([
      { title: 'Plénière', startTime: '01:00', endTime: '02:00', location: 'Grande salle' },
    ]);
  });

  it('l’instantané public ne suit pas les modifications en temps réel', async () => {
    const { state, service } = createFakeDataSource([
      row(1, 'Plénière', ProgramSequenceVisibility.PUBLIC),
    ]);
    await service.regeneratePublicExports(USER);
    state.sequences[0] = { ...state.sequences[0], title: 'Plénière modifiée' };
    const snapshot = await service.getPublicProgramDay(DATE);
    expect(snapshot.sequences[0].title).toBe('Plénière');
    expect(snapshot.updatedAt).not.toBeNull();
    await service.regeneratePublicExports(USER);
    const refreshed = await service.getPublicProgramDay(DATE);
    expect(refreshed.sequences[0].title).toBe('Plénière modifiée');
  });

  it('un jour jamais publié renvoie une liste vide', async () => {
    const { service } = createFakeDataSource([]);
    const snapshot = await service.getPublicProgramDay(DATE);
    expect(snapshot.sequences).toEqual([]);
    expect(snapshot.updatedAt).toBeNull();
  });

  it('l’export vide les jours qui n’ont plus de créneau public', async () => {
    const { state, service } = createFakeDataSource([
      row(1, 'Plénière', ProgramSequenceVisibility.PUBLIC),
    ]);
    await service.regeneratePublicExports(USER);
    state.sequences[0] = { ...state.sequences[0], visibility: ProgramSequenceVisibility.INTERNAL };
    await service.regeneratePublicExports(USER);
    expect(state.exports.size).toBe(0);
  });
});
