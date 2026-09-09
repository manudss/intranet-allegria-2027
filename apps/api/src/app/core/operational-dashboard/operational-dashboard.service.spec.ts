import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OperationalDashboardService } from './operational-dashboard.service';

// ─── Mock QueryBuilder ────────────────────────────────────────────────────────

function makeMockQb(rawOneResult?: object, rawManyResult?: object[], countResult = 0) {
  const qb = {
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    addGroupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    getCount: vi.fn().mockResolvedValue(countResult),
    getRawOne: vi.fn().mockResolvedValue(rawOneResult ?? null),
    getRawMany: vi.fn().mockResolvedValue(rawManyResult ?? []),
  };
  return qb;
}

function makeRepo(rawOneResult?: object, rawManyResult?: object[], countResult = 0) {
  return {
    createQueryBuilder: vi.fn(() => makeMockQb(rawOneResult, rawManyResult, countResult)),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
  };
}

// ADMIN user pour les tests
const adminUser = { id: 1, email: 'admin@test.com', roles: ['ADMIN'] };

function makeService(overrides?: {
  missionsRepo?: ReturnType<typeof makeRepo>;
  shiftsRepo?: ReturnType<typeof makeRepo>;
  assignmentsRepo?: ReturnType<typeof makeRepo>;
}) {
  return new OperationalDashboardService(
    (overrides?.missionsRepo ?? makeRepo()) as never,
    (overrides?.shiftsRepo ?? makeRepo()) as never,
    (overrides?.assignmentsRepo ?? makeRepo()) as never,
    makeRepo() as never,
    makeRepo() as never, // volunteersRepo → findOne returns null (ADMIN n'a pas besoin de volunteer scope)
    makeRepo() as never,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OperationalDashboardService', () => {
  describe('parseDay (via getGlobalSummary)', () => {
    it('lève BadRequestException si la date est invalide', async () => {
      const svc = makeService();
      await expect(svc.getGlobalSummary(adminUser, { date: 'invalid' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('utilise la date du jour si aucune date n\'est fournie', async () => {
      const countersResult = {
        missionCount: 0, shiftCount: 0,
        shiftsTodo: 0, shiftsAssigned: 0, shiftsInProgress: 0,
        shiftsDone: 0, shiftsCancelled: 0, shiftsNotDone: 0,
      };
      const svc = makeService({
        shiftsRepo: makeRepo(countersResult),
        assignmentsRepo: makeRepo({ cnt: 0 }),
      });
      const today = new Date().toISOString().slice(0, 10);
      const result = await svc.getGlobalSummary(adminUser, {});
      expect(result.date).toBe(today);
    });
  });

  describe('getGlobalSummary', () => {
    it('retourne la structure complète avec les compteurs agrégés', async () => {
      const countersResult = {
        missionCount: 3, shiftCount: 8,
        shiftsTodo: 2, shiftsAssigned: 3, shiftsInProgress: 1,
        shiftsDone: 1, shiftsCancelled: 0, shiftsNotDone: 1,
      };
      const svc = makeService({
        shiftsRepo: makeRepo(countersResult, [], 2),
        assignmentsRepo: makeRepo({ cnt: 5 }),
      });

      const result = await svc.getGlobalSummary(adminUser, { date: '2027-07-24' });

      expect(result.date).toBe('2027-07-24');
      expect(result.missionCount).toBe(3);
      expect(result.shiftCount).toBe(8);
      expect(result.shiftsByStatus.TODO).toBe(2);
      expect(result.shiftsByStatus.DONE).toBe(1);
      expect(result.assignedVolunteers).toBe(5);
      expect(result.provisionalVolunteers).toBe(5);
    });

    it('retourne des zéros quand aucun shift n\'existe pour la date', async () => {
      const svc = makeService({
        shiftsRepo: makeRepo(null, [], 0),
        assignmentsRepo: makeRepo({ cnt: 0 }),
      });

      const result = await svc.getGlobalSummary(adminUser, { date: '2027-07-24' });

      expect(result.missionCount).toBe(0);
      expect(result.shiftCount).toBe(0);
      expect(result.shiftsByStatus.TODO).toBe(0);
      expect(result.understaffedShifts).toBe(0);
      expect(result.assignedVolunteers).toBe(0);
    });
  });

  describe('getTeamsSummary', () => {
    it('retourne un tableau par équipe avec shiftsByStatus et alertes', async () => {
      const teamRows = [
        {
          teamId: 1, teamName: 'Accueil', teamCode: 'ACCUEIL',
          missionCount: 2,
          shiftsTodo: 1, shiftsAssigned: 1, shiftsInProgress: 0,
          shiftsDone: 0, shiftsCancelled: 0, shiftsNotDone: 0,
          totalCapacity: 10,
        },
      ];
      const svc = makeService({
        shiftsRepo: makeRepo(undefined, teamRows),
        assignmentsRepo: makeRepo({ cnt: 4 }),
      });

      const result = await svc.getTeamsSummary(adminUser, { date: '2027-07-24' });

      expect(result).toHaveLength(1);
      expect(result[0].teamName).toBe('Accueil');
      expect(result[0].shiftsByStatus.TODO).toBe(1);
      expect(result[0].missionCount).toBe(2);
      expect(result[0].alerts).toContain('1 shift(s) non commencé(s)');
    });

    it('retourne un tableau vide s\'il n\'y a pas d\'équipes ce jour', async () => {
      const svc = makeService({
        shiftsRepo: makeRepo(undefined, []),
        assignmentsRepo: makeRepo({ cnt: 0 }),
      });

      const result = await svc.getTeamsSummary(adminUser, { date: '2027-07-24' });

      expect(result).toHaveLength(0);
    });
  });

  describe('getLocationsSummary', () => {
    it('retourne les lieux avec compteurs et alertes de sous-effectif', async () => {
      const locRows = [
        { location: 'Gymnase', shiftsInProgress: 1, shiftsUpcoming: 2, assignedVolunteers: 3, totalCapacity: 10 },
        { location: 'Chapelle', shiftsInProgress: 0, shiftsUpcoming: 1, assignedVolunteers: 5, totalCapacity: 5 },
      ];
      const svc = makeService({
        shiftsRepo: makeRepo(undefined, locRows),
      });

      const result = await svc.getLocationsSummary(adminUser, { date: '2027-07-24' });

      expect(result).toHaveLength(2);
      const gymnase = result.find((r) => r.location === 'Gymnase')!;
      expect(gymnase.alerts).toContain('Sous-effectif : 3/10 bénévoles');
      const chapelle = result.find((r) => r.location === 'Chapelle')!;
      expect(chapelle.alerts).toHaveLength(0);
    });
  });

  describe('getWhoDoesWhat', () => {
    it('retourne la structure paginée avec items vides si aucun résultat', async () => {
      const svc = makeService({
        assignmentsRepo: makeRepo({ total: 0 }, []),
      });

      const result = await svc.getWhoDoesWhat(adminUser, { date: '2027-07-24', q: 'Inconnu' });

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('valide la pagination (limit, offset)', async () => {
      const svc = makeService({
        assignmentsRepo: makeRepo({ total: 50 }, [
          { volunteerId: 1, firstName: 'Alice', lastName: 'Martin' },
        ]),
      });

      const result = await svc.getWhoDoesWhat(adminUser, { date: '2027-07-24', page: 2, limit: 20 });

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(20);
    });

    it('plafonne le limit à 100', async () => {
      const svc = makeService({
        assignmentsRepo: makeRepo({ total: 0 }, []),
      });

      const result = await svc.getWhoDoesWhat(adminUser, { date: '2027-07-24', limit: 9999 });

      expect(result.limit).toBe(100);
    });
  });

  describe('getTodoList', () => {
    it('retourne les 4 catégories de la liste à faire', async () => {
      const mandatoryMission = { missionId: 1, title: 'Accueil', teamName: 'Logistique', location: null, shiftCount: 2 };
      const todoShift = {
        shiftId: 10, missionTitle: 'Accueil', missionId: 1,
        startAt: '2027-07-24T08:00:00Z', endAt: '2027-07-24T12:00:00Z',
        location: null, capacity: 4, activeCount: 2, confirmedCount: 0,
      };

      const missionsRepo = {
        createQueryBuilder: vi.fn()
          .mockReturnValueOnce(makeMockQb(undefined, [mandatoryMission])) // mandatory
          .mockReturnValueOnce(makeMockQb(undefined, [])),                // optional
      };
      const shiftsRepo = {
        createQueryBuilder: vi.fn()
          .mockReturnValueOnce(makeMockQb(undefined, [todoShift]))   // unstarted
          .mockReturnValueOnce(makeMockQb(undefined, [todoShift])),  // withoutConfirmed
      };

      const svc = makeService({
        missionsRepo: missionsRepo as never,
        shiftsRepo: shiftsRepo as never,
      });

      const result = await svc.getTodoList(adminUser, { date: '2027-07-24' });

      expect(result.mandatoryIncomplete).toHaveLength(1);
      expect(result.mandatoryIncomplete[0].title).toBe('Accueil');
      expect(result.unstarted).toHaveLength(1);
      expect(result.withoutConfirmedStaff).toHaveLength(1);
      expect(result.optionalIncomplete).toHaveLength(0);
    });
  });

  describe('RBAC — scope filter', () => {
    it('applique 1=0 si l\'utilisateur n\'a aucun rôle ni équipe', async () => {
      const noScopeUser = { id: 99, email: 'nobody@test.com', roles: [] };
      const qbSpy = makeMockQb({ cnt: 0 });
      const repo = { createQueryBuilder: vi.fn(() => qbSpy), find: vi.fn().mockResolvedValue([]), findOne: vi.fn().mockResolvedValue(null) };
      const svc = makeService({
        shiftsRepo: repo as never,
        assignmentsRepo: makeRepo({ cnt: 0 }) as never,
      });

      await svc.getGlobalSummary(noScopeUser, { date: '2027-07-24' });

      // Le premier QB (counters) doit avoir reçu andWhere('1 = 0')
      const andWhereCalls = qbSpy.andWhere.mock.calls.map((c) => c[0]);
      expect(andWhereCalls).toContain('1 = 0');
    });

    it('ne filtre pas pour ADMIN', async () => {
      const qbSpy = makeMockQb({ cnt: 0 });
      const repo = { createQueryBuilder: vi.fn(() => qbSpy), find: vi.fn().mockResolvedValue([]), findOne: vi.fn().mockResolvedValue(null) };
      const svc = makeService({ assignmentsRepo: repo as never });

      await svc.getGlobalSummary(adminUser, { date: '2027-07-24' });

      const andWhereCalls = qbSpy.andWhere.mock.calls.map((c) => c[0]);
      expect(andWhereCalls).not.toContain('1 = 0');
    });
  });

  describe('exportOperationalData', () => {
    it('refuse les exports pour VIEWER sans permission dédiée', async () => {
      const svc = makeService();
      await expect(
        svc.exportOperationalData(
          { id: 10, email: 'viewer@test.com', roles: ['VIEWER'] },
          'global-planning',
          { format: 'xlsx', date: '2027-07-24' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('retourne un fichier avec nom explicite et MIME xlsx', async () => {
      const rows = [
        {
          missionId: 1,
          missionTitle: 'Accueil',
          missionStatus: 'TODO',
          teamName: 'Equipe A',
          teamCode: 'EA',
          location: 'Entrée',
          shiftId: 100,
          shiftStatus: 'ASSIGNED',
          shiftStartAt: new Date('2027-07-24T08:00:00.000Z'),
          shiftEndAt: new Date('2027-07-24T10:00:00.000Z'),
          shiftCapacity: 2,
          assignmentId: 55,
          assignmentStatus: 'CONFIRMED',
          volunteerId: 12,
          volunteerFirstName: 'Lina',
          volunteerLastName: 'Martin',
        },
      ];
      const shiftsRepo = makeRepo(undefined, rows as object[]);
      const svc = makeService({ shiftsRepo });

      const result = await svc.exportOperationalData(adminUser, 'global-planning', {
        format: 'xlsx',
        dateFrom: '2027-07-24',
        dateTo: '2027-07-24',
        volunteerTeamId: 2,
      });

      expect(result.fileName).toContain('global-planning__2027-07-24_2027-07-24__team-2.xlsx');
      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.body.length).toBeGreaterThan(0);
    });
  });
});

