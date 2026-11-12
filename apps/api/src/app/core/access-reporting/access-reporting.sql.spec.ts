import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ACCESS_REPORT_SQL } from './access-reporting.service';
describe('Reporting PostgreSQL queries (PGlite)', () => { it('counts movements, carry-in, meal duplicates and immutable review closures', async () => {const db=new PGlite();await db.exec(`
CREATE TABLE access_zones(id int,name text);CREATE TABLE access_scan_types(id int,label text);CREATE TABLE access_scan_points(id int,zone_id int,scan_type_id int,name text);
CREATE TABLE participants(id int,"firstName" text,"lastName" text);
CREATE TABLE access_scan_events(id int,participant_id int,point_id int,scan_type_id int,service_key text,occurred_at_local timestamptz,received_at timestamptz,verdict text,needs_review bool);
CREATE TABLE access_scan_reviews(event_id int);
INSERT INTO access_zones VALUES(1,'Door');INSERT INTO access_scan_types VALUES(1,'Entry'),(2,'Exit'),(3,'Meal');INSERT INTO access_scan_points VALUES(1,1,1,'Gate'),(2,1,2,'Gate exit'),(3,1,3,'Canteen');
INSERT INTO participants VALUES(42,'Ada','Test'),(43,'Louis','Test'),(44,'Emma','Test');
-- Ada enters, leaves, enters: present. Louis carry-in the day before: present.
INSERT INTO access_scan_events VALUES
(1,42,1,1,NULL,'2027-07-31 08:00Z','2027-07-31 08:00Z','ACCEPTED',false),
(2,42,2,2,NULL,'2027-07-31 09:00Z','2027-07-31 09:00Z','ACCEPTED',false),
(3,42,1,1,NULL,'2027-07-31 10:00Z','2027-07-31 10:00Z','ACCEPTED',false),
(4,43,1,1,NULL,'2027-07-30 20:00Z','2027-07-30 20:00Z','ACCEPTED',false),
(5,44,1,1,NULL,'2027-07-31 08:00Z','2027-07-31 08:00Z','ACCEPTED',false),
(6,44,2,2,NULL,'2027-07-31 10:00Z','2027-07-31 10:00Z','ACCEPTED',false),
(7,42,3,3,'lunch','2027-07-31 12:00Z','2027-07-31 12:00Z','ACCEPTED',false),
(8,42,3,3,'lunch','2027-07-31 12:01Z','2027-07-31 12:01Z','DUPLICATE',false),
(9,42,3,3,'lunch','2027-07-31 12:02Z','2027-07-31 15:00Z','REJECTED_EXPIRED_ASSIGNMENT',true);
`);
const queries=[ACCESS_REPORT_SQL.counts,ACCESS_REPORT_SQL.presence,ACCESS_REPORT_SQL.metadata,ACCESS_REPORT_SQL.reviews];
const counts=(await db.query(queries[0],['2027-07-31T00:00:00Z','2027-08-01T00:00:00Z',null])).rows;const meal=counts.find(r=>r.scanTypeId===3);assert.equal(meal.accepted,1);assert.equal(meal.duplicates,1);assert.equal(meal.rejected,1);
const presence=(await db.query(queries[1],['2027-08-01T00:00:00Z',null,1,2])).rows;assert.deepEqual(presence.map(r=>r.participantId).sort(),[42,43]);
let meta=(await db.query(queries[2],[null])).rows[0];assert.equal(meta.pendingReviews,2);
const review=(await db.query(queries[3],[null,50,0])).rows;assert.equal(review.length,2);assert.equal(review[0].firstName,'Ada');assert.ok(!('code' in review[0]));
await db.exec('INSERT INTO access_scan_reviews VALUES(9)');meta=(await db.query(queries[2],[null])).rows[0];assert.equal(meta.pendingReviews,1);
await db.close();}, 20000); });
