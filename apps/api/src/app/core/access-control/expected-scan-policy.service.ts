import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AccessAuditAction,
  AccessAuditLog,
  AccessBadge,
  AccessBadgeAssignment,
  AccessScanDuplicateRule,
  AccessScanEvent,
  AccessScanPoint,
  AccessScanVerdict,
} from '../entities';
import { EXPECTED_GROUP_MEMBERS_CTE } from '../access-reporting/access-expected-groups.sql';

@Injectable()
export class ExpectedScanPolicyService {
  constructor(private readonly db: DataSource) {}
  async candidates(
    pointId: number,
    scanTypeId: number,
    serviceKey: string | null,
    at: Date,
    m: EntityManager = this.db.manager,
  ) {
    return m.query(
      `SELECT x.id,x.group_id AS "groupId",g.name AS "groupName" FROM access_expected_passages x JOIN access_expected_groups g ON g.id=x.group_id WHERE x.point_id=$1 AND x.scan_type_id=$2 AND x.service_key IS NOT DISTINCT FROM $3 AND x.starts_at<=$4 AND x.ends_at>$4 AND x.archived_at IS NULL AND g.archived_at IS NULL ORDER BY x.id`,
      [pointId, scanTypeId, serviceKey, at],
    );
  }
  async check(
    pointId: number,
    scanTypeId: number,
    serviceKey: string | null,
    participantId: number,
    at: Date,
    m: EntityManager = this.db.manager,
  ): Promise<boolean> {
    const passages = await this.candidates(pointId, scanTypeId, serviceKey, at, m);
    for (const x of passages) {
      const rows = await m.query(
        `${EXPECTED_GROUP_MEMBERS_CTE} SELECT 1 FROM members WHERE "participantId"=$2 UNION ALL SELECT 1 FROM access_passage_exceptions WHERE passage_id=$3 AND participant_id=$2 LIMIT 1`,
        [x.groupId, participantId, x.id],
      );
      if (rows.length) return true;
    }
    return passages.length === 0;
  }
  async canOverride(userId: number, pointId: number, m: EntityManager = this.db.manager) {
    const rows = await m.query(
      'SELECT id FROM access_exception_grants WHERE user_id=$1 AND point_id=$2 AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now())',
      [userId, pointId],
    );
    return rows.length > 0;
  }
  grants() {
    return this.db.query(
      `SELECT x.id,x.user_id AS "userId",u.email,x.point_id AS "pointId",p.name AS "pointName",x.starts_at AS "startsAt",x.ends_at AS "endsAt" FROM access_exception_grants x JOIN users u ON u.id=x.user_id JOIN access_scan_points p ON p.id=x.point_id ORDER BY x.id DESC`,
    );
  }
  async grant(userId: number, pointId: number, actorId: number) {
    return this.db.transaction(async (m) => {
      const [row] = await m.query(
        `INSERT INTO access_exception_grants(user_id,point_id,created_by) VALUES($1,$2,$3) RETURNING *`,
        [userId, pointId, actorId],
      );
      await m.getRepository(AccessAuditLog).save({
        userId: actorId,
        action: AccessAuditAction.CONFIG_CHANGED,
        entityType: 'access_exception_grants',
        entityId: row.id,
      });
      return row;
    });
  }
  async revoke(id: number, actorId: number) {
    return this.db.transaction(async (m) => {
      const [row] = await m.query(
        'UPDATE access_exception_grants SET ends_at=now() WHERE id=$1 RETURNING *',
        [id],
      );
      if (!row) throw new BadRequestException('Droit introuvable');
      await m.getRepository(AccessAuditLog).save({
        userId: actorId,
        action: AccessAuditAction.CONFIG_CHANGED,
        entityType: 'access_exception_grants',
        entityId: id,
      });
      return row;
    });
  }
  async override(
    sessionId: number,
    userId: number,
    eventId: number,
    passageId: number,
    reason: string,
    operationId: string,
  ) {
    if (reason.trim().length < 3 || reason.length > 300 || !operationId || operationId.length > 80)
      throw new BadRequestException('Motif court et identifiant requis');
    return this.db.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [operationId]);
      const [existing] = await m.query(
        'SELECT * FROM access_passage_exceptions WHERE operation_id=$1',
        [operationId],
      );
      if (existing) {
        if (
          existing.authorized_by !== userId ||
          existing.refused_event_id !== eventId ||
          existing.passage_id !== passageId ||
          existing.session_id !== sessionId ||
          existing.reason !== reason.trim()
        )
          throw new ConflictException('Identifiant déjà utilisé');
        return {
          verdict: AccessScanVerdict.ACCEPTED,
          exceptionId: existing.id,
          eventId: existing.accepted_event_id,
        };
      }
      const [session] = await m.query(
        'SELECT * FROM access_scan_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [sessionId, userId],
      );
      if (!session || session.closedAt || new Date(session.expiresAt) <= new Date())
        throw new ForbiddenException('Session terminée');
      const event = await m
        .getRepository(AccessScanEvent)
        .findOne({ where: { id: eventId }, lock: { mode: 'pessimistic_write' } });
      if (
        !event ||
        event.sessionId !== sessionId ||
        event.verdict !== AccessScanVerdict.REJECTED_NOT_EXPECTED ||
        !event.participantId ||
        !event.assignmentId ||
        !event.badgeId ||
        event.needsReview
      )
        throw new BadRequestException('Seul le refus hors groupe de cette session est dérogeable');
      if (Date.now() - new Date(event.receivedAt).getTime() > 300000)
        throw new ConflictException('Refus trop ancien, rescanner');
      if (!(await this.canOverride(userId, event.pointId, m)))
        throw new ForbiddenException('Droit exception absent pour ce point');
      const grant = await m.query(
        'SELECT id FROM access_scanner_grants WHERE user_id=$1 AND (zone_id IS NULL OR zone_id=$2) AND "startsAt"<=now() AND ("endsAt" IS NULL OR "endsAt">now())',
        [userId, session.zone_id],
      );
      if (!grant.length) throw new ForbiddenException('Habilitation scanner expirée');
      await m.query('SELECT id FROM access_scan_points WHERE id=$1 FOR SHARE', [event.pointId]);
      const point = await m.getRepository(AccessScanPoint).findOne({
        where: { id: event.pointId },
        relations: { zone: true, scanType: true },
      });
      if (!point?.active) throw new BadRequestException('Point inactif');
      await m.query('SELECT pg_advisory_xact_lock($1,$2)', [21027, point.scanTypeId]);
      await m.query('SELECT id FROM access_badge_assignments WHERE id=$1 FOR SHARE', [
        event.assignmentId,
      ]);
      const assignment = await m.getRepository(AccessBadgeAssignment).findOne({
        where: { id: event.assignmentId },
        relations: { participant: true },
      });
      const badge = await m
        .getRepository(AccessBadge)
        .findOne({ where: { id: event.badgeId }, lock: { mode: 'pessimistic_read' } });
      if (
        !assignment ||
        assignment.endsAt ||
        assignment.participantId !== event.participantId ||
        !badge ||
        badge.status !== 'ASSIGNED' ||
        assignment.badgeId !== badge.id
      )
        throw new ForbiddenException('Badge révoqué ou remplacé, rescanner');
      if (
        point.zone.allowedPersonTypes?.length &&
        !point.zone.allowedPersonTypes.includes(assignment.participant.type)
      )
        throw new ForbiddenException('Restriction de sécurité non dérogeable');
      const passages = await this.candidates(
        point.id,
        point.scanTypeId,
        point.serviceKey,
        new Date(),
        m,
      );
      if (!passages.some((p: { id: number }) => p.id === passageId))
        throw new BadRequestException('Groupe/passage non actif à ce point');
      if (point.scanType.duplicateRule !== AccessScanDuplicateRule.ALLOW) {
        const sql =
          point.scanType.duplicateRule === AccessScanDuplicateRule.UNIQUE_PER_SERVICE
            ? 'service_key IS NOT DISTINCT FROM $3'
            : "received_at>=date_trunc('day',now()) AND received_at<date_trunc('day',now())+interval '1 day'";
        const params: unknown[] = [event.participantId, point.scanTypeId];
        if (point.scanType.duplicateRule === AccessScanDuplicateRule.UNIQUE_PER_SERVICE)
          params.push(point.serviceKey);
        if (
          (
            await m.query(
              `SELECT id FROM access_scan_events WHERE participant_id=$1 AND scan_type_id=$2 AND verdict='ACCEPTED' AND ${sql} LIMIT 1`,
              params,
            )
          ).length
        )
          throw new ConflictException('Passage déjà enregistré');
      }
      const repo = m.getRepository(AccessScanEvent);
      const accepted = await repo.save(
        repo.create({
          sessionId,
          assignmentId: assignment.id,
          participantId: event.participantId,
          badgeId: badge.id,
          code: event.code,
          tableVersion: event.tableVersion,
          pointId: point.id,
          scanTypeId: point.scanTypeId,
          serviceKey: point.serviceKey,
          verdict: AccessScanVerdict.ACCEPTED,
          needsReview: false,
          occurredAtLocal: new Date(),
          clientEventId: `exception:${operationId}`,
        }),
      );
      const [exception] = await m.query(
        `INSERT INTO access_passage_exceptions(passage_id,participant_id,authorized_by,session_id,reason,refused_event_id,accepted_event_id,operation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          passageId,
          event.participantId,
          userId,
          sessionId,
          reason.trim(),
          eventId,
          accepted.id,
          operationId,
        ],
      );
      await m.getRepository(AccessAuditLog).save({
        userId,
        action: AccessAuditAction.CONFIG_CHANGED,
        entityType: 'access_passage_exceptions',
        entityId: exception.id,
        details: { eventId, acceptedEventId: accepted.id, passageId },
      });
      return {
        verdict: AccessScanVerdict.ACCEPTED,
        exceptionId: exception.id,
        eventId: accepted.id,
      };
    });
  }
}
