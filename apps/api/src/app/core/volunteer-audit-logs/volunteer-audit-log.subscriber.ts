import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  ObjectLiteral,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { VolunteerAuditAction } from '../entities';
import { AuditContextService } from './audit-context.service';
import { VolunteerAuditLogsService } from './volunteer-audit-logs.service';

const TRACKED_TABLES = new Set([
  'volunteers',
  'volunteer_teams',
  'volunteer_team_memberships',
  'volunteer_skills',
  'volunteer_tags',
  'volunteer_availabilities',
  'volunteer_missions',
  'volunteer_shifts',
  'volunteer_shift_assignments',
]);

const ASSIGNMENT_TABLES = new Set(['volunteer_team_memberships', 'volunteer_shift_assignments']);

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'healthdata',
]);

@Injectable()
@EventSubscriber()
export class VolunteerAuditLogSubscriber implements EntitySubscriberInterface<ObjectLiteral> {
  constructor(
    dataSource: DataSource,
    private readonly volunteerAuditLogsService: VolunteerAuditLogsService,
    private readonly auditContextService: AuditContextService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Object;
  }

  async afterInsert(event: InsertEvent<ObjectLiteral>): Promise<void> {
    await this.writeLog(
      event.metadata.tableName,
      this.resolveEntityId(event),
      VolunteerAuditAction.CREATE,
      null,
      event.entity,
      [],
    );
  }

  async afterUpdate(event: UpdateEvent<ObjectLiteral>): Promise<void> {
    const entityId = this.resolveEntityId(event);
    const before = event.databaseEntity;
    const after = event.entity;
    const changedColumns = event.updatedColumns.map((column) => column.propertyName);

    if (entityId === null || changedColumns.length === 0) {
      return;
    }

    const action = this.resolveUpdateAction(event.metadata.tableName, changedColumns);
    await this.writeLog(event.metadata.tableName, entityId, action, before, after, changedColumns);
  }

  async afterRemove(event: RemoveEvent<ObjectLiteral>): Promise<void> {
    await this.writeLog(
      event.metadata.tableName,
      this.resolveEntityId(event),
      VolunteerAuditAction.DELETE,
      event.databaseEntity,
      null,
      [],
    );
  }

  private async writeLog(
    tableName: string,
    entityId: number | null,
    action: VolunteerAuditAction,
    beforeEntity: ObjectLiteral | undefined | null,
    afterEntity: ObjectLiteral | undefined | null,
    changedColumns: readonly string[],
  ): Promise<void> {
    if (!TRACKED_TABLES.has(tableName) || entityId === null) {
      return;
    }

    const userId = this.auditContextService.getUserId();
    if (userId === null) {
      return;
    }

    const beforeData = this.toFilteredData(beforeEntity, changedColumns);
    const afterData = this.toFilteredData(afterEntity, changedColumns);

    if (action === VolunteerAuditAction.UPDATE && this.areEqual(beforeData, afterData)) {
      return;
    }

    await this.volunteerAuditLogsService.createLog({
      userId,
      action,
      entityType: tableName,
      entityId,
      beforeData,
      afterData,
    });
  }

  private toFilteredData(
    source: ObjectLiteral | undefined | null,
    changedColumns: readonly string[],
  ): Record<string, unknown> | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const keys = Object.keys(source);
    const keySet = changedColumns.length > 0 ? new Set([...changedColumns, 'id']) : null;

    const filtered: Record<string, unknown> = {};
    for (const key of keys) {
      if (keySet && !keySet.has(key)) {
        continue;
      }
      if (this.isSensitiveKey(key)) {
        continue;
      }
      const sanitized = this.sanitizeValue(source[key]);
      if (sanitized !== undefined) {
        filtered[key] = sanitized;
      }
    }

    return Object.keys(filtered).length > 0 ? filtered : null;
  }

  private sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const objectValue = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(objectValue)) {
      if (this.isSensitiveKey(key)) {
        continue;
      }
      const sanitized = this.sanitizeValue(nested);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }

    return result;
  }

  private isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEYS.has(key.toLowerCase());
  }

  private resolveUpdateAction(
    tableName: string,
    changedColumns: readonly string[],
  ): VolunteerAuditAction {
    if (changedColumns.includes('status')) {
      return VolunteerAuditAction.STATUS_CHANGED;
    }

    if (ASSIGNMENT_TABLES.has(tableName)) {
      return VolunteerAuditAction.ASSIGNMENT_CHANGED;
    }

    return VolunteerAuditAction.UPDATE;
  }

  private resolveEntityId(event: {
    entityId?: unknown;
    entity?: ObjectLiteral | undefined;
    databaseEntity?: ObjectLiteral | undefined;
  }): number | null {
    const candidates = [event.entityId, event.entity?.id, event.databaseEntity?.id];

    for (const candidate of candidates) {
      if (typeof candidate === 'number') {
        return candidate;
      }

      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        const numeric = Number(candidate);
        if (Number.isInteger(numeric)) {
          return numeric;
        }
      }
    }

    return null;
  }

  private areEqual(
    left: Record<string, unknown> | null,
    right: Record<string, unknown> | null,
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}
