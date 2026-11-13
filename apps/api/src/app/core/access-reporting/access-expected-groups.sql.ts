/**
 * Current membership, not a historic snapshot. Read-only resolution never creates
 * participant projections for volunteers. Their stable volunteer identity survives
 * later projection creation. No source is inferred from a badge or a past scan.
 */
export const EXPECTED_GROUP_MEMBERS_CTE = `WITH canonical_people AS (
  SELECT CASE WHEN p.volunteer_id IS NULL THEN 'participant:'||p.id ELSE 'volunteer:'||p.volunteer_id END AS "personKey",
    p.id AS "participantId",p.volunteer_id AS "volunteerId",p."firstName",
    CASE WHEN p.type='JEUNE' THEN NULL ELSE p."lastName" END AS "lastName",p.type::text AS type
  FROM participants p WHERE p.status='CONFIRMED'
  UNION ALL
  SELECT 'volunteer:'||v.id,NULL::int,v.id,v."firstName",v."lastName",'BENEVOLE'
  FROM volunteers v WHERE NOT EXISTS(SELECT 1 FROM participants p WHERE p.volunteer_id=v.id)
), members AS (
  SELECT DISTINCT c.* FROM canonical_people c
  WHERE EXISTS(SELECT 1 FROM access_expected_group_sources src
    WHERE src.group_id=$1 AND (
      src.participant_id=c."participantId" OR src.volunteer_id=c."volunteerId" OR src.person_type::text=c.type
      OR (src.team_id IS NOT NULL AND (
        EXISTS(SELECT 1 FROM team_participants tp WHERE tp.team_id=src.team_id AND tp.participant_id=c."participantId")
        OR EXISTS(SELECT 1 FROM teams t WHERE t.id=src.team_id AND c."volunteerId" IN (t.primary_animator_id,t.secondary_animator_id))
      ))
    ))
)`;

/** $1 group id, $2 passage id. Only that group's passage is used. */
export const EXPECTED_PASSAGE_STATUS_CTE = `${EXPECTED_GROUP_MEMBERS_CTE}, passage AS (
  SELECT * FROM access_expected_passages WHERE id=$2 AND group_id=$1
), statuses AS (
  SELECT m.*,
    CASE WHEN trace.confirmed THEN 'CONFIRMED' WHEN trace.uncertain THEN 'REVIEW_ONLY' ELSE 'NOT_CONFIRMED' END AS status,
    trace."lastReceivedAt"
  FROM members m CROSS JOIN passage x
  LEFT JOIN LATERAL (
    SELECT bool_or(e.verdict='ACCEPTED' AND NOT e.needs_review) AS confirmed,
      bool_or(e.needs_review) AS uncertain,max(e.received_at) AS "lastReceivedAt"
    FROM access_scan_events e
    WHERE e.participant_id=m."participantId" AND e.point_id=x.point_id AND e.scan_type_id=x.scan_type_id
      AND e.service_key IS NOT DISTINCT FROM x.service_key
      AND coalesce(e.occurred_at_local,e.received_at) >= x.starts_at
      AND coalesce(e.occurred_at_local,e.received_at) < x.ends_at
  ) trace ON true
)`;
export const EXPECTED_GROUP_SQL = {
  members: `${EXPECTED_GROUP_MEMBERS_CTE} SELECT * FROM members ORDER BY "firstName","personKey" LIMIT $2 OFFSET $3`,
  memberCount: `${EXPECTED_GROUP_MEMBERS_CTE} SELECT count(*)::int AS total FROM members`,
  statusCounts: `${EXPECTED_PASSAGE_STATUS_CTE} SELECT count(*)::int AS expected,
    count(*) FILTER(WHERE status='CONFIRMED')::int AS confirmed,
    count(*) FILTER(WHERE status='REVIEW_ONLY')::int AS "reviewOnly",
    count(*) FILTER(WHERE status='NOT_CONFIRMED')::int AS "notConfirmed" FROM statuses`,
  statusRows: `${EXPECTED_PASSAGE_STATUS_CTE} SELECT * FROM statuses WHERE ($3::text IS NULL OR status=$3)
    ORDER BY "firstName","personKey" LIMIT $4 OFFSET $5`,
};
