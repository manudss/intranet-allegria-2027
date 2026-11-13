import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AccessAuditLog, AccessAuditAction } from '../entities';
import {
  EXPECTED_GROUP_SQL,
  EXPECTED_GROUP_MEMBERS_CTE,
  EXPECTED_PASSAGE_STATUS_CTE,
} from './access-expected-groups.sql';
import {
  ExpectedPageQuery,
  SaveExpectedGroupDto,
  SaveExpectedPassageDto,
} from './access-expected-groups.types';

@Injectable()
export class AccessExpectedGroupsService {
  constructor(private readonly db: DataSource) {}
  private async audit(
    m: EntityManager,
    userId: number,
    entityType: string,
    entityId: number,
    version: number,
  ) {
    await m.getRepository(AccessAuditLog).save({
      userId,
      action: AccessAuditAction.CONFIG_CHANGED,
      entityType,
      entityId,
      details: { version },
    });
  }
  async dashboard(from: string, to: string) {
    const start = Date.parse(from),
      end = Date.parse(to);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > 31 * 86400000
    )
      throw new BadRequestException('Période invalide');
    const statusCte = EXPECTED_PASSAGE_STATUS_CTE.split('$1')
      .join('ep.group_id')
      .split('$2')
      .join('ep.id');
    return this.db.query(
      `SELECT ep.id,ep.group_id AS "groupId",g.name AS "groupName",ep.point_id AS "pointId",pt.name AS "pointName",ep.label,ep.starts_at AS "startsAt",ep.ends_at AS "endsAt",c.*
      FROM access_expected_passages ep JOIN access_expected_groups g ON g.id=ep.group_id JOIN access_scan_points pt ON pt.id=ep.point_id
      CROSS JOIN LATERAL (${statusCte} SELECT count(*)::int AS expected,count(*) FILTER(WHERE status='CONFIRMED')::int AS confirmed,
      count(*) FILTER(WHERE status='REVIEW_ONLY')::int AS "reviewOnly",count(*) FILTER(WHERE status='NOT_CONFIRMED')::int AS "notConfirmed",count(*) FILTER(WHERE "isException")::int AS exceptions FROM statuses) c
      WHERE ep.starts_at<$2 AND ep.ends_at>$1 AND ep.archived_at IS NULL AND g.archived_at IS NULL ORDER BY ep.starts_at,ep.id`,
      [from, to],
    );
  }

  async groups(q: ExpectedPageQuery) {
    const term = q.q?.trim();
    const params = [term ? `%${term.replace(/[!%_]/g, '!$&')}%` : null];
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const [c] = await m.query(
        `SELECT count(*)::int AS total FROM access_expected_groups WHERE ($1::text IS NULL OR name ILIKE $1 ESCAPE '!')`,
        params,
      );
      const items = await m.query(
        `SELECT id,name,version,archived_at AS "archivedAt",updated_at AS "updatedAt" FROM access_expected_groups WHERE ($1::text IS NULL OR name ILIKE $1 ESCAPE '!') ORDER BY name,id LIMIT $2 OFFSET $3`,
        [...params, q.limit, q.offset],
      );
      return { items, total: c.total };
    });
  }
  async group(id: number) {
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const [group] = await m.query('SELECT * FROM access_expected_groups WHERE id=$1', [id]);
      if (!group) throw new NotFoundException('Groupe introuvable');
      const sources = await m.query(
        `SELECT src.team_id AS "teamId",src.person_type AS "personType",src.participant_id AS "participantId",src.volunteer_id AS "volunteerId",
          CASE WHEN src.team_id IS NOT NULL THEN t.name WHEN src.person_type IS NOT NULL THEN src.person_type::text
          WHEN src.participant_id IS NOT NULL THEN concat_ws(' ',p."firstName",CASE WHEN p.type='JEUNE' THEN NULL ELSE p."lastName" END)
          ELSE concat_ws(' ',v."firstName",v."lastName") END AS label
        FROM access_expected_group_sources src LEFT JOIN teams t ON t.id=src.team_id LEFT JOIN participants p ON p.id=src.participant_id LEFT JOIN volunteers v ON v.id=src.volunteer_id WHERE src.group_id=$1 ORDER BY src.id`,
        [id],
      );
      return { ...group, sources };
    });
  }
  async saveGroup(id: number | null, dto: SaveExpectedGroupDto, userId: number) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Nom requis');
    for (const s of dto.sources)
      if (
        [s.teamId, s.personType, s.participantId, s.volunteerId].filter((x) => x != null).length !==
        1
      )
        throw new BadRequestException('Une source par ligne');
    return this.db.transaction(async (m) => {
      let group;
      if (id) {
        const [old] = await m.query(
          'SELECT id,version FROM access_expected_groups WHERE id=$1 FOR UPDATE',
          [id],
        );
        if (!old) throw new NotFoundException('Groupe introuvable');
        if (dto.version !== old.version)
          throw new ConflictException('Le groupe a changé, rechargez-le');
        [group] = await m.query(
          'UPDATE access_expected_groups SET name=$2,version=version+1,archived_at=CASE WHEN $3 THEN coalesce(archived_at,now()) ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING *',
          [id, name, dto.archived ?? false],
        );
        await m.query('DELETE FROM access_expected_group_sources WHERE group_id=$1', [id]);
      } else {
        [group] = await m.query(
          'INSERT INTO access_expected_groups(name,created_by) VALUES($1,$2) RETURNING *',
          [name, userId],
        );
      }
      for (const s of dto.sources) {
        const checks: [string, unknown][] = [];
        if (s.teamId) checks.push(['teams', s.teamId]);
        if (s.participantId) checks.push(['participants', s.participantId]);
        if (s.volunteerId) checks.push(['volunteers', s.volunteerId]);
        for (const [table, key] of checks) {
          const rows = await m.query(`SELECT id FROM ${table} WHERE id=$1`, [key]);
          if (!rows.length) throw new BadRequestException('Source introuvable');
        }
        await m.query(
          `INSERT INTO access_expected_group_sources(group_id,team_id,person_type,participant_id,volunteer_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [
            group.id,
            s.teamId ?? null,
            s.personType ?? null,
            s.participantId ?? null,
            s.volunteerId ?? null,
          ],
        );
      }
      await this.audit(m, userId, 'access_expected_groups', group.id, group.version);
      return group;
    });
  }
  async passage(id: number) {
    const [passage] = await this.db.query(
      `SELECT x.*,g.name AS "groupName",pt.name AS "pointName" FROM access_expected_passages x JOIN access_expected_groups g ON g.id=x.group_id JOIN access_scan_points pt ON pt.id=x.point_id WHERE x.id=$1`,
      [id],
    );
    if (!passage) throw new NotFoundException('Passage introuvable');
    return passage;
  }
  async passages(q: ExpectedPageQuery) {
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const [count] = await m.query(
        'SELECT count(*)::int AS total FROM access_expected_passages WHERE ($1::int IS NULL OR group_id=$1)',
        [q.groupId ?? null],
      );
      const items = await m.query(
        `SELECT x.*,g.name AS "groupName",pt.name AS "pointName" FROM access_expected_passages x JOIN access_expected_groups g ON g.id=x.group_id JOIN access_scan_points pt ON pt.id=x.point_id WHERE ($1::int IS NULL OR x.group_id=$1) ORDER BY x.starts_at DESC,x.id DESC LIMIT $2 OFFSET $3`,
        [q.groupId ?? null, q.limit, q.offset],
      );
      return { items, total: count.total };
    });
  }
  async savePassage(id: number | null, dto: SaveExpectedPassageDto, userId: number) {
    const start = Date.parse(dto.startsAt),
      end = Date.parse(dto.endsAt);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > 31 * 86400000
    )
      throw new BadRequestException('Fenêtre attendue de 1 seconde à 31 jours');
    try {
      new Intl.DateTimeFormat('fr', { timeZone: dto.timezone }).format();
    } catch {
      throw new BadRequestException('Fuseau invalide');
    }
    if (!dto.label.trim() || (dto.serviceKey != null && !dto.serviceKey.trim()))
      throw new BadRequestException('Libellé/service invalide');
    return this.db.transaction(async (m) => {
      const [group] = await m.query(
        'SELECT id,archived_at FROM access_expected_groups WHERE id=$1 FOR SHARE',
        [dto.groupId],
      );
      if (!group || group.archived_at) throw new BadRequestException('Groupe absent ou archivé');
      const [point] = await m.query(
        'SELECT scan_type_id,service_key,active FROM access_scan_points WHERE id=$1 FOR SHARE',
        [dto.pointId],
      );
      if (
        !point ||
        !point.active ||
        point.scan_type_id !== dto.scanTypeId ||
        point.service_key !== (dto.serviceKey ?? null)
      )
        throw new BadRequestException('Le type et service doivent correspondre au point actif');
      const values = [
        dto.groupId,
        dto.pointId,
        dto.scanTypeId,
        dto.serviceKey ?? null,
        dto.label.trim(),
        dto.startsAt,
        dto.endsAt,
        dto.timezone,
      ];
      let passage;
      if (id) {
        const [old] = await m.query(
          'SELECT version FROM access_expected_passages WHERE id=$1 FOR UPDATE',
          [id],
        );
        if (!old) throw new NotFoundException('Passage introuvable');
        if (old.version !== dto.version)
          throw new ConflictException('Le passage a changé, rechargez-le');
        [passage] = await m.query(
          `UPDATE access_expected_passages SET group_id=$1,point_id=$2,scan_type_id=$3,service_key=$4,label=$5,starts_at=$6,ends_at=$7,timezone=$8,version=version+1,updated_at=now(),archived_at=CASE WHEN $10 THEN coalesce(archived_at,now()) ELSE NULL END WHERE id=$9 RETURNING *`,
          [...values, id, dto.archived ?? false],
        );
      } else
        [passage] = await m.query(
          `INSERT INTO access_expected_passages(group_id,point_id,scan_type_id,service_key,label,starts_at,ends_at,timezone,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [...values, userId],
        );
      await m.query('UPDATE access_scan_points SET expected_online_required=true WHERE id=$1', [
        dto.pointId,
      ]);
      await this.audit(m, userId, 'access_expected_passages', passage.id, passage.version);
      return passage;
    });
  }
  private searchTerm(q: ExpectedPageQuery) {
    return q.q?.trim() ? `%${q.q.trim().replace(/[!%_]/g, '!$&')}%` : null;
  }
  async members(id: number, q: ExpectedPageQuery) {
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const [group] = await m.query('SELECT id FROM access_expected_groups WHERE id=$1', [id]);
      if (!group) throw new NotFoundException('Groupe introuvable');
      const where = `WHERE ($2::text IS NULL OR concat_ws(' ',"personKey","firstName","lastName") ILIKE $2 ESCAPE '!')`;
      const args = [id, this.searchTerm(q)];
      const [c] = await m.query(
        `${EXPECTED_GROUP_MEMBERS_CTE} SELECT count(*)::int AS total FROM members ${where}`,
        args,
      );
      const items = await m.query(
        `${EXPECTED_GROUP_MEMBERS_CTE} SELECT * FROM members ${where} ORDER BY "firstName","personKey" LIMIT $3 OFFSET $4`,
        [...args, q.limit, q.offset],
      );
      return { items, total: c.total, membershipBasis: 'CURRENT' };
    });
  }
  async status(id: number, q: ExpectedPageQuery) {
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const [x] = await m.query('SELECT id,group_id FROM access_expected_passages WHERE id=$1', [
        id,
      ]);
      if (!x) throw new NotFoundException('Passage introuvable');
      const [counts] = await m.query(EXPECTED_GROUP_SQL.statusCounts, [x.group_id, id]);
      const where = `WHERE ($3::text IS NULL OR status=$3 OR ($3='EXCEPTION' AND "isException")) AND ($4::text IS NULL OR concat_ws(' ',"personKey","firstName","lastName") ILIKE $4 ESCAPE '!')`;
      const args = [x.group_id, id, q.status ?? null, this.searchTerm(q)];
      const [c] = await m.query(
        `${EXPECTED_PASSAGE_STATUS_CTE} SELECT count(*)::int AS total FROM statuses ${where}`,
        args,
      );
      const items = await m.query(
        `${EXPECTED_PASSAGE_STATUS_CTE} SELECT * FROM statuses ${where} ORDER BY "firstName","personKey" LIMIT $5 OFFSET $6`,
        [...args, q.limit, q.offset],
      );
      return { items, total: c.total, counts, membershipBasis: 'CURRENT' };
    });
  }
}
