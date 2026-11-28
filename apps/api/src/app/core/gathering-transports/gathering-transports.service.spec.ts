import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AccommodationType,
  AssignmentStatus,
  GatheringCarPersonKind,
  GatheringCarTarget,
} from '../entities';
import { GatheringTransportsService } from './gathering-transports.service';

type Row = Record<string, any>;

const family = (id: number, name: string, groupId: number | null, type = AccommodationType.FAMILY) => ({
  id,
  familyName: name,
  city: 'Ville',
  accommodationType: type,
  hostingGroup: groupId ? { id: groupId } : null,
});

const housed = (id: number, familyId: number, groupId: number | null, status = AssignmentStatus.CONFIRMED) => ({
  id,
  status,
  participant: { id: 1000 + id },
  hostFamily: { id: familyId, hostingGroup: groupId ? { id: groupId } : null },
});

const makeState = () => {
  const groups = [
    { id: 1, name: 'Zone Nord', kind: 'ZONE', hostFamilies: [] as Row[] },
    { id: 2, name: 'Paroisse Sud', kind: 'PARISH', hostFamilies: [] as Row[] },
    { id: 3, name: 'Groupe vide', kind: 'OTHER', hostFamilies: [] as Row[] },
  ];
  const families = [
    family(10, 'Famille A', 1),
    family(11, 'Famille B', 1),
    family(12, 'Famille C', 2),
    family(13, 'Internat Exemple', null, AccommodationType.COLLECTIVE),
    family(14, 'Collectif du groupe', 2, AccommodationType.COLLECTIVE),
  ];
  const housedRows = [
    housed(1, 10, 1),
    housed(2, 10, 1),
    housed(3, 11, 1),
    housed(4, 12, 2),
    housed(5, 14, 2),
    housed(6, 13, null),
    housed(7, 13, null),
    housed(8, 13, null, AssignmentStatus.CANCELLED),
  ];
  const cars: Row[] = [
    {
      id: 100,
      name: 'Car A',
      capacity: 63,
      serviceDates: ['2027-10-31'],
      notes: null,
      stops: [
        { id: 1, orderIndex: 1, label: 'Lieu du rassemblement', time: '08:15' },
        { id: 2, orderIndex: 0, label: 'Zone Nord', time: '07:30' },
      ],
      assignments: [],
      persons: [],
    },
  ];
  return { groups, families, housedRows, cars };
};

const matchWhere = (rows: Row[], where: any): Row[] => {
  if (!where) return rows;
  return rows.filter((r) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        if ('id' in (value as Row)) return (r[key] as Row)?.id === (value as Row).id;
        return false;
      }
      return r[key] === value;
    }),
  );
};

const repo = (rows: Row[]) => ({
  find: vi.fn(async (options?: { where?: any }) => matchWhere(rows, options?.where)),
  findOne: vi.fn(async (options?: { where?: any }) => matchWhere(rows, options?.where)[0] ?? null),
  findOneBy: vi.fn(async (where: any) => matchWhere(rows, where)[0] ?? null),
  create: vi.fn((data: Row) => ({ ...data })),
  save: vi.fn(async (data: any) => (Array.isArray(data) ? data.map((d, i) => ({ id: 500 + i, ...d })) : { id: 500, ...data })),
  delete: vi.fn(async () => ({})),
  remove: vi.fn(async (data: any) => data),
});

const buildService = (state = makeState()) => {
  const carsRepository = repo(state.cars);
  const service = new GatheringTransportsService(
    carsRepository as any,
    repo([]) as any,
    repo([]) as any,
    repo([]) as any,
    repo(state.groups) as any,
    repo(state.families) as any,
    repo(state.housedRows) as any,
    repo([{ id: 1001, firstName: 'A', lastName: 'Un' }]) as any,
  );
  return { service, state, carsRepository };
};

describe('GatheringTransportsService', () => {
  it('board : cibles = groupes + collectifs isolés, avec effectifs logés et car affecté', async () => {
    const { service, state } = buildService();
    state.cars[0].assignments = [
      // TypeORM ne charge pas la relation inverse car : les doubles la reflètent.
      { id: 50, targetType: GatheringCarTarget.HOSTING_GROUP, hostingGroup: { id: 1 }, hostFamily: null },
    ];

    const board = await service.board();

    // Zone Nord : 3 personnes (2 Famille A + 1 Famille B) ; Paroisse Sud : 2 (Famille C + collectif) ;
    // Internat isolé : 2 actives (l'annulée ne compte pas).
    const nord = board.targets.find((t) => t.id === 1 && t.targetType === GatheringCarTarget.HOSTING_GROUP);
    const sud = board.targets.find((t) => t.id === 2 && t.targetType === GatheringCarTarget.HOSTING_GROUP);
    const internat = board.targets.find((t) => t.targetType === GatheringCarTarget.HOST_FAMILY);
    const vide = board.targets.find((t) => t.id === 3);
    expect(nord?.personCount).toBe(3);
    expect(nord?.carId).toBe(100);
    expect(nord?.carName).toBe('Car A');
    expect(nord?.detail).toContain('famille');
    expect(sud?.personCount).toBe(2);
    expect(sud?.carId).toBeNull();
    expect(internat?.name).toBe('Internat Exemple');
    expect(internat?.personCount).toBe(2);
    expect(vide?.personCount).toBe(0);
    // Non desservis d'abord, puis par nom.
    expect(board.targets[0].carId).toBeNull();
    expect(board.targets[board.targets.length - 1].carId).toBe(100);
  });

  it('board : occupation = cibles + ajoutés - retirés ; arrêts ordonnés', async () => {
    const { service, state } = buildService();
    state.cars[0].assignments = [
      { id: 50, targetType: GatheringCarTarget.HOSTING_GROUP, hostingGroup: { id: 1, name: 'Zone Nord' }, hostFamily: null },
      { id: 51, targetType: GatheringCarTarget.HOST_FAMILY, hostingGroup: null, hostFamily: { id: 13, familyName: 'Internat Exemple' } },
    ];
    state.cars[0].persons = [
      { id: 60, kind: GatheringCarPersonKind.ADDED, participant: { id: 2001, firstName: 'X', lastName: 'Y' } },
      { id: 61, kind: GatheringCarPersonKind.ADDED, participant: { id: 2002, firstName: 'Z', lastName: 'W' } },
      { id: 62, kind: GatheringCarPersonKind.REMOVED, participant: { id: 2003, firstName: 'R', lastName: 'S' } },
    ];

    const board = await service.board();
    const car = board.cars[0];

    expect(car.occupancy).toBe(3 + 2 + 2 - 1);
    expect(car.stops.map((s) => s.label)).toEqual(['Zone Nord', 'Lieu du rassemblement']);
    expect(car.assignments.map((a) => a.name)).toEqual(['Internat Exemple', 'Zone Nord']);
  });

  it('assign : déplace une cible déjà desservie par un autre car, ignore la réaffectation au même car', async () => {
    const { service, state, carsRepository } = buildService();
    state.cars.push({ id: 101, name: 'Car B', capacity: null, serviceDates: null, notes: null, stops: [], assignments: [], persons: [] });
    const assignmentsRepository = repo([
      { id: 50, car: { id: 101 }, targetType: GatheringCarTarget.HOSTING_GROUP, hostingGroup: { id: 1 }, hostFamily: null },
    ]);
    (service as any).assignmentsRepository = assignmentsRepository;
    carsRepository.save.mockImplementation(async (c: Row) => c);

    const view = await service.assign(100, [{ targetType: GatheringCarTarget.HOSTING_GROUP, id: 1 }]);

    expect(assignmentsRepository.remove).toHaveBeenCalled();
    expect(assignmentsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: GatheringCarTarget.HOSTING_GROUP }),
    );
    expect(view.id).toBe(100);
  });

  it('assign : un hébergement ordinaire ne se desservit pas seul (sa cible est son groupe)', async () => {
    const { service } = buildService();
    await expect(
      service.assign(100, [{ targetType: GatheringCarTarget.HOST_FAMILY, id: 10 }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('addPerson REMOVED : refusé si la personne n\'est hébergée dans aucune cible du car', async () => {
    const { service } = buildService();
    // Car A ne dessert rien : tout REMOVED est refusé.
    await expect(
      service.addPerson(100, { participantId: 1001, kind: GatheringCarPersonKind.REMOVED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('addPerson REMOVED : accepté quand la personne est hébergée dans une cible du car', async () => {
    const { service, state } = buildService();
    state.cars[0].assignments = [
      { id: 50, car: { id: 100 }, targetType: GatheringCarTarget.HOSTING_GROUP, hostingGroup: { id: 1 }, hostFamily: null },
    ];
    const personsRepository = repo([]);
    (service as any).personsRepository = personsRepository;
    (service as any).assignmentsRepository = repo([
      { id: 50, car: { id: 100 }, targetType: GatheringCarTarget.HOSTING_GROUP, hostingGroup: { id: 1 }, hostFamily: null },
    ]);

    await service.addPerson(100, { participantId: 1001, kind: GatheringCarPersonKind.REMOVED });

    expect(personsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ kind: GatheringCarPersonKind.REMOVED }),
    );
  });

  it('removeCar : 404 sur un car inconnu', async () => {
    const { service } = buildService();
    await expect(service.removeCar(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});
