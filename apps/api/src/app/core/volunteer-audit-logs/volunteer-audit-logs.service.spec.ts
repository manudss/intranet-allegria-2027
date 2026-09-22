import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerAuditAction } from '../entities';
import { VolunteerAuditLogsService } from './volunteer-audit-logs.service';

describe('VolunteerAuditLogsService', () => {
  it('applique pagination et filtres', async () => {
    const getManyAndCount = vi.fn().mockResolvedValue([[{ id: 1 }], 1]);
    const qb = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount,
    };

    const repository = {
      create: vi.fn((payload) => payload),
      save: vi.fn(async (payload) => ({ id: 12, ...payload })),
      createQueryBuilder: vi.fn(() => qb),
    };

    const service = new VolunteerAuditLogsService(repository as never);
    const result = await service.search({
      limit: '10',
      offset: '20',
      userId: '3',
      action: VolunteerAuditAction.UPDATE,
      entityType: 'volunteer_shifts',
      from: '2027-07-20T00:00:00.000Z',
      to: '2027-07-27T23:59:59.999Z',
    });

    expect(result.total).toBe(1);
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(qb.andWhere).toHaveBeenCalledTimes(5);
  });

  it('rejette une date invalide', async () => {
    const repository = {
      createQueryBuilder: vi.fn(() => ({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn(),
      })),
    };

    const service = new VolunteerAuditLogsService(repository as never);
    await expect(service.search({ from: 'not-a-date' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
