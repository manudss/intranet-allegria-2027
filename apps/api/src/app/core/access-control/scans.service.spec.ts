import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AccessBadgeStatus,
  AccessScanDuplicateRule,
  AccessScanVerdict,
  PersonType,
} from '../entities';
import { ScansService } from './scans.service';
import { LookupRateLimiterService } from './lookup-rate-limiter.service';

const makeRepo = () => ({
  findOneBy: vi.fn(),
  findOne: vi.fn(),
  find: vi.fn(),
  save: vi.fn((entity) => Promise.resolve({ id: 500, ...entity })),
  create: vi.fn((entity) => entity),
  count: vi.fn().mockResolvedValue(0),
});

const makePoint = (overrides?: {
  duplicateRule?: AccessScanDuplicateRule;
  allowedTypes?: PersonType[] | null;
  serviceKey?: string | null;
}) => ({
  id: 3,
  active: true,
  zoneId: 1,
  scanTypeId: 2,
  serviceKey: overrides?.serviceKey ?? 'repas-midi',
  zone: { id: 1, allowedPersonTypes: overrides?.allowedTypes ?? null },
  scanType: { id: 2, duplicateRule: overrides?.duplicateRule ?? AccessScanDuplicateRule.ALLOW },
});

const makeService = (point = makePoint()) => {
  const repos = {
    events: makeRepo(),
    points: makeRepo(),
    badges: makeRepo(),
    assignments: makeRepo(),
    audit: makeRepo(),
  };
  const manager = { query: vi.fn().mockResolvedValue([]), getRepository: () => repos.events };
  Object.assign(repos.events, { manager: { transaction: vi.fn((fn) => fn(manager)) } });
  repos.points.findOne.mockResolvedValue(point);

  const sessionsService = { findOwnedSession: vi.fn().mockResolvedValue({ id: 11, userId: 1 }) };
  const grantsService = { assertActiveGrant: vi.fn().mockResolvedValue(undefined) };
  const auditService = { record: vi.fn().mockResolvedValue(undefined) };
  const rateLimiter = new LookupRateLimiterService();

  const service = new ScansService(
    repos.events as never,
    repos.points as never,
    repos.badges as never,
    repos.assignments as never,
    repos.audit as never,
    sessionsService as never,
    grantsService as never,
    auditService as never,
    rateLimiter,
  );
  return { service, repos, auditService, grantsService, rateLimiter, sessionsService, manager };
};

const scan = (overrides?: Record<string, unknown>) => ({
  clientEventId: 'evt-1',
  code: 'code-1',
  pointId: 3,
  ...overrides,
});

describe('ScansService.upload', () => {
  it('takes a database transaction lock before deciding unique-service scans', async () => {
    const { service, repos, manager } = makeService(makePoint({duplicateRule: AccessScanDuplicateRule.UNIQUE_PER_SERVICE}));
    repos.badges.findOneBy.mockResolvedValue(null);
    await service.upload(11, 1, {scans: [scan()]});
    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, $2)', [21027, 2]);
    expect(manager.query.mock.invocationCallOrder[0]).toBeLessThan(repos.events.save.mock.invocationCallOrder[0]);
  });
  it('est idempotent : un clientEventId déjà enregistré renvoie le verdict stocké', async () => {
    const { service, repos } = makeService();
    repos.events.findOneBy.mockResolvedValue({ verdict: AccessScanVerdict.ACCEPTED });

    const results = await service.upload(11, 1, { scans: [scan()] });

    expect(results).toEqual([{ clientEventId: 'evt-1', verdict: AccessScanVerdict.ACCEPTED }]);
    expect(repos.events.save).not.toHaveBeenCalled();
  });

  it('code inconnu : refusé et marqué à vérifier (jamais réattribué)', async () => {
    const { service, repos } = makeService();
    repos.events.findOneBy.mockResolvedValue(null);
    repos.badges.findOneBy.mockResolvedValue(null);

    const [result] = await service.upload(11, 1, { scans: [scan()] });

    expect(result.verdict).toBe(AccessScanVerdict.REJECTED_UNKNOWN);
    expect(repos.events.save).toHaveBeenCalledWith(expect.objectContaining({ needsReview: true }));
  });

  it('badge révoqué/perdu : refusé même si la table locale est périmée', async () => {
    const { service, repos } = makeService();
    repos.events.findOneBy.mockResolvedValue(null);
    repos.badges.findOneBy.mockResolvedValue({ id: 8, status: AccessBadgeStatus.REVOKED });
    repos.assignments.findOne.mockResolvedValue(null);

    const [result] = await service.upload(11, 1, { scans: [scan()] });

    expect(result.verdict).toBe(AccessScanVerdict.REJECTED_REVOKED);
  });

  it('badge réassigné depuis la synchro : le serveur tranche (affectation clôturée)', async () => {
    const { service, repos } = makeService();
    repos.events.findOneBy.mockResolvedValue(null);
    repos.badges.findOneBy.mockResolvedValue({ id: 8, status: AccessBadgeStatus.ASSIGNED });
    repos.assignments.findOne.mockResolvedValue({
      id: 5,
      endsAt: new Date(),
      participant: { id: 42, type: PersonType.JEUNE },
      participantId: 42,
      badgeId: 8,
    });

    const [result] = await service.upload(11, 1, { scans: [scan({ assignmentId: 5 })] });

    expect(result.verdict).toBe(AccessScanVerdict.REJECTED_EXPIRED_ASSIGNMENT);
    expect(repos.events.save).toHaveBeenCalledWith(expect.objectContaining({ needsReview: true }));
  });

  it('zone réservée aux adultes : un jeune est refusé (NO_RIGHT)', async () => {
    const { service, repos } = makeService(makePoint({ allowedTypes: [PersonType.BENEVOLE] }));
    repos.events.findOneBy.mockResolvedValue(null);
    repos.badges.findOneBy.mockResolvedValue({ id: 8, status: AccessBadgeStatus.ASSIGNED });
    repos.assignments.findOne.mockResolvedValue({
      id: 5,
      endsAt: null,
      participant: { id: 42, type: PersonType.JEUNE },
      participantId: 42,
      badgeId: 8,
    });

    const [result] = await service.upload(11, 1, { scans: [scan({ assignmentId: 5 })] });

    expect(result.verdict).toBe(AccessScanVerdict.REJECTED_NO_RIGHT);
  });

  it('repas : un second scan du même service est un doublon compté par PERSONNE', async () => {
    const { service, repos } = makeService(
      makePoint({ duplicateRule: AccessScanDuplicateRule.UNIQUE_PER_SERVICE }),
    );
    repos.events.findOneBy.mockResolvedValue(null);
    repos.badges.findOneBy.mockResolvedValue({ id: 10, status: AccessBadgeStatus.ASSIGNED });
    // Affectation du badge NEUF après remplacement : même personne.
    repos.assignments.findOne.mockResolvedValue({
      id: 6,
      endsAt: null,
      participant: { id: 42, type: PersonType.JEUNE },
      participantId: 42,
      badgeId: 10,
    });
    repos.events.findOne.mockImplementation((args: { where?: { participantId?: number } }) =>
      args?.where?.participantId === 42 ? Promise.resolve({ id: 300 }) : Promise.resolve(null),
    );

    const [result] = await service.upload(11, 1, { scans: [scan({ assignmentId: 6 })] });

    expect(result.verdict).toBe(AccessScanVerdict.DUPLICATE);
    // Le badge neuf ne redonne pas un repas : le doublon est cherché par participantId.
    expect(repos.events.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ participantId: 42, scanTypeId: 2, serviceKey: 'repas-midi' }),
      }),
    );
  });

  it('accepte un scan valide et conserve le contexte (code, version de table, session)', async () => {
    const { service, repos } = makeService();
    repos.events.findOneBy.mockResolvedValue(null);
    repos.badges.findOneBy.mockResolvedValue({ id: 8, status: AccessBadgeStatus.ASSIGNED });
    repos.assignments.findOne.mockResolvedValue({
      id: 5,
      endsAt: null,
      participant: { id: 42, type: PersonType.JEUNE },
      participantId: 42,
      badgeId: 8,
    });

    const [result] = await service.upload(11, 1, {
      scans: [scan({ assignmentId: 5, tableVersion: 41, occurredAtLocal: '2027-07-31T12:00:00.000Z' })],
    });

    expect(result.verdict).toBe(AccessScanVerdict.ACCEPTED);
    expect(repos.events.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 11,
        assignmentId: 5,
        participantId: 42,
        code: 'code-1',
        tableVersion: 41,
        needsReview: false,
      }),
    );
  });
});

describe('ScansService.lookup (repli en ligne sur code inconnu)', () => {
  it('exige une habilitation active sur la zone du point', async () => {
    const { service, grantsService } = makeService();
    grantsService.assertActiveGrant.mockRejectedValue(new Error('pas de grant'));

    await expect(service.lookup(1, 'code-1', 3)).rejects.toThrow();
  });

  it('renvoie un verdict seul, sans dévoiler la table (pas de nom)', async () => {
    const { service, repos } = makeService();
    repos.badges.findOneBy.mockResolvedValue({ id: 8, status: AccessBadgeStatus.ASSIGNED });
    repos.assignments.findOne.mockResolvedValue({
      id: 5,
      endsAt: null,
      participant: { id: 42, type: PersonType.JEUNE, firstName: 'Ada', lastName: 'Lovelace' },
      participantId: 42,
      badgeId: 8,
    });

    const result = await service.lookup(1, 'code-1', 3);

    expect(result.verdict).toBe(AccessScanVerdict.ACCEPTED);
    expect(result).not.toHaveProperty('firstName');
    expect(result).not.toHaveProperty('lastName');
  });

  it('code inconnu : refusé et remonté au journal', async () => {
    const { service, repos, auditService } = makeService();
    repos.badges.findOneBy.mockResolvedValue(null);

    const result = await service.lookup(1, 'inconnu', 3);

    expect(result.verdict).toBe(AccessScanVerdict.REJECTED_UNKNOWN);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UNKNOWN_CODE_LOOKUP' }),
    );
  });

  it('badge révoqué : refusé par la base à jour', async () => {
    const { service, repos } = makeService();
    repos.badges.findOneBy.mockResolvedValue({ id: 8, status: AccessBadgeStatus.LOST });
    repos.assignments.findOne.mockResolvedValue(null);

    const result = await service.lookup(1, 'code-1', 3);

    expect(result.verdict).toBe(AccessScanVerdict.REJECTED_REVOKED);
  });

  it('limite le débit : au-delà du quota, 429 + journal', async () => {
    const { service, repos, auditService, rateLimiter } = makeService();
    repos.badges.findOneBy.mockResolvedValue(null);

    for (let i = 0; i < 20; i += 1) {
      await service.lookup(1, `code-${i}`, 3);
    }
    await expect(service.lookup(1, 'un-de-trop', 3)).rejects.toBeInstanceOf(HttpException);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOOKUP_RATE_LIMITED' }),
    );
    rateLimiter.reset();
  });
});

describe('late offline collection safeguards', () => {
  it('collects an expired session and flags its events for review', async () => {
    const { service, repos, sessionsService } = makeService();
    sessionsService.findOwnedSession.mockResolvedValue({ id: 11, userId: 1, zoneId: 1, expiresAt: new Date(0), startedAt: new Date(0), closedAt: null });
    repos.badges.findOneBy.mockResolvedValue(null);
    await service.upload(11, 1, { scans: [scan()] });
    expect(repos.events.save).toHaveBeenCalledWith(expect.objectContaining({ needsReview: true, sessionId: 11 }));
  });
  it('refuses a point outside the session zone', async () => {
    const { service, sessionsService } = makeService();
    sessionsService.findOwnedSession.mockResolvedValue({ id: 11, zoneId: 99 });
    await expect(service.upload(11, 1, { scans: [scan()] })).rejects.toThrow('hors de la zone');
  });
});
