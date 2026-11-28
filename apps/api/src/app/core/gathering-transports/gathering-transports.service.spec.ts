import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AccommodationType,
  AssignmentStatus,
  GatheringCarPersonKind,
  GatheringCarTarget,
} from '../entities';
import { GatheringTransportsService, computeTripOccupancy } from './gathering-transports.service';

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
  it('board : « non renseigné » n\'est pas « pas besoin » et une cible déjà affectée n\'est jamais masquée', async () => {
    const { service, state } = buildService();
    state.cars[0].assignments = [
      { id: 50, targetType: GatheringCarTarget.HOSTING_GROUP, hostingGroup: { id: 1 }, hostFamily: null },
    ];
    const groups = state.groups as any[];
    groups[0].needsTransport = false; // déjà affecté : reste visible malgré « pas besoin »
    groups[1].needsTransport = true;
    groups[2].needsTransport = false;
    for (const f of state.families as any[]) f.needsTransport = null;

    const board = await service.board();

    expect(board.targets.map((t) => t.id).sort()).toEqual([1, 2]);
    expect(board.targets.find((t) => t.id === 1)?.carId).toBe(100);
    expect(board.notNeededCount).toBe(1);
    expect(board.undecidedTargets.every((t) => t.needsTransport === null && t.carId === null)).toBe(true);
    expect(board.undecidedTargets.length).toBeGreaterThan(0);
  });

  it('board : cibles = groupes + collectifs isolés, avec effectifs logés et car affecté', async () => {
    const { service, state } = buildService();
    state.cars[0].assignments = [
      // TypeORM ne charge pas la relation inverse car : les doubles la reflètent.
      { id: 50, targetType: GatheringCarTarget.HOSTING_GROUP, hostingGroup: { id: 1 }, hostFamily: null },
    ];

    // Tout est marqué « transport nécessaire » ici : ce test vérifie les effectifs et le car.
    for (const g of state.groups as any[]) g.needsTransport = true;
    for (const f of state.families as any[]) f.needsTransport = true;
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
      // 1001 est logée dans la Famille A (groupe 1) : le retrait se rattache à Zone Nord.
      { id: 62, kind: GatheringCarPersonKind.REMOVED, participant: { id: 1001, firstName: 'R', lastName: 'S' } },
    ];

    const board = await service.board();
    const car = board.cars[0];

    expect(car.occupancy).toBe(3 + 2 + 2 - 1);
    expect(car.stops.map((s) => s.label)).toEqual(['Zone Nord', 'Lieu du rassemblement']);
    expect(car.assignments.map((a) => a.name)).toEqual(['Internat Exemple', 'Zone Nord']);
    expect(car.assignments.find((a) => a.name === 'Zone Nord')?.removedCount).toBe(1);
    expect(car.assignments.find((a) => a.name === 'Internat Exemple')?.removedCount).toBe(0);
  });

  it('assign : déplace une cible déjà desservie par un autre car, ignore la réaffectation au même car', async () => {
    const { service, state, carsRepository } = buildService();
    state.cars.push({ id: 101, name: 'Car B', capacity: null, serviceDates: null, notes: null, stops: [], assignments: [], persons: [] });
    const assignmentsRepository = repo([
      { id: 50, car: { id: 101 }, targetType: GatheringCarTarget.HOSTING_GROUP, hostingGroup: { id: 1 }, hostFamily: null },
    ]);
    (service as any).assignmentsRepository = assignmentsRepository;
    carsRepository.save.mockImplementation(async (c: Row) => c);

    const view = await service.assign(100, [{ targetType: GatheringCarTarget.HOSTING_GROUP, id: 1 }], true);

    expect(assignmentsRepository.remove).toHaveBeenCalled();
    expect(assignmentsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: GatheringCarTarget.HOSTING_GROUP }),
    );
    expect(view.id).toBe(100);
  });

  it('assign : refuse le déplacement d\'une cible déjà affectée sans confirmation, sans rien modifier', async () => {
    const { service, state } = buildService();
    state.cars.push({ id: 101, name: 'Car B', capacity: null, serviceDates: null, notes: null, stops: [], assignments: [], persons: [] });
    const assignmentsRepository = repo([
      { id: 50, car: { id: 101 }, targetType: GatheringCarTarget.HOSTING_GROUP, hostingGroup: { id: 1, name: 'Zone Nord' }, hostFamily: null },
    ]);
    (service as any).assignmentsRepository = assignmentsRepository;
    await expect(
      service.assign(100, [{ targetType: GatheringCarTarget.HOSTING_GROUP, id: 1 }]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(assignmentsRepository.remove).not.toHaveBeenCalled();
    expect(assignmentsRepository.save).not.toHaveBeenCalled();
  });

  it('assign : bloque une affectation qui dépasse la capacité du car (Zone Nord = 3 personnes)', async () => {
    const { service, state } = buildService();
    state.cars[0].capacity = 2;
    const assignmentsRepository = repo([]);
    (service as any).assignmentsRepository = assignmentsRepository;
    await expect(
      service.assign(100, [{ targetType: GatheringCarTarget.HOSTING_GROUP, id: 1 }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(assignmentsRepository.save).not.toHaveBeenCalled();
  });

  it('assign : accepte quand la capacité suffit', async () => {
    const { service, state } = buildService();
    state.cars[0].capacity = 3;
    const assignmentsRepository = repo([]);
    (service as any).assignmentsRepository = assignmentsRepository;
    await service.assign(100, [{ targetType: GatheringCarTarget.HOSTING_GROUP, id: 1 }]);
    expect(assignmentsRepository.save).toHaveBeenCalled();
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

describe('computeTripOccupancy', () => {
  const row = (pid: number, familyId: number, groupId: number | null, arrival: string, departure: string, status = AssignmentStatus.CONFIRMED) => ({
    status,
    arrivalDate: arrival,
    departureDate: departure,
    participant: { id: pid },
    hostFamily: { id: familyId, hostingGroup: groupId ? { id: groupId } : null },
  });
  const G = (id: number) => ({ targetType: GatheringCarTarget.HOSTING_GROUP, id });
  const rows = [
    row(1, 10, 1, '2027-10-28', '2027-10-31'),
    row(2, 10, 1, '2027-10-28', '2027-10-31'),
    row(3, 11, 1, '2027-10-28', '2027-10-30'),
    row(4, 11, 1, '2027-10-28', '2027-10-31', AssignmentStatus.CANCELLED),
  ];

  it('groupe entier : tous les logés comptent, annulés exclus, dates de service nulles = un seul total', () => {
    expect(computeTripOccupancy(null, [G(1)], [], rows)).toEqual([{ date: null, count: 3 }]);
  });

  it('exceptions : REMOVED retire, ADDED ajoute, sans compter deux fois', () => {
    const persons = [
      { kind: GatheringCarPersonKind.REMOVED, participantId: 2 },
      { kind: GatheringCarPersonKind.ADDED, participantId: 99 },
      { kind: GatheringCarPersonKind.ADDED, participantId: 1 },
    ];
    expect(computeTripOccupancy(null, [G(1)], persons, rows)[0].count).toBe(3);
  });

  it('trajets distincts : un voyageur parti avant la date ne compte pas, pas d\'addition entre trajets', () => {
    const trips = computeTripOccupancy(['2027-10-30', '2027-10-31'], [G(1)], [], rows);
    expect(trips).toEqual([
      { date: '2027-10-30', count: 3 },
      { date: '2027-10-31', count: 2 },
    ]);
  });

  it('un participant relevant de deux cibles servies est compté une fois', () => {
    const both = [G(1), { targetType: GatheringCarTarget.HOST_FAMILY, id: 10 }];
    expect(computeTripOccupancy(null, both, [], rows)[0].count).toBe(3);
  });
});
