import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateAccessScanReviews1789700000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE access_scan_reviews (
      event_id integer PRIMARY KEY REFERENCES access_scan_events(id) ON DELETE RESTRICT,
      reviewer_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      note varchar(1000) NOT NULL,
      reviewed_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX access_scan_reviews_reviewer_idx ON access_scan_reviews(reviewer_id)');
    await q.query('CREATE INDEX access_scan_events_review_idx ON access_scan_events(id DESC) WHERE needs_review OR verdict = \'DUPLICATE\'');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS access_scan_events_review_idx');
    await q.query('DROP TABLE access_scan_reviews');
  }
}
