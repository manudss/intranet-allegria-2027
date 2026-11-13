import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  REPORT_DETAIL_SQL,
  SCANNED_PEOPLE_CTE,
  REPORT_EVENT_FILTER,
  groupEventFilter,
} from './access-reporting-details.sql';
import { ReportDetailQuery } from './access-reporting-details.types';
import { validateReportRange } from './access-reporting.service';

export function detailParameters(q: ReportDetailQuery): unknown[] {
  const search = q.q?.trim();
  return [
    q.from,
    q.to,
    q.zoneId ?? null,
    q.pointId ?? null,
    q.scanTypeId ?? null,
    q.serviceKey ?? null,
    q.participantId ?? null,
    q.teamId ?? null,
    q.personType ?? null,
    search ? `%${search.replace(/[!%_]/g, '!$&')}%` : null,
    q.verdict ?? null,
  ];
}
@Injectable()
export class AccessReportingDetailsService {
  constructor(private readonly db: DataSource) {}

  async events(q: ReportDetailQuery) {
    validateReportRange(q);
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const params = detailParameters(q);
      const groupFilter = groupEventFilter(q.expectedGroupId ?? null);
      const countSql = REPORT_DETAIL_SQL.eventCount.replace(
        REPORT_EVENT_FILTER,
        groupFilter.split('$14').join('$12'),
      );
      const [count] = await m.query(
        countSql,
        q.expectedGroupId ? [...params, q.expectedGroupId] : params,
      );
      const items = await m.query(
        REPORT_DETAIL_SQL.events.replace(REPORT_EVENT_FILTER, groupFilter),
        [
          ...params,
          q.limit ?? 50,
          q.offset ?? 0,
          ...(q.expectedGroupId ? [q.expectedGroupId] : []),
        ],
      );
      return {
        items,
        total: count.total,
        limit: q.limit ?? 50,
        offset: q.offset ?? 0,
        membershipBasis: 'CURRENT',
        fetchedAt: new Date().toISOString(),
      };
    });
  }

  async scanned(q: ReportDetailQuery) {
    validateReportRange(q);
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const params = detailParameters(q);
      const [c] = await m.query(
        `${SCANNED_PEOPLE_CTE} SELECT count(*)::int AS total FROM latest`,
        params,
      );
      const items = await m.query(
        `${SCANNED_PEOPLE_CTE} SELECT * FROM latest ORDER BY coalesce("occurredAtLocal","receivedAt") DESC,id DESC LIMIT $12 OFFSET $13`,
        [...params, q.limit, q.offset],
      );
      return { items, total: c.total, fetchedAt: new Date().toISOString() };
    });
  }

  async dashboard(q: ReportDetailQuery) {
    validateReportRange(q);
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const params = detailParameters(q);
      const points = await m.query(REPORT_DETAIL_SQL.dashboard, params);
      const [totals] = await m.query(REPORT_DETAIL_SQL.totals, params);
      return {
        points,
        totals,
        from: q.from,
        to: q.to,
        fetchedAt: new Date().toISOString(),
        caveat:
          'Scans reçus uniquement. Personnes distinctes par point non additionnables. Les vérifications peuvent recouper les refus et doublons. Pas un décompte d’évacuation.',
      };
    });
  }
}
