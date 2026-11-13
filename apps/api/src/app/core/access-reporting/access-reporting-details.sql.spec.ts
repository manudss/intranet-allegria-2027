import { PGlite } from '@electric-sql/pglite';
import { describe, it, expect } from 'vitest';
import {
  REPORT_DETAIL_SQL,
  REPORT_EVENT_FILTER,
  groupEventFilter,
  SCANNED_PEOPLE_CTE,
} from './access-reporting-details.sql';
import {
  AccessReportingDetailsService,
  detailParameters,
} from './access-reporting-details.service';
import { ReportDetailQuery } from './access-reporting-details.types';

describe('Reporting detail bound PostgreSQL queries', () => {
  it('keeps immutable event identity, zero-activity points, privacy, current-team filters and independent review flags', async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE access_expected_groups(id int,name text); INSERT INTO access_expected_groups VALUES(2,'Équipe A'); CREATE TABLE access_zones(id int,name text);
      CREATE TABLE access_scan_points(id int,name text,zone_id int,active bool);
      CREATE TABLE access_scan_types(id int,label text);
      CREATE TABLE volunteers(id int,"firstName" text,"lastName" text); CREATE TABLE access_expected_group_sources(group_id int,team_id int,person_type text,participant_id int,volunteer_id int); CREATE TABLE teams(id int,name text,primary_animator_id int,secondary_animator_id int); CREATE TABLE participants(id int,"firstName" text,"lastName" text,type text,status text DEFAULT 'CONFIRMED',volunteer_id int);
      CREATE TABLE team_participants(participant_id int,team_id int);
      CREATE TABLE access_scan_reviews(event_id int); CREATE TABLE access_expected_passages(id int,group_id int); CREATE TABLE access_passage_exceptions(id int,accepted_event_id int,reason text,participant_id int,passage_id int);
      CREATE TABLE access_scan_events(id int,participant_id int,point_id int,scan_type_id int,service_key text,occurred_at_local timestamptz,received_at timestamptz,verdict text,needs_review bool);
      INSERT INTO access_zones VALUES(1,'Accueil'),(2,'Repas');
      INSERT INTO access_scan_points VALUES(1,'Porte A',1,true),(2,'Réfectoire',2,true),(3,'Point vide',2,true);
      INSERT INTO access_scan_types VALUES(1,'Entrée'),(2,'Repas');
      INSERT INTO participants(id,"firstName","lastName",type) VALUES(42,'Ada','Privé','JEUNE'),(43,'Louis','Exemple','ANIMATEUR');
      INSERT INTO team_participants VALUES(42,8),(42,9),(43,9);
      INSERT INTO access_scan_events VALUES
      (1,42,1,1,NULL,'2027-07-31 08:00Z','2027-07-31 08:00Z','ACCEPTED',false),
      (2,42,2,2,'midi','2027-07-31 12:00Z','2027-07-31 12:00Z','ACCEPTED',false),
      (3,42,2,2,'midi','2027-07-31 12:01Z','2027-07-31 12:01Z','DUPLICATE',false),
      (4,43,2,2,'midi','2027-07-31 12:02Z','2027-07-31 12:10Z','ACCEPTED',true),
      (5,NULL,2,2,'midi',NULL,'2027-07-31 12:03Z','REJECTED_UNKNOWN',false),
      (6,43,1,1,NULL,'2027-08-01 00:00Z','2027-08-01 00:00Z','ACCEPTED',false);
      INSERT INTO access_scan_reviews VALUES(4);`);
      const q = { from: '2027-07-31T00:00:00Z', to: '2027-08-01T00:00:00Z' } as ReportDetailQuery;
      const args = detailParameters(q);
      const totals = (await db.query<Record<string, unknown>>(REPORT_DETAIL_SQL.totals, args))
        .rows[0];
      expect(
        (
          await db.query<Record<string, unknown>>(
            `${SCANNED_PEOPLE_CTE} SELECT count(*)::int AS n FROM latest`,
            args,
          )
        ).rows[0].n,
      ).toBe(1);
      expect(totals).toMatchObject({
        attempts: 5,
        scannedPeople: 1,
        accepted: 2,
        duplicates: 1,
        rejected: 1,
        needsReview: 1,
      });
      const points = (await db.query<Record<string, unknown>>(REPORT_DETAIL_SQL.dashboard, args))
        .rows;
      expect(points).toHaveLength(3);
      expect(points.find((r) => r.pointId === 3)).toMatchObject({
        attempts: 0,
        scannedPeople: 0,
        lastReceivedAt: null,
      });
      const events = (
        await db.query<Record<string, unknown>>(REPORT_DETAIL_SQL.events, [...args, 50, 0])
      ).rows;
      expect(events).toHaveLength(5);
      expect(events.find((r) => r.id === 1)).toMatchObject({
        participantId: 42,
        firstName: 'Ada',
        lastName: null,
      });
      expect(events.find((r) => r.id === 4)).toMatchObject({
        lastName: 'Exemple',
        needsReview: true,
        reviewClosed: true,
      });
      expect(events[0]).not.toHaveProperty('code');
      // Filtering a group does not fan out events for people in multiple teams.
      const team = detailParameters({ ...q, teamId: 9 });
      expect(
        (await db.query<Record<string, unknown>>(REPORT_DETAIL_SQL.eventCount, team)).rows[0].total,
      ).toBe(4);
      // Search cannot leak a young person's hidden surname via result existence.
      expect(
        (
          await db.query<Record<string, unknown>>(
            REPORT_DETAIL_SQL.eventCount,
            detailParameters({ ...q, q: 'Privé' }),
          )
        ).rows[0].total,
      ).toBe(0);
      expect(
        (
          await db.query<Record<string, unknown>>(
            REPORT_DETAIL_SQL.eventCount,
            detailParameters({ ...q, q: 'Exemple' }),
          )
        ).rows[0].total,
      ).toBe(1);
      expect(
        (
          await db.query<Record<string, unknown>>(
            REPORT_DETAIL_SQL.eventCount,
            detailParameters({ ...q, q: '%' }),
          )
        ).rows[0].total,
      ).toBe(0);
      await db.exec('INSERT INTO access_expected_group_sources(group_id,team_id) VALUES(2,8)');
      const filter = groupEventFilter(2).split('$14').join('$12');
      expect(
        (
          await db.query<Record<string, unknown>>(
            REPORT_DETAIL_SQL.eventCount.replace(REPORT_EVENT_FILTER, filter),
            [...args, 2],
          )
        ).rows[0].total,
      ).toBe(3);
      const service = new AccessReportingDetailsService({
        transaction: async (_: unknown, work: (m: unknown) => unknown) =>
          work({ query: async (sql: string, args: unknown[]) => (await db.query(sql, args)).rows }),
      } as never);
      const anomalies = await service.events({ ...q, limit: 50, offset: 0, anomaliesOnly: 'true' });
      expect(anomalies.total).toBe(3);
      expect(anomalies.items.map((r: { id: number }) => r.id)).toEqual([5, 4, 3]);
      const review = await service.events({ ...q, limit: 50, offset: 0, reviewOnly: 'true' });
      expect(review.total).toBe(1);
      expect(review.items[0].id).toBe(4);
      await db.exec(
        `INSERT INTO volunteers VALUES(99,'Camille','Exemple'); INSERT INTO access_expected_group_sources(group_id,volunteer_id) VALUES(2,99); INSERT INTO access_expected_passages VALUES(1,2); INSERT INTO access_passage_exceptions VALUES(1,4,'Exception ponctuelle',43,1)`,
      );
      const history = await service.groupHistory({
        ...q,
        expectedGroupId: 2,
        limit: 50,
        offset: 0,
      });
      expect(history.counts).toMatchObject({
        members: 2,
        scannedPeople: 1,
        withoutAccepted: 1,
        attempts: 3,
        accepted: 2,
        duplicates: 1,
      });
      expect(history.items).toHaveLength(2);
      expect(
        history.items.find((r: { volunteerId: number }) => r.volunteerId === 99),
      ).toMatchObject({ participantId: null, hasAccepted: false });
      expect(
        (
          await service.groupHistory({
            ...q,
            expectedGroupId: 2,
            withoutAcceptedOnly: 'true',
            limit: 50,
            offset: 0,
          })
        ).items,
      ).toHaveLength(1);
      const groupEvents = await service.events({ ...q, expectedGroupId: 2, limit: 50, offset: 0 });
      expect(groupEvents.total).toBe(3); // passage-only exceptions are not current group members
      expect(
        (await service.groupHistory({ ...q, expectedGroupId: 2, limit: 50, offset: 999 })).counts
          .members,
      ).toBe(2);
      await expect(service.groupHistory({ ...q, expectedGroupId: 999 })).rejects.toThrow(
        'Groupe introuvable',
      );
      // Out-of-range pagination still has a usable independent total.
      expect(
        (await db.query<Record<string, unknown>>(REPORT_DETAIL_SQL.events, [...args, 50, 500]))
          .rows,
      ).toEqual([]);
      expect(
        (await db.query<Record<string, unknown>>(REPORT_DETAIL_SQL.eventCount, args)).rows[0].total,
      ).toBe(5);
      expect(
        (
          await db.query<Record<string, unknown>>(
            REPORT_DETAIL_SQL.eventCount,
            detailParameters({ ...q, participantId: 42, pointId: 2, serviceKey: 'midi' }),
          )
        ).rows[0].total,
      ).toBe(2);
    } finally {
      await db.close();
    }
  }, 20000);
});
