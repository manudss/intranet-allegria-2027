import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REPORT_DETAIL_SQL } from './access-reporting-details.sql';
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
      const [count] = await m.query(REPORT_DETAIL_SQL.eventCount, params);
      const items = await m.query(REPORT_DETAIL_SQL.events, [
        ...params,
        q.limit ?? 50,
        q.offset ?? 0,
      ]);
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
