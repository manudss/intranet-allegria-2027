import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolunteerAuditAction, VolunteerAuditLog } from '../entities';
import { SearchVolunteerAuditLogsQueryDto } from './volunteer-audit-logs.types';

type AuditLogPayload = {
  userId: number;
  action: VolunteerAuditAction;
  entityType: string;
  entityId: number;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
};

@Injectable()
export class VolunteerAuditLogsService {
  constructor(
    @InjectRepository(VolunteerAuditLog)
    private readonly volunteerAuditLogsRepository: Repository<VolunteerAuditLog>,
  ) {}

  async createLog(payload: AuditLogPayload): Promise<VolunteerAuditLog> {
    const log = this.volunteerAuditLogsRepository.create(payload);
    return this.volunteerAuditLogsRepository.save(log);
  }

  async search(query: SearchVolunteerAuditLogsQueryDto) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const qb = this.volunteerAuditLogsRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC')
      .addOrderBy('log.id', 'DESC');

    if (query.userId !== undefined && query.userId !== null && query.userId !== '') {
      qb.andWhere('log.user_id = :userId', { userId: Number(query.userId) });
    }

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }

    if (query.entityType?.trim()) {
      qb.andWhere('log.entityType = :entityType', { entityType: query.entityType.trim() });
    }

    if (query.from?.trim()) {
      qb.andWhere('log.createdAt >= :from', { from: this.parseDate(query.from, 'from') });
    }

    if (query.to?.trim()) {
      qb.andWhere('log.createdAt <= :to', { to: this.parseDate(query.to, 'to') });
    }

    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  private parseDate(value: string, fieldName: string): string {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} est invalide`);
    }

    return parsed.toISOString();
  }
}

