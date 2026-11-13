import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccessScanEvent } from '../entities/access-scan-event.entity';
import { AccessScanReview } from './access-scan-review.entity';
import { AccessReportQuery, ReviewListQuery } from './access-reporting.types';


export const ACCESS_REPORT_SQL = {
  counts: `SELECT p.zone_id AS "zoneId", z.name AS "zoneName",
        e.scan_type_id AS "scanTypeId", t.label AS "scanTypeLabel", e.service_key AS "serviceKey",
        count(*) FILTER (WHERE e.verdict = 'ACCEPTED' AND NOT e.needs_review)::int AS accepted,
        count(*) FILTER (WHERE e.verdict = 'ACCEPTED' AND e.needs_review)::int AS uncertain,
        count(*) FILTER (WHERE e.verdict = 'DUPLICATE')::int AS duplicates,
        count(*) FILTER (WHERE e.verdict NOT IN ('ACCEPTED','DUPLICATE'))::int AS rejected
        FROM access_scan_events e JOIN access_scan_points p ON p.id=e.point_id
        JOIN access_zones z ON z.id=p.zone_id JOIN access_scan_types t ON t.id=e.scan_type_id
        WHERE coalesce(e.occurred_at_local,e.received_at) >= $1 AND coalesce(e.occurred_at_local,e.received_at) < $2
        AND ($3::int IS NULL OR p.zone_id=$3)
        GROUP BY p.zone_id,z.name,e.scan_type_id,t.label,e.service_key ORDER BY p.zone_id,e.scan_type_id,e.service_key`,
  presence: `WITH latest AS (
          SELECT DISTINCT ON (e.participant_id,p.zone_id) e.participant_id,p.zone_id,e.scan_type_id
          FROM access_scan_events e JOIN access_scan_points p ON p.id=e.point_id
          WHERE e.verdict='ACCEPTED' AND NOT e.needs_review AND e.participant_id IS NOT NULL
          AND coalesce(e.occurred_at_local,e.received_at) < $1
          AND ($2::int IS NULL OR p.zone_id=$2) AND e.scan_type_id IN ($3,$4)
          ORDER BY e.participant_id,p.zone_id,coalesce(e.occurred_at_local,e.received_at) DESC,e.id DESC
        ) SELECT participant_id AS "participantId",zone_id AS "zoneId" FROM latest WHERE scan_type_id=$3`,
  metadata: `SELECT max(e.received_at) AS "lastReceivedAt",
        count(*) FILTER (WHERE (e.needs_review OR e.verdict='DUPLICATE') AND r.event_id IS NULL)::int AS "pendingReviews"
        FROM access_scan_events e JOIN access_scan_points p ON p.id=e.point_id
        LEFT JOIN access_scan_reviews r ON r.event_id=e.id
        WHERE ($1::int IS NULL OR p.zone_id=$1)`,
  reviews: `SELECT e.id,e.participant_id AS "participantId", p."firstName" AS "firstName",CASE WHEN p.type='JEUNE' THEN NULL ELSE p."lastName" END AS "lastName",
      e.verdict,e.needs_review AS "needsReview",e.occurred_at_local AS "occurredAtLocal",e.received_at AS "receivedAt",
      e.point_id AS "pointId",pt.name AS "pointName",pt.zone_id AS "zoneId",count(*) OVER()::int AS "totalCount"
      FROM access_scan_events e LEFT JOIN participants p ON p.id=e.participant_id
      JOIN access_scan_points pt ON pt.id=e.point_id LEFT JOIN access_scan_reviews r ON r.event_id=e.id
      WHERE (e.needs_review OR e.verdict='DUPLICATE') AND r.event_id IS NULL AND ($1::int IS NULL OR pt.zone_id=$1)
      ORDER BY e.id DESC LIMIT $2 OFFSET $3`,
};

export const REPORT_MAX_DAYS = 31;
export function validateReportRange(q: AccessReportQuery): void {
  const from = Date.parse(q.from), to = Date.parse(q.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > REPORT_MAX_DAYS * 86400000) {
    throw new BadRequestException('Période attendue : de 1 seconde à 31 jours');
  }
  if (!!q.entryTypeId !== !!q.exitTypeId || (q.entryTypeId != null && q.entryTypeId === q.exitTypeId)) {
    throw new BadRequestException('Choisir deux types distincts pour les entrées et sorties');
  }
}
@Injectable()
export class AccessReportingService {
  constructor(private readonly db: DataSource) {}

  async summary(q: AccessReportQuery) {
    validateReportRange(q);
    return this.db.transaction('REPEATABLE READ', async manager => {
      // All queries see one consistent database snapshot. Bind all user values.
      const parameters = [q.from, q.to, q.zoneId ?? null];
      const counts = await manager.query(ACCESS_REPORT_SQL.counts, parameters);
      let presence: {estimatedPresent:number; byZone: {zoneId:number; present:number}[]} | null = null;
      if (q.entryTypeId && q.exitTypeId) {
        // A carry-in entry before `from` still counts at `to`. Re-entries and
        // badge replacement are keyed by participant, never by QR/badge.
        const rows = await manager.query(ACCESS_REPORT_SQL.presence, [q.to,q.zoneId ?? null,q.entryTypeId,q.exitTypeId]);
        const byZone = new Map<number,number>(); const people = new Set<number>();
        for (const row of rows) { people.add(row.participantId); byZone.set(row.zoneId,(byZone.get(row.zoneId) ?? 0)+1); }
        presence = {estimatedPresent:people.size,byZone:[...byZone].map(([zoneId,present])=>({zoneId,present}))};
      }
      const [metadata] = await manager.query(ACCESS_REPORT_SQL.metadata, [q.zoneId ?? null]);
      return {from:q.from,to:q.to,zoneId:q.zoneId ?? null,counts,presence,...metadata,fetchedAt:new Date().toISOString(),
        caveat:'Estimation sur scans reçus uniquement. Téléphones hors ligne non inclus. Ne pas utiliser comme décompte d’évacuation.'};
    });
  }

  async reviews(q: ReviewListQuery) {
    const parameters=[q.zoneId ?? null,q.limit ?? 50,q.offset ?? 0];
    const items = await this.db.query(ACCESS_REPORT_SQL.reviews,parameters);
    return {items:items.map(({totalCount: _total,...item}: Record<string,unknown>)=>item), total:items[0]?.totalCount ?? 0};
  }

  async closeReview(eventId:number,reviewerId:number,note:string) {
    if (note.trim().length < 3) throw new BadRequestException('Un motif est requis');
    return this.db.transaction(async manager=>{
      const event=await manager.getRepository(AccessScanEvent).findOne({where:{id:eventId},lock:{mode:'pessimistic_write'}});
      if (!event) throw new NotFoundException('Scan introuvable');
      if (!event.needsReview && event.verdict !== 'DUPLICATE') throw new BadRequestException('Ce scan ne nécessite pas de vérification');
      const repo=manager.getRepository(AccessScanReview), existing=await repo.findOneBy({eventId});
      if (existing) {
        if (existing.note===note.trim() && existing.reviewerId===reviewerId) return existing;
        throw new ConflictException('Vérification déjà close');
      }
      return repo.save(repo.create({eventId,reviewerId,note:note.trim()}));
    });
  }
}
