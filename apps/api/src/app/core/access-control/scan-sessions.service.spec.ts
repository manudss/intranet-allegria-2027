import { ForbiddenException, GoneException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PersonType } from '../entities';
import { ScanSessionsService } from './scan-sessions.service';

const makeRepo = () => ({
  findOneBy: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
  save: vi.fn((entity) => Promise.resolve({ id: 11, ...entity })),
  create: vi.fn((entity) => entity),
  createQueryBuilder: vi.fn(),
});

const makeService = () => {
  const repos = {
    sessions: makeRepo(),
    assignments: makeRepo(),
    meta: makeRepo(),
    zones: makeRepo(),
  };
  repos.meta.findOneBy.mockResolvedValue({ id: 1, version: 41 });
  const qb = {
    innerJoin: vi.fn().mockReturnThis(),
    innerJoinAndMapOne: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue([]),
  };
  repos.assignments.createQueryBuilder.mockReturnValue(qb);

  const grantsService = { assertActiveGrant: vi.fn().mockResolvedValue(undefined) };
  const auditService = { record: vi.fn().mockResolvedValue(undefined) };

  const service = new ScanSessionsService(
    repos.sessions as never,
    repos.assignments as never,
    repos.meta as never,
    repos.zones as never,
    grantsService as never,
    auditService as never,
  );
  return { service, repos, grantsService, auditService, qb };
};

describe('ScanSessionsService', () => {
  it('refuse par défaut : sans habilitation active, pas de session', async () => {
    const { service, grantsService, repos } = makeService();
    grantsService.assertActiveGrant.mockRejectedValue(new ForbiddenException('nope'));

    await expect(service.start(1, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repos.sessions.save).not.toHaveBeenCalled();
  });

  it('démarre une session bornée : clé à expiration serveur + instantané versionné', async () => {
    const { service, repos, auditService } = makeService();

    const result = await service.start(1, {});

    expect(result.snapshotVersion).toBe(41);
    expect(result.sessionKey).toBeTruthy();
    expect(new Date(result.keyExpiresAt).getTime()).toBeLessThanOrEqual(Date.now() + 31 * 60_000);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(new Date(result.keyExpiresAt).getTime());
    expect(repos.sessions.save).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCAN_SESSION_STARTED' }),
    );
  });

  it('limite l’instantané aux types de personnes admis par la zone', async () => {
    const { service, repos, qb } = makeService();
    repos.zones.findOneBy.mockResolvedValue({
      id: 2,
      allowedPersonTypes: [PersonType.BENEVOLE],
      maxOfflineMinutes: 60,
      requiresOnlineValidation: true,
    });

    const result = await service.start(1, { zoneId: 2 });

    expect(qb.andWhere).toHaveBeenCalledWith('participant.type IN (:...types)', {
      types: [PersonType.BENEVOLE],
    });
    expect(result.requiresOnlineValidation).toBe(true);
    expect(result.maxOfflineMinutes).toBe(60);
  });

  it('la clé se renouvelle en ligne après expiration, tant que le grant tient', async () => {
    const { service, repos } = makeService();
    const oldKey = 'ancienne-cle';
    repos.sessions.findOneBy.mockResolvedValue({
      id: 11,
      userId: 1,
      zoneId: null,
      closedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      sessionKey: oldKey,
      keyExpiresAt: new Date(Date.now() - 1000),
    });

    const result = await service.getOrRenewKey(11, 1);

    expect(result.sessionKey).not.toBe(oldKey);
    expect(new Date(result.keyExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('session close ou expirée : plus de clé (coupure au prochain contact réseau)', async () => {
    const { service, repos } = makeService();
    repos.sessions.findOneBy.mockResolvedValue({
      id: 11,
      userId: 1,
      closedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.getOrRenewKey(11, 1)).rejects.toBeInstanceOf(GoneException);
  });

  it('le delta renvoie nouvelles affectations ET révocations', async () => {
    const { service, repos } = makeService();
    repos.sessions.findOneBy.mockResolvedValue({
      id: 11,
      userId: 1,
      zoneId: null,
      closedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    repos.assignments.find
      .mockResolvedValueOnce([
        { id: 9, badge: { code: 'c1' }, participant: { firstName: 'A', lastName: 'B', type: PersonType.JEUNE }, version: 2 },
      ])
      .mockResolvedValueOnce([{ id: 5 }]);

    const result = await service.delta(11, 1, 40);

    expect(result.version).toBe(41);
    expect(result.upserts).toEqual([
      { assignmentId: 9, code: 'c1', firstName: 'A', lastName: 'B', personType: PersonType.JEUNE, version: 2 },
    ]);
    expect(result.revokedAssignmentIds).toEqual([5]);
  });
});
