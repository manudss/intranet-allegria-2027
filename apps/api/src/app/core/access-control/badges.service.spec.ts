import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AccessBadge, AccessBadgeAssignment, AccessBadgeStatus, Participant } from '../entities';
import { BadgesService } from './badges.service';

const makeQb = (result: unknown) => {
  const qb = {
    setLock: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(result),
  };
  return qb;
};

const makeRepo = () => ({
  findOneBy: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
  save: vi.fn((entity) => Promise.resolve(entity)),
  create: vi.fn((entity) => entity),
  createQueryBuilder: vi.fn(),
});

type ManagerMocks = {
  badges: ReturnType<typeof makeRepo>;
  assignments: ReturnType<typeof makeRepo>;
  participants: ReturnType<typeof makeRepo>;
  audit: ReturnType<typeof makeRepo>;
  query: ReturnType<typeof vi.fn>;
};

const makeService = (options?: { lockedBadge?: Partial<AccessBadge> | null }) => {
  const repos = {
    badges: makeRepo(),
    assignments: makeRepo(),
    participants: makeRepo(),
    audit: makeRepo(),
  };
  repos.badges.createQueryBuilder.mockReturnValue(makeQb(options?.lockedBadge ?? null));

  const query = vi.fn((sql: string) => {
    if (sql.includes('MAX(version)')) {
      return Promise.resolve([{ max: null }]);
    }
    return Promise.resolve([{ version: 7 }]);
  });

  const manager = {
    getRepository: (entity: { name: string }) => {
      const map: Record<string, ReturnType<typeof makeRepo>> = {
        AccessBadge: repos.badges,
        AccessBadgeAssignment: repos.assignments,
        Participant: repos.participants,
        AccessAuditLog: repos.audit,
      };
      return map[entity.name];
    },
    query,
  } as unknown as ManagerMocks & object;

  const dataSource = {
    transaction: vi.fn((cb: (m: unknown) => Promise<unknown>) => cb(manager)),
  };

  const auditService = { record: vi.fn().mockResolvedValue(undefined) };

  const service = new BadgesService(
    dataSource as never,
    repos.badges as never,
    repos.assignments as never,
    repos.participants as never,
    auditService as never,
  );

  return { service, repos, query, auditService, manager };
};

describe('BadgesService', () => {
  it('génère un stock de codes opaques pour un lot et journalise', async () => {
    const { service, repos, auditService } = makeService();
    repos.badges.createQueryBuilder.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      orIgnore: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ identifiers: [{ id: 1 }, { id: 2 }] }),
    });

    const result = await service.registerStock({ lot: 'L2027-A', count: 2 }, 1);

    expect(result).toMatchObject({ lot: 'L2027-A', requested: 2, added: 2, skipped: 0 });
    expect(result.codes).toHaveLength(2);
    expect(new Set(result.codes).size).toBe(2);
    for (const code of result.codes) {
      expect(code).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BADGE_STOCK_ADDED' }),
    );
  });

  it('refuse une seconde badge actif pour la même personne (refus par défaut)', async () => {
    const { service, repos } = makeService({ lockedBadge: { id: 9, code: 'aa', status: AccessBadgeStatus.AVAILABLE } });
    repos.participants.findOneBy.mockResolvedValue({ id: 42 } as Participant);
    repos.assignments.findOne.mockResolvedValue({ id: 5, participantId: 42 } as AccessBadgeAssignment);

    await expect(service.assign({ participantId: 42, badgeCode: 'aa' }, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('interdit le réemploi d’un code déclaré perdu', async () => {
    const { service, repos } = makeService({ lockedBadge: { id: 9, code: 'lost', status: AccessBadgeStatus.LOST } });
    repos.participants.findOneBy.mockResolvedValue({ id: 42 } as Participant);
    repos.assignments.findOne.mockResolvedValue(null);

    await expect(service.assign({ participantId: 42, badgeCode: 'lost' }, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('attribue un badge disponible : affectation versionnée, badge ASSIGNED, audit', async () => {
    const { service, repos, auditService } = makeService({
      lockedBadge: { id: 9, code: 'ok', status: AccessBadgeStatus.AVAILABLE },
    });
    repos.participants.findOneBy.mockResolvedValue({ id: 42 } as Participant);
    repos.assignments.findOne.mockResolvedValue(null);

    const assignment = await service.assign({ participantId: 42, badgeCode: 'ok' }, 1);

    expect(assignment).toMatchObject({ badgeId: 9, participantId: 42, version: 1, metaCreatedVersion: 7 });
    expect(repos.badges.save).toHaveBeenCalledWith(expect.objectContaining({ status: AccessBadgeStatus.ASSIGNED }));
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BADGE_ASSIGNED' }),
      expect.anything(),
    );
  });

  it('est idempotent par operationId', async () => {
    const { service, repos } = makeService();
    const existing = { id: 77, operationId: 'op-1' } as AccessBadgeAssignment;
    repos.assignments.findOne.mockResolvedValue(existing);

    const result = await service.assign({ participantId: 42, badgeCode: 'ok', operationId: 'op-1' }, 1);

    expect(result).toBe(existing);
    expect(repos.badges.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('remplace un badge perdu en une opération : ancien clôturé et LOST, nouveau actif', async () => {
    const { service, repos, auditService } = makeService({
      lockedBadge: { id: 10, code: 'new', status: AccessBadgeStatus.AVAILABLE },
    });
    repos.participants.findOneBy.mockResolvedValue({ id: 42 } as Participant);
    const current = { id: 5, badgeId: 8, participantId: 42, endsAt: null, metaClosedVersion: null };
    // 1er findOne : affectation active ; 2e : (revoke path non utilisé) — replace n'appelle findOne qu'une fois.
    repos.assignments.findOne.mockResolvedValue(current);
    repos.badges.findOneBy.mockResolvedValue({ id: 8, status: AccessBadgeStatus.ASSIGNED });

    const assignment = await service.replace({ participantId: 42, newBadgeCode: 'new' }, 1);

    expect(current.endsAt).toBeInstanceOf(Date);
    expect(current.metaClosedVersion).toBe(7);
    expect(repos.badges.save).toHaveBeenCalledWith(expect.objectContaining({ id: 8, status: AccessBadgeStatus.LOST }));
    expect(assignment).toMatchObject({ badgeId: 10, participantId: 42, version: 1 });
    expect(repos.badges.save).toHaveBeenCalledWith(expect.objectContaining({ id: 10, status: AccessBadgeStatus.ASSIGNED }));
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BADGE_REPLACED' }),
      expect.anything(),
    );
  });

  it('convertit une violation de contrainte (concurrence) en 409 sans état partiel', async () => {
    const { service, repos } = makeService({ lockedBadge: { id: 9, code: 'ok', status: AccessBadgeStatus.AVAILABLE } });
    repos.participants.findOneBy.mockResolvedValue({ id: 42 } as Participant);
    repos.assignments.findOne.mockResolvedValue(null);
    repos.assignments.save.mockRejectedValue(Object.assign(new Error('duplicate'), { code: '23505' }));

    await expect(service.assign({ participantId: 42, badgeCode: 'ok' }, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('révoque : clôt l’affectation active et passe le badge REVOKED', async () => {
    const { service, repos, auditService } = makeService({
      lockedBadge: { id: 9, code: 'ok', status: AccessBadgeStatus.ASSIGNED },
    });
    const active = { id: 5, badgeId: 9, participantId: 42, endsAt: null, metaClosedVersion: null };
    repos.assignments.findOne.mockResolvedValue(active);

    await service.revoke(9, 'Fin de séjour', 1);

    expect(active.endsAt).toBeInstanceOf(Date);
    expect(repos.badges.save).toHaveBeenCalledWith(expect.objectContaining({ status: AccessBadgeStatus.REVOKED }));
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BADGE_REVOKED' }),
      expect.anything(),
    );
  });
});
