import { describe, expect, it, vi } from 'vitest';
import { VolunteerAuditAction } from '../entities';
import { VolunteerAuditLogSubscriber } from './volunteer-audit-log.subscriber';

describe('VolunteerAuditLogSubscriber', () => {
  const buildSubscriber = () => {
    const createLog = vi.fn().mockResolvedValue(undefined);
    const dataSource = { subscribers: [] as unknown[] };
    const subscriber = new VolunteerAuditLogSubscriber(
      dataSource as never,
      { createLog } as never,
      { getUserId: () => 42 } as never,
    );

    return { subscriber, createLog };
  };

  it('journalise un changement de statut', async () => {
    const { subscriber, createLog } = buildSubscriber();

    await subscriber.afterUpdate({
      metadata: { tableName: 'volunteer_shifts' },
      entityId: 7,
      databaseEntity: { id: 7, status: 'TODO' },
      entity: { id: 7, status: 'DONE' },
      updatedColumns: [{ propertyName: 'status' }],
    } as never);

    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        action: VolunteerAuditAction.STATUS_CHANGED,
        entityType: 'volunteer_shifts',
        entityId: 7,
      }),
    );
  });

  it('retire les champs sensibles', async () => {
    const { subscriber, createLog } = buildSubscriber();

    await subscriber.afterUpdate({
      metadata: { tableName: 'volunteers' },
      entityId: 5,
      databaseEntity: { id: 5, notes: 'old', token: 'secret' },
      entity: { id: 5, notes: 'new', passwordHash: 'hash' },
      updatedColumns: [
        { propertyName: 'notes' },
        { propertyName: 'token' },
        { propertyName: 'passwordHash' },
      ],
    } as never);

    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeData: { id: 5, notes: 'old' },
        afterData: { id: 5, notes: 'new' },
      }),
    );
  });

  it('ignore les tables non suivies', async () => {
    const { subscriber, createLog } = buildSubscriber();

    await subscriber.afterInsert({
      metadata: { tableName: 'users' },
      entityId: 1,
      entity: { id: 1, email: 'admin@example.org' },
    } as never);

    expect(createLog).not.toHaveBeenCalled();
  });
});
