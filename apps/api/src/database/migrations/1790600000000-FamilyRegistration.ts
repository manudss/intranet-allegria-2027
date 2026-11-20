import { MigrationInterface, QueryRunner } from 'typeorm';
export class FamilyRegistration1790600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE registration_families (id uuid PRIMARY KEY, email varchar(254) NOT NULL UNIQUE, dossier jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now());
 CREATE TABLE registration_challenges (id uuid PRIMARY KEY, email varchar(254) NOT NULL, digest varchar(64) NOT NULL, "expiresAt" timestamptz NOT NULL, attempts int NOT NULL DEFAULT 0, "createdAt" timestamptz NOT NULL DEFAULT now());
 CREATE INDEX "IDX_registration_challenges_email" ON registration_challenges(email);
 CREATE TABLE registration_sessions (digest varchar(64) PRIMARY KEY, family_id uuid NOT NULL REFERENCES registration_families(id) ON DELETE CASCADE, "expiresAt" timestamptz NOT NULL);
 CREATE INDEX "IDX_registration_sessions_family" ON registration_sessions(family_id);
 CREATE TABLE registration_audit (id bigserial PRIMARY KEY, family_id uuid NOT NULL REFERENCES registration_families(id) ON DELETE CASCADE, "youthId" uuid, action varchar(80) NOT NULL, actor varchar(254) NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now());
 CREATE TABLE registration_settings (id int PRIMARY KEY CHECK(id=1), rules jsonb NOT NULL);
 CREATE TABLE registration_health (family_id uuid NOT NULL REFERENCES registration_families(id) ON DELETE CASCADE, "youthId" uuid NOT NULL, envelope text NOT NULL, revision int NOT NULL DEFAULT 0, "updatedAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(family_id,"youthId"));
 CREATE TABLE registration_documents (id uuid PRIMARY KEY, family_id uuid NOT NULL REFERENCES registration_families(id) ON DELETE CASCADE, "youthId" uuid NOT NULL, name varchar(180) NOT NULL, mime varchar(80) NOT NULL, content bytea NOT NULL, digest varchar(64) NOT NULL, status varchar(20) NOT NULL DEFAULT 'RECEIVED', reason varchar(500) NOT NULL DEFAULT '', "createdAt" timestamptz NOT NULL DEFAULT now());`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP TABLE registration_health, registration_documents, registration_settings, registration_audit, registration_sessions, registration_challenges, registration_families',
    );
  }
}
