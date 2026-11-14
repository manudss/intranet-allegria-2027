import { EXPECTED_PASSAGE_STATUS_CTE } from './access-expected-groups.sql';
const status = EXPECTED_PASSAGE_STATUS_CTE.split('$1').join('m.group_id').split('$2').join('m.id');
export const EXPECTED_OVERVIEW_CTE = `WITH matching AS (
 SELECT ep.*,g.name AS "groupName",pt.name AS "pointName",pt.zone_id AS "zoneId",st.label AS "scanTypeLabel",
 jsonb_build_array(ep.point_id,ep.scan_type_id,ep.service_key,ep.starts_at,ep.ends_at)::text AS "slotKey"
 FROM access_expected_passages ep JOIN access_expected_groups g ON g.id=ep.group_id JOIN access_scan_points pt ON pt.id=ep.point_id JOIN access_scan_types st ON st.id=ep.scan_type_id
 WHERE ep.archived_at IS NULL AND g.archived_at IS NULL AND ep.starts_at<$2::timestamptz AND ep.ends_at>$1::timestamptz
 AND ($3::int IS NULL OR pt.zone_id=$3) AND ($4::int IS NULL OR ep.scan_type_id=$4) AND ($5::text IS NULL OR ep.service_key=$5)
), combined AS (
 SELECT m.id,m."slotKey",s."personKey",s.status,s."isException" FROM matching m CROSS JOIN LATERAL (${status} SELECT "personKey",status,"isException" FROM statuses) s
), distinct_people AS (
 SELECT "slotKey","personKey",bool_or(status='CONFIRMED') AS confirmed,bool_or(status='REVIEW_ONLY') AS review,bool_or("isException") AS exception
 FROM combined GROUP BY "slotKey","personKey"
)`;
export const EXPECTED_OVERVIEW_ROWS = `${EXPECTED_OVERVIEW_CTE} SELECT m.id,m."slotKey",m.group_id AS "groupId",m."groupName",m.point_id AS "pointId",m."pointName",m."zoneId",m.scan_type_id AS "scanTypeId",m."scanTypeLabel",m.service_key AS "serviceKey",m.label,m.starts_at AS "startsAt",m.ends_at AS "endsAt",
 count(c."personKey")::int AS expected,count(c."personKey") FILTER(WHERE c.status='CONFIRMED')::int AS confirmed,count(c."personKey") FILTER(WHERE c.status='REVIEW_ONLY')::int AS "reviewOnly",count(c."personKey") FILTER(WHERE c.status='NOT_CONFIRMED')::int AS "notConfirmed",count(c."personKey") FILTER(WHERE c."isException")::int AS exceptions
 FROM matching m LEFT JOIN combined c ON c.id=m.id GROUP BY m.id,m."slotKey",m.group_id,m."groupName",m.point_id,m."pointName",m."zoneId",m.scan_type_id,m."scanTypeLabel",m.service_key,m.label,m.starts_at,m.ends_at ORDER BY m.starts_at,m.id`;
export const EXPECTED_OVERVIEW_SLOTS = `${EXPECTED_OVERVIEW_CTE}, slots AS (
 SELECT DISTINCT "slotKey",point_id,"pointName",scan_type_id,"scanTypeLabel",service_key,starts_at,ends_at FROM matching
) SELECT s."slotKey",s.point_id AS "pointId",s."pointName",s.scan_type_id AS "scanTypeId",s."scanTypeLabel",s.service_key AS "serviceKey",s.starts_at AS "startsAt",s.ends_at AS "endsAt",
 count(p."personKey")::int AS expected,count(p."personKey") FILTER(WHERE p.confirmed)::int AS confirmed,count(p."personKey") FILTER(WHERE NOT p.confirmed AND p.review)::int AS "reviewOnly",count(p."personKey") FILTER(WHERE NOT p.confirmed AND NOT p.review)::int AS "notConfirmed",count(p."personKey") FILTER(WHERE p.exception)::int AS exceptions
 FROM slots s LEFT JOIN distinct_people p ON p."slotKey"=s."slotKey" GROUP BY s."slotKey",s.point_id,s."pointName",s.scan_type_id,s."scanTypeLabel",s.service_key,s.starts_at,s.ends_at ORDER BY s.starts_at,s.point_id,s."slotKey"`;
