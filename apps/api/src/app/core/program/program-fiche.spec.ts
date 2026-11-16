import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';
import {
  EventPreparationTask,
  Group,
  ProgramSequence,
  ProgramSequenceGroup,
  ProgramSequenceStatus,
  ProgramSequenceTrack,
  ProgramSequenceVisibility,
} from '../entities';
import { ProgramRecalcService } from './program-recalc.service';
import { ProgramService } from './program.service';

const DATE = '2027-10-31';
const USER = { id: 7, email: 'coord@allegria.local', roles: ['COORDINATOR'] };

function seq(id: number, overrides: Partial<ProgramSequence> = {}): ProgramSequence {
  return {
    id,
    eventDate: DATE,
    location: 'Grande salle',
    title: `Créneau ${id}`,
    startTime: '13:30',
    durationMinutes: 120,
    endTime: '15:30',
    status: ProgramSequenceStatus.MOBILE,
    track: ProgramSequenceTrack.TA,
    visibility: ProgramSequenceVisibility.PUBLIC,
    minDurationMinutes: null,
    minMarginMinutes: null,
    previousSequenceId: id > 1 ? id - 1 : null,
    anchorSequenceId: null,
    volunteerTeamId: 3,
    missionIds: [42],
    documentLinks: [{ label: 'Run of show', url: 'https://example.org/ros' }],
    notes: 'notes',
    frozenByUserId: 9,
    frozenAt: new Date('2027-10-01T10:00:00Z'),
    volunteerTeam: { id: 3, name: 'Animation' },
    frozenByUser: { id: 9, email: 'admin@allegria.local' },
    ...overrides,
  } as unknown as ProgramSequence;
}

function taskRow(id: number, sequenceId: number, overrides: Partial<EventPreparationTask> = {}) {
  return {
    id,
    sequenceId,
    title: `Tâche ${id}`,
    dueOffsetMinutes: 180,
    dueDate: null,
    responsible: null,
    isDone: false,
    doneAt: null,
    createdAt: new Date('2027-10-01T08:00:00Z'),
    updatedAt: new Date('2027-10-01T08:00:00Z'),
    ...overrides,
  } as EventPreparationTask;
}

/** Fake en mémoire couvrant séquences, groupes, liens et tâches. */
function createFake() {
  const state = {
    sequences: [seq(1), seq(2, { status: ProgramSequenceStatus.MOBILE, frozenByUserId: null, frozenAt: null })],
    groups: [{ id: 11, name: 'Rassemblement Lyon 1' }, { id: 12, name: 'Rassemblement Grenoble 1' }] as Group[],
    links: [] as ProgramSequenceGroup[],
    tasks: [] as EventPreparationTask[],
    logs: [] as Record<string, unknown>[],
    nextId: 100,
  };

  const match = (list: Record<string, unknown>[], where: Record<string, unknown> = {}) =>
    list.filter((item) =>
      Object.entries(where).every(([k, v]) => {
        if (v && typeof v === 'object' && (v as { _type?: string })._type === 'in') {
          return ((v as unknown as { _value: unknown[] })._value as unknown[]).includes(item[k]);
        }
        return item[k] === v;
      }),
    );

  const manager = {
    find: async (entity: unknown, options: { where?: Record<string, unknown> } = {}) => {
      if (entity === ProgramSequence) return match(state.sequences as never[], options.where);
      if (entity === ProgramSequenceGroup) return match(state.links as never[], options.where);
      if (entity === EventPreparationTask) return match(state.tasks as never[], options.where);
      if (entity === Group) return match(state.groups as never[], options.where);
      return [];
    },
    findOne: async (entity: unknown, options: { where: Record<string, unknown> }) => {
      if (entity === ProgramSequence) {
        return state.sequences.find((s) => s.id === options.where['id']) ?? null;
      }
      if (entity === EventPreparationTask) {
        return (
          state.tasks.find(
            (t) => t.id === options.where['id'] && t.sequenceId === options.where['sequenceId'],
          ) ?? null
        );
      }
      return null;
    },
    findOneOrFail: async (_entity: unknown, options: { where: { id: number } }) =>
      state.sequences.find((s) => s.id === options.where.id) as ProgramSequence,
    create: (_entity: unknown, data: object) => ({ ...data }),
    save: async (data: Record<string, unknown> | Record<string, unknown>[]) => {
      if (Array.isArray(data)) {
        return Promise.all(data.map((item) => manager.save(item)));
      }
      if ('action' in data) {
        const log = { ...data, id: state.nextId++, createdAt: new Date() };
        state.logs.push(log);
        return log;
      }
      if ('groupId' in data && 'sequenceId' in data) {
        const link = { ...data } as ProgramSequenceGroup;
        state.links.push(link);
        return link;
      }
      if ('dueOffsetMinutes' in data || 'dueDate' in data || 'isDone' in data) {
        const existing = state.tasks.findIndex((t) => t.id === (data as { id?: number }).id);
        if (existing >= 0) {
          state.tasks[existing] = { ...state.tasks[existing], ...data } as EventPreparationTask;
          return state.tasks[existing];
        }
        const task = {
          ...data,
          id: state.nextId++,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as EventPreparationTask;
        state.tasks.push(task);
        return task;
      }
      const sequence = { ...data, id: state.nextId++ } as unknown as ProgramSequence;
      state.sequences.push(sequence);
      return sequence;
    },
    delete: async (_entity: unknown, criteria: Record<string, unknown>) => {
      state.links = state.links.filter((l) => l.sequenceId !== criteria['sequenceId']);
    },
    remove: async (task: EventPreparationTask) => {
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
    },
  };

  const dataSource = {
    manager,
    transaction: async (work: (m: typeof manager) => Promise<unknown>) => work(manager),
  } as unknown as DataSource;

  return { state, service: new ProgramService(dataSource, new ProgramRecalcService()) };
}

describe('Fiche événement — détail et groupes', () => {
  it('getSequenceDetail renvoie la séquence et ses groupes liés', async () => {
    const { service, state } = createFake();
    state.links.push({ sequenceId: 1, groupId: 11 } as ProgramSequenceGroup);
    state.links.push({ sequenceId: 1, groupId: 12 } as ProgramSequenceGroup);
    state.links.push({ sequenceId: 2, groupId: 12 } as ProgramSequenceGroup);
    const detail = await service.getSequenceDetail(1);
    expect(detail.title).toBe('Créneau 1');
    expect(detail.groupIds).toEqual([11, 12]);
    expect(detail.volunteerTeamName).toBe('Animation');
  });

  it('getSequenceDetail signale une séquence inconnue', async () => {
    const { service } = createFake();
    await expect(service.getSequenceDetail(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('setSequenceGroups remplace la liste, dédoublonne et journalise', async () => {
    const { service, state } = createFake();
    state.links.push({ sequenceId: 1, groupId: 11 } as ProgramSequenceGroup);
    const detail = await service.setSequenceGroups(USER, 1, { groupIds: [12, 12] });
    expect(detail.groupIds).toEqual([12]);
    expect(state.links.filter((l) => l.sequenceId === 1)).toHaveLength(1);
    expect(state.logs.at(-1)?.['action']).toBe('UPDATE');
  });

  it('setSequenceGroups refuse un groupe inexistant et des identifiants invalides', async () => {
    const { service } = createFake();
    await expect(service.setSequenceGroups(USER, 1, { groupIds: [99] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.setSequenceGroups(USER, 1, { groupIds: [1.5] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Fiche événement — duplication', () => {
  it('duplicateSequence copie hors chaîne, défigée, avec groupes et tâches remises à faire', async () => {
    const { service, state } = createFake();
    state.links.push({ sequenceId: 1, groupId: 11 } as ProgramSequenceGroup);
    state.tasks.push(taskRow(1, 1, { isDone: true, doneAt: new Date() }));
    const copy = await service.duplicateSequence(USER, 1);
    expect(copy.title).toBe('Créneau 1 (copie)');
    expect(copy.previousSequenceId).toBeNull();
    expect(copy.anchorSequenceId).toBeNull();
    expect(copy.frozenByUserId).toBeNull();
    expect(copy.missionIds).toEqual([42]);
    expect(copy.groupIds).toEqual([11]);
    const copiedTasks = state.tasks.filter((t) => t.sequenceId === copy.id);
    expect(copiedTasks).toHaveLength(1);
    expect(copiedTasks[0].isDone).toBe(false);
    expect(copiedTasks[0].doneAt).toBeNull();
    expect(state.logs.at(-1)?.['action']).toBe('INSERT');
    // L'original n'est pas modifié
    expect(state.sequences.find((s) => s.id === 1)?.title).toBe('Créneau 1');
  });
});

describe('Fiche événement — tâches de préparation', () => {
  it('createTask exige exactement une échéance', async () => {
    const { service } = createFake();
    await expect(service.createTask(USER, 1, { title: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.createTask(USER, 1, { title: 'X', dueOffsetMinutes: 30, dueDate: '2027-10-30' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createTask enregistre une échéance relative et journalise', async () => {
    const { service, state } = createFake();
    const task = await service.createTask(USER, 1, {
      title: '  Imprimer les feuilles de route  ',
      dueOffsetMinutes: 180,
      responsible: '  M. Vial ',
    });
    expect(task.title).toBe('Imprimer les feuilles de route');
    expect(task.dueOffsetMinutes).toBe(180);
    expect(task.dueDate).toBeNull();
    expect(task.responsible).toBe('M. Vial');
    expect(task.isDone).toBe(false);
    expect(state.logs.at(-1)?.['action']).toBe('UPDATE');
  });

  it('createTask accepte une date fixe', async () => {
    const { service } = createFake();
    const task = await service.createTask(USER, 1, { title: 'Météo', dueDate: '2027-10-30' });
    expect(task.dueDate).toBe('2027-10-30');
    expect(task.dueOffsetMinutes).toBeNull();
    await expect(
      service.createTask(USER, 1, { title: 'Météo', dueDate: '30/10/2027' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateTask bascule fait/à faire avec horodatage et change de type d’échéance', async () => {
    const { service, state } = createFake();
    state.tasks.push(taskRow(5, 1));
    const done = await service.updateTask(USER, 1, 5, { isDone: true });
    expect(done.isDone).toBe(true);
    expect(done.doneAt).toBeTruthy();
    const reopened = await service.updateTask(USER, 1, 5, { isDone: false });
    expect(reopened.isDone).toBe(false);
    expect(reopened.doneAt).toBeNull();
    const fixed = await service.updateTask(USER, 1, 5, { dueDate: '2027-10-29', dueOffsetMinutes: null });
    expect(fixed.dueDate).toBe('2027-10-29');
    expect(fixed.dueOffsetMinutes).toBeNull();
  });

  it('updateTask et deleteTask refusent une tâche d’un autre créneau', async () => {
    const { service, state } = createFake();
    state.tasks.push(taskRow(5, 2));
    await expect(service.updateTask(USER, 1, 5, { title: 'Y' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.deleteTask(USER, 1, 5)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deleteTask supprime et journalise', async () => {
    const { service, state } = createFake();
    state.tasks.push(taskRow(5, 1));
    const result = await service.deleteTask(USER, 1, 5);
    expect(result.deletedId).toBe(5);
    expect(state.tasks).toHaveLength(0);
    expect(state.logs.at(-1)?.['action']).toBe('UPDATE');
  });

  it('listTasks renvoie les tâches du créneau seulement', async () => {
    const { service, state } = createFake();
    state.tasks.push(taskRow(5, 1), taskRow(6, 2), taskRow(7, 1));
    const tasks = await service.listTasks(1);
    expect(tasks.map((t) => t.id)).toEqual([5, 7]);
    await expect(service.listTasks(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Fiche événement — journal filtré', () => {
  it('getChangeLog refuse un sequenceId invalide', async () => {
    const { service } = createFake();
    await expect(service.getChangeLog({ sequenceId: Number('abc') })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
