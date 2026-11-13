import { describe, it, expect, vi } from 'vitest';
import { ExpectedScanPolicyService } from './expected-scan-policy.service';
import { AccessBadge, AccessBadgeAssignment, AccessScanEvent, AccessScanPoint } from '../entities';
function setup() {
  const state = {
    permission: true,
    revoked: false,
    duplicate: false,
    sessionClosed: false,
    verdict: 'REJECTED_NOT_EXPECTED',
    review: false,
    existing: null as Record<string, unknown> | null,
  };
  const event = {
    id: 7,
    sessionId: 11,
    participantId: 42,
    assignmentId: 5,
    badgeId: 8,
    pointId: 3,
    code: 'not-output',
    verdict: 'REJECTED_NOT_EXPECTED',
    needsReview: false,
    receivedAt: new Date(),
  };
  const saveEvent = vi.fn(async (e) => ({ id: 99, ...e })),
    audit = vi.fn();
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith('SELECT * FROM access_passage_exceptions'))
      return state.existing ? [state.existing] : [];
    if (sql.startsWith('SELECT * FROM access_scan_sessions'))
      return [
        {
          id: 11,
          zone_id: 1,
          closedAt: state.sessionClosed ? new Date() : null,
          expiresAt: new Date(Date.now() + 1000000),
        },
      ];
    if (sql.includes('FROM access_exception_grants')) return state.permission ? [{ id: 1 }] : [];
    if (sql.includes('FROM access_scanner_grants')) return [{ id: 1 }];
    if (sql.includes('SELECT x.id')) return [{ id: 4, groupId: 2, groupName: 'Repas' }];
    if (sql.startsWith('SELECT id FROM access_scan_events'))
      return state.duplicate ? [{ id: 88 }] : [];
    if (sql.startsWith('INSERT INTO access_passage_exceptions')) return [{ id: 55 }];
    return [];
  });
  const manager = {
    query,
    getRepository: (entity: unknown) => {
      if (entity === AccessScanEvent)
        return {
          findOne: async () => ({ ...event, verdict: state.verdict, needsReview: state.review }),
          create: (x: unknown) => x,
          save: saveEvent,
        };
      if (entity === AccessScanPoint)
        return {
          findOne: async () => ({
            id: 3,
            active: true,
            zone: { allowedPersonTypes: null },
            scanTypeId: 2,
            serviceKey: 'midi',
            scanType: { duplicateRule: 'UNIQUE_PER_SERVICE' },
          }),
        };
      if (entity === AccessBadgeAssignment)
        return {
          findOne: async () => ({
            id: 5,
            badgeId: 8,
            participantId: 42,
            endsAt: null,
            participant: { type: 'JEUNE' },
          }),
        };
      if (entity === AccessBadge)
        return { findOne: async () => ({ id: 8, status: state.revoked ? 'REVOKED' : 'ASSIGNED' }) };
      return { save: audit };
    },
  };
  const service = new ExpectedScanPolicyService({
    transaction: (fn: (m: unknown) => unknown) => fn(manager),
    manager,
  } as never);
  return { service, state, saveEvent, audit, query };
}
describe('Expected group exception policy', () => {
  it('requires explicit point permission; ADMIN role alone does not substitute', async () => {
    const { service, state, saveEvent } = setup();
    state.permission = false;
    await expect(
      service.override(11, 1, 7, 4, 'Accompagne équipe', 'operation-123'),
    ).rejects.toThrow('Droit');
    expect(saveEvent).not.toHaveBeenCalled();
  });
  it.each(['REJECTED_REVOKED', 'REJECTED_UNKNOWN', 'DUPLICATE', 'REJECTED_NO_RIGHT'])(
    'never overrides %s',
    async (verdict) => {
      const { service, state, saveEvent } = setup();
      state.verdict = verdict;
      await expect(
        service.override(11, 1, 7, 4, 'Accompagne équipe', 'operation-123'),
      ).rejects.toThrow('Seul');
      expect(saveEvent).not.toHaveBeenCalled();
    },
  );
  it('rechecks revocation and duplicate after the initial refusal', async () => {
    for (const flag of ['revoked', 'duplicate'] as const) {
      const { service, state, saveEvent } = setup();
      state[flag] = true;
      await expect(
        service.override(11, 1, 7, 4, 'Accompagne équipe', 'operation-123'),
      ).rejects.toThrow();
      expect(saveEvent).not.toHaveBeenCalled();
    }
  });
  it('rejects an ambiguous/expired session or inactive selected passage', async () => {
    for (const flag of ['review', 'sessionClosed'] as const) {
      const { service, state, saveEvent } = setup();
      state[flag] = true;
      await expect(
        service.override(11, 1, 7, 4, 'Accompagne équipe', 'operation-123'),
      ).rejects.toThrow();
      expect(saveEvent).not.toHaveBeenCalled();
    }
    const { service } = setup();
    await expect(
      service.override(11, 1, 7, 999, 'Accompagne équipe', 'operation-123'),
    ).rejects.toThrow('actif');
  });
  it('records a separate accepted event plus passage-only exception and audit atomically', async () => {
    const { service, saveEvent, audit, query } = setup();
    expect(await service.override(11, 1, 7, 4, ' Accompagne équipe ', 'operation-123')).toEqual({
      verdict: 'ACCEPTED',
      exceptionId: 55,
      eventId: 99,
    });
    expect(saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: 42, needsReview: false, verdict: 'ACCEPTED' }),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO access_passage_exceptions'),
      [4, 42, 1, 11, 'Accompagne équipe', 7, 99, 'operation-123'],
    );
    expect(audit).toHaveBeenCalled();
  });
  it('replays only the same authorized operation, without a second passage', async () => {
    const { service, state, saveEvent } = setup();
    state.existing = {
      id: 55,
      authorized_by: 1,
      refused_event_id: 7,
      passage_id: 4,
      session_id: 11,
      reason: 'Accompagne équipe',
      accepted_event_id: 99,
    };
    expect(await service.override(11, 1, 7, 4, 'Accompagne équipe', 'operation-123')).toMatchObject(
      { eventId: 99 },
    );
    expect(saveEvent).not.toHaveBeenCalled();
    await expect(
      service.override(11, 2, 7, 4, 'Accompagne équipe', 'operation-123'),
    ).rejects.toThrow('utilisé');
  });
  it('rejects blank motives before reading the database', async () => {
    const { service, query } = setup();
    await expect(service.override(11, 1, 7, 4, ' ', 'operation-123')).rejects.toThrow('Motif');
    expect(query).not.toHaveBeenCalled();
  });
});
