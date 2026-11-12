import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AccessAuditAction, AccessAuditLog } from '../entities';

type AuditEntry = {
  userId: number | null;
  action: AccessAuditAction;
  entityType: string;
  entityId?: number | null;
  details?: Record<string, unknown> | null;
};

@Injectable()
export class AccessAuditService {
  constructor(
    @InjectRepository(AccessAuditLog)
    private readonly auditRepository: Repository<AccessAuditLog>,
  ) {}

  /** Écrit une ligne de journal, dans la transaction courante si fournie. */
  async record(entry: AuditEntry, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AccessAuditLog) : this.auditRepository;
    await repo.save(
      repo.create({
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        details: entry.details ?? null,
      }),
    );
  }

  async search(query: {
    action?: AccessAuditAction;
    userId?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AccessAuditLog[]; total: number }> {
    const qb = this.auditRepository
      .createQueryBuilder('log')
      .orderBy('log.id', 'DESC')
      .take(Math.min(query.limit ?? 50, 200))
      .skip(query.offset ?? 0);

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}
