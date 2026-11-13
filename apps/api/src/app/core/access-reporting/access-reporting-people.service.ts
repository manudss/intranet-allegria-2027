import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExpectedPageQuery } from './access-expected-groups.types';
const PEOPLE = `WITH people AS (
 SELECT p.id AS "participantId",p.volunteer_id AS "volunteerId",p."firstName",CASE WHEN p.type='JEUNE' THEN NULL ELSE p."lastName" END AS "lastName",p.type::text AS type
 FROM participants p WHERE p.status='CONFIRMED'
 UNION ALL SELECT NULL::int,v.id,v."firstName",v."lastName",'BENEVOLE' FROM volunteers v WHERE NOT EXISTS(SELECT 1 FROM participants p WHERE p.volunteer_id=v.id)
) `;
@Injectable()
export class AccessReportingPeopleService {
  constructor(private readonly db: DataSource) {}
  async people(q: ExpectedPageQuery) {
    const search = q.q?.trim();
    const params = [search ? `%${search.replace(/[!%_]/g, '!$&')}%` : null];
    const where = `WHERE ($1::text IS NULL OR concat_ws(' ',"participantId"::text,"firstName","lastName") ILIKE $1 ESCAPE '!')`;
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const [count] = await m.query(
        `${PEOPLE} SELECT count(*)::int AS total FROM people ${where}`,
        params,
      );
      const items = await m.query(
        `${PEOPLE} SELECT * FROM people ${where} ORDER BY "firstName","participantId","volunteerId" LIMIT $2 OFFSET $3`,
        [...params, q.limit, q.offset],
      );
      return { items, total: count.total };
    });
  }
}
