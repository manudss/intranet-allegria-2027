import { MigrationInterface, QueryRunner } from 'typeorm';
/** One-way activation: archiving a group must not silently re-enable offline admission. */
export class PersistExpectedPointOnlinePolicy1790000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE access_scan_points ADD COLUMN expected_online_required boolean NOT NULL DEFAULT false',
    );
    await q.query(
      'UPDATE access_scan_points SET expected_online_required=true WHERE id IN (SELECT point_id FROM access_expected_passages)',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE access_scan_points DROP COLUMN expected_online_required');
  }
}
