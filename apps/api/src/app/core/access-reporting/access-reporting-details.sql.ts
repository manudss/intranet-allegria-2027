import { EXPECTED_GROUP_MEMBERS_CTE } from './access-expected-groups.sql';
/** Read-only, bound reporting queries. Event identity is immutable; group membership is current. */
export const REPORT_EVENT_FILTER = `
  FROM access_scan_events e
  JOIN access_scan_points pt ON pt.id=e.point_id
  JOIN access_zones z ON z.id=pt.zone_id
  JOIN access_scan_types st ON st.id=e.scan_type_id
  LEFT JOIN participants p ON p.id=e.participant_id
  WHERE coalesce(e.occurred_at_local,e.received_at) >= $1::timestamptz
    AND coalesce(e.occurred_at_local,e.received_at) < $2::timestamptz
    AND ($3::int IS NULL OR pt.zone_id=$3)
    AND ($4::int IS NULL OR pt.id=$4)
    AND ($5::int IS NULL OR e.scan_type_id=$5)
    AND ($6::text IS NULL OR e.service_key=$6)
    AND ($7::int IS NULL OR e.participant_id=$7)
    AND ($8::int IS NULL OR EXISTS (SELECT 1 FROM team_participants tp WHERE tp.participant_id=p.id AND tp.team_id=$8))
    AND ($9::text IS NULL OR p.type::text=$9)
    AND ($10::text IS NULL OR concat_ws(' ',p.id::text,p."firstName",CASE WHEN p.type='JEUNE' THEN NULL ELSE p."lastName" END) ILIKE $10 ESCAPE '!')
    AND ($11::text IS NULL OR e.verdict::text=$11)
`;
export const REPORT_DETAIL_SQL = {
  eventCount: `SELECT count(*)::int AS total ${REPORT_EVENT_FILTER}`,
  events: `SELECT e.id,e.participant_id AS "participantId",p."firstName",
    CASE WHEN p.type='JEUNE' THEN NULL ELSE p."lastName" END AS "lastName",p.type,
    e.point_id AS "pointId",pt.name AS "pointName",pt.zone_id AS "zoneId",z.name AS "zoneName",
    e.scan_type_id AS "scanTypeId",st.label AS "scanTypeLabel",e.service_key AS "serviceKey",
    e.occurred_at_local AS "occurredAtLocal",e.received_at AS "receivedAt",e.verdict,e.needs_review AS "needsReview",
    (SELECT ex.id FROM access_passage_exceptions ex WHERE ex.accepted_event_id=e.id) AS "exceptionId",
    (SELECT ex.reason FROM access_passage_exceptions ex WHERE ex.accepted_event_id=e.id) AS "exceptionReason",
    EXISTS(SELECT 1 FROM access_scan_reviews r WHERE r.event_id=e.id) AS "reviewClosed"
    ${REPORT_EVENT_FILTER}
    ORDER BY coalesce(e.occurred_at_local,e.received_at) DESC,e.id DESC LIMIT $12 OFFSET $13`,
  dashboard: `WITH filtered AS (SELECT e.* ${REPORT_EVENT_FILTER})
    SELECT pt.id AS "pointId",pt.name AS "pointName",pt.active,pt.zone_id AS "zoneId",z.name AS "zoneName",
    count(e.id)::int AS attempts,
    count(DISTINCT e.participant_id) FILTER(WHERE e.verdict='ACCEPTED' AND NOT e.needs_review)::int AS "scannedPeople",
    count(e.id) FILTER(WHERE e.verdict='ACCEPTED' AND NOT e.needs_review)::int AS accepted,
    count(e.id) FILTER(WHERE e.verdict='DUPLICATE')::int AS duplicates,
    count(e.id) FILTER(WHERE e.verdict NOT IN ('ACCEPTED','DUPLICATE'))::int AS rejected,
    count(e.id) FILTER(WHERE e.needs_review)::int AS "needsReview",
    max(e.received_at) AS "lastReceivedAt"
    FROM access_scan_points pt JOIN access_zones z ON z.id=pt.zone_id LEFT JOIN filtered e ON e.point_id=pt.id
    WHERE ($3::int IS NULL OR pt.zone_id=$3) AND ($4::int IS NULL OR pt.id=$4)
    GROUP BY pt.id,pt.name,pt.active,pt.zone_id,z.name ORDER BY z.name,pt.name,pt.id`,
  totals: `SELECT count(*)::int AS attempts,
    count(DISTINCT e.participant_id) FILTER(WHERE e.verdict='ACCEPTED' AND NOT e.needs_review)::int AS "scannedPeople",
    count(*) FILTER(WHERE e.verdict='ACCEPTED' AND NOT e.needs_review)::int AS accepted,
    count(*) FILTER(WHERE e.verdict='DUPLICATE')::int AS duplicates,
    count(*) FILTER(WHERE e.verdict NOT IN ('ACCEPTED','DUPLICATE'))::int AS rejected,
    count(*) FILTER(WHERE e.needs_review)::int AS "needsReview",max(e.received_at) AS "lastReceivedAt"
    ${REPORT_EVENT_FILTER}`,
};

export function groupEventFilter(groupId: number | null): string {
  if (groupId == null) return REPORT_EVENT_FILTER;
  // The outer event filter binds $1/$2 to dates. A separate CTE uses $14 for group identity.
  const membership = EXPECTED_GROUP_MEMBERS_CTE.replace('src.group_id=$1', 'src.group_id=$14');
  return (
    REPORT_EVENT_FILTER +
    ` AND e.participant_id IN (${membership} SELECT "participantId" FROM members WHERE "participantId" IS NOT NULL)`
  );
}

export const SCANNED_PEOPLE_CTE = `WITH matched AS (
 SELECT e.id,e.participant_id AS "participantId",p."firstName",CASE WHEN p.type='JEUNE' THEN NULL ELSE p."lastName" END AS "lastName",p.type,
 e.point_id AS "pointId",pt.name AS "pointName",z.name AS "zoneName",e.service_key AS "serviceKey",e.scan_type_id AS "scanTypeId",st.label AS "scanTypeLabel",
 e.occurred_at_local AS "occurredAtLocal",e.received_at AS "receivedAt",e.verdict,e.needs_review AS "needsReview",
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) ORDER BY t.id) FROM teams t JOIN team_participants tp ON tp.team_id=t.id WHERE tp.participant_id=e.participant_id),'[]'::jsonb) AS teams
 ${REPORT_EVENT_FILTER} AND e.participant_id IS NOT NULL AND e.verdict='ACCEPTED' AND NOT e.needs_review
), latest AS (SELECT DISTINCT ON("participantId") * FROM matched ORDER BY "participantId",coalesce("occurredAtLocal","receivedAt") DESC,id DESC)
`;

/** Current composition only. Passage exceptions never change a group's membership. */
export const GROUP_HISTORY_CTE = `${EXPECTED_GROUP_MEMBERS_CTE.replace('src.group_id=$1', 'src.group_id=$12')}, activity AS (
 SELECT e.* ${REPORT_EVENT_FILTER} AND e.participant_id IN (SELECT "participantId" FROM members)
), member_status AS (
 SELECT m.*,EXISTS(SELECT 1 FROM activity a WHERE a.participant_id=m."participantId" AND a.verdict='ACCEPTED' AND NOT a.needs_review) AS "hasAccepted",
 (SELECT max(a.received_at) FROM activity a WHERE a.participant_id=m."participantId") AS "lastReceivedAt" FROM members m
)`;
export const GROUP_HISTORY_SUMMARY = `${GROUP_HISTORY_CTE} SELECT
 (SELECT count(*)::int FROM members) AS members,
 (SELECT count(*)::int FROM member_status WHERE "hasAccepted") AS "scannedPeople",
 (SELECT count(*)::int FROM member_status WHERE NOT "hasAccepted") AS "withoutAccepted",
 (SELECT count(*)::int FROM activity) AS attempts,
 (SELECT count(*)::int FROM activity WHERE verdict='ACCEPTED' AND NOT needs_review) AS accepted,
 (SELECT count(*)::int FROM activity WHERE verdict='DUPLICATE') AS duplicates,
 (SELECT count(*)::int FROM activity WHERE verdict NOT IN ('ACCEPTED','DUPLICATE')) AS rejected,
 (SELECT count(*)::int FROM activity WHERE needs_review) AS "needsReview"`;
