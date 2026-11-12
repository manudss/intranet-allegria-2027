import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contrôle d'accès par QR code (PR 1 du plan validé par Emmanuel le 12/11/2026) :
 * stock de badges pré-imprimés, affectations versionnées (remplacement atomique,
 * un seul badge actif par personne et un seul porteur actif par badge), types de
 * scan/zones/points configurables, sessions de scan à clé expirante, événements
 * de scan idempotents, habilitations de scan par zone et période, audit dédié.
 */
export class CreateAccessControl1789600000000 implements MigrationInterface {
  name = 'CreateAccessControl1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."access_badge_status_enum" AS ENUM(
      'AVAILABLE',
      'ASSIGNED',
      'LOST',
      'REVOKED',
      'RETIRED'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."access_scan_duplicate_rule_enum" AS ENUM(
      'ALLOW',
      'UNIQUE_PER_SERVICE',
      'UNIQUE_PER_DAY'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."access_scan_verdict_enum" AS ENUM(
      'ACCEPTED',
      'DUPLICATE',
      'REJECTED_UNKNOWN',
      'REJECTED_REVOKED',
      'REJECTED_NO_RIGHT',
      'REJECTED_EXPIRED_ASSIGNMENT'
    )`);
    await queryRunner.query(`CREATE TYPE "public"."access_audit_action_enum" AS ENUM(
      'BADGE_STOCK_ADDED',
      'BADGE_ASSIGNED',
      'BADGE_REPLACED',
      'BADGE_REVOKED',
      'SCANNER_GRANTED',
      'SCANNER_REVOKED',
      'SCAN_SESSION_STARTED',
      'SCAN_SESSION_CLOSED',
      'UNKNOWN_CODE_LOOKUP',
      'LOOKUP_RATE_LIMITED',
      'CONFIG_CHANGED'
    )`);

    await queryRunner.query(`CREATE TABLE "access_badges" (
      "id" SERIAL NOT NULL,
      "code" character varying(64) NOT NULL,
      "lot" character varying(80) NOT NULL,
      "status" "public"."access_badge_status_enum" NOT NULL DEFAULT 'AVAILABLE',
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_access_badges_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_access_badges_code" ON "access_badges" ("code")`,
    );

    await queryRunner.query(`CREATE TABLE "access_badge_assignments" (
      "id" SERIAL NOT NULL,
      "badge_id" integer NOT NULL,
      "participant_id" integer NOT NULL,
      "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "endsAt" TIMESTAMP WITH TIME ZONE,
      "version" integer NOT NULL DEFAULT 1,
      "meta_created_version" integer NOT NULL DEFAULT 0,
      "meta_closed_version" integer,
      "reason" character varying(200),
      "created_by_user_id" integer,
      "operation_id" character varying(80),
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_access_badge_assignments_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_access_badge_assignments_badge_id" ON "access_badge_assignments" ("badge_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_badge_assignments_participant_id" ON "access_badge_assignments" ("participant_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_access_badge_assignments_operation_id" ON "access_badge_assignments" ("operation_id")`,
    );
    // Propositions du plan appliquées par défaut (question 1) : un seul
    // porteur actif par badge, un seul badge actif par personne.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_access_assignments_active_badge" ON "access_badge_assignments" ("badge_id") WHERE "endsAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_access_assignments_active_participant" ON "access_badge_assignments" ("participant_id") WHERE "endsAt" IS NULL`,
    );

    await queryRunner.query(`CREATE TABLE "access_scan_types" (
      "id" SERIAL NOT NULL,
      "code" character varying(80) NOT NULL,
      "label" character varying(120) NOT NULL,
      "description" character varying(300),
      "duplicate_rule" "public"."access_scan_duplicate_rule_enum" NOT NULL DEFAULT 'ALLOW',
      CONSTRAINT "PK_access_scan_types_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_access_scan_types_code" UNIQUE ("code")
    )`);

    await queryRunner.query(`CREATE TABLE "access_zones" (
      "id" SERIAL NOT NULL,
      "name" character varying(120) NOT NULL,
      "description" character varying(300),
      "allowed_person_types" text,
      "requires_online_validation" boolean NOT NULL DEFAULT false,
      "max_offline_minutes" integer NOT NULL DEFAULT 240,
      CONSTRAINT "PK_access_zones_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_access_zones_name" UNIQUE ("name")
    )`);

    await queryRunner.query(`CREATE TABLE "access_scan_points" (
      "id" SERIAL NOT NULL,
      "zone_id" integer NOT NULL,
      "scan_type_id" integer NOT NULL,
      "name" character varying(120) NOT NULL,
      "service_key" character varying(120),
      "active" boolean NOT NULL DEFAULT true,
      CONSTRAINT "PK_access_scan_points_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_access_scan_points_zone_id" ON "access_scan_points" ("zone_id")`,
    );

    await queryRunner.query(`CREATE TABLE "access_scan_sessions" (
      "id" SERIAL NOT NULL,
      "user_id" integer NOT NULL,
      "zone_id" integer,
      "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "closedAt" TIMESTAMP WITH TIME ZONE,
      "snapshot_version" integer NOT NULL,
      "session_key" character varying(128) NOT NULL,
      "key_expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      CONSTRAINT "PK_access_scan_sessions_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_access_scan_sessions_user_id" ON "access_scan_sessions" ("user_id")`,
    );

    await queryRunner.query(`CREATE TABLE "access_scan_events" (
      "id" SERIAL NOT NULL,
      "session_id" integer,
      "assignment_id" integer,
      "participant_id" integer,
      "badge_id" integer,
      "code" character varying(64) NOT NULL,
      "table_version" integer,
      "point_id" integer NOT NULL,
      "scan_type_id" integer NOT NULL,
      "occurred_at_local" TIMESTAMP WITH TIME ZONE,
      "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "verdict" "public"."access_scan_verdict_enum" NOT NULL,
      "service_key" character varying(120),
      "client_event_id" character varying(80) NOT NULL,
      "needs_review" boolean NOT NULL DEFAULT false,
      CONSTRAINT "PK_access_scan_events_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_access_scan_events_session_id" ON "access_scan_events" ("session_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_scan_events_participant_id" ON "access_scan_events" ("participant_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_access_scan_events_client_event_id" ON "access_scan_events" ("client_event_id")`,
    );

    await queryRunner.query(`CREATE TABLE "access_scanner_grants" (
      "id" SERIAL NOT NULL,
      "user_id" integer NOT NULL,
      "zone_id" integer,
      "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "endsAt" TIMESTAMP WITH TIME ZONE,
      "created_by_user_id" integer,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_access_scanner_grants_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_access_scanner_grants_user_id" ON "access_scanner_grants" ("user_id")`,
    );

    await queryRunner.query(`CREATE TABLE "access_audit_logs" (
      "id" SERIAL NOT NULL,
      "user_id" integer,
      "action" "public"."access_audit_action_enum" NOT NULL,
      "entityType" character varying(100) NOT NULL,
      "entityId" integer,
      "details" jsonb,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_access_audit_logs_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_access_audit_logs_user_id" ON "access_audit_logs" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_audit_logs_action" ON "access_audit_logs" ("action")`,
    );

    await queryRunner.query(`CREATE TABLE "access_control_meta" (
      "id" integer NOT NULL,
      "version" integer NOT NULL DEFAULT 0,
      CONSTRAINT "PK_access_control_meta_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`INSERT INTO "access_control_meta" ("id", "version") VALUES (1, 0)`);

    await queryRunner.query(`ALTER TABLE "access_badge_assignments"
      ADD CONSTRAINT "FK_access_badge_assignments_badge"
      FOREIGN KEY ("badge_id") REFERENCES "access_badges"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_badge_assignments"
      ADD CONSTRAINT "FK_access_badge_assignments_participant"
      FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_badge_assignments"
      ADD CONSTRAINT "FK_access_badge_assignments_created_by"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_points"
      ADD CONSTRAINT "FK_access_scan_points_zone"
      FOREIGN KEY ("zone_id") REFERENCES "access_zones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_points"
      ADD CONSTRAINT "FK_access_scan_points_scan_type"
      FOREIGN KEY ("scan_type_id") REFERENCES "access_scan_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_sessions"
      ADD CONSTRAINT "FK_access_scan_sessions_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_sessions"
      ADD CONSTRAINT "FK_access_scan_sessions_zone"
      FOREIGN KEY ("zone_id") REFERENCES "access_zones"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_events"
      ADD CONSTRAINT "FK_access_scan_events_session"
      FOREIGN KEY ("session_id") REFERENCES "access_scan_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_events"
      ADD CONSTRAINT "FK_access_scan_events_assignment"
      FOREIGN KEY ("assignment_id") REFERENCES "access_badge_assignments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_events"
      ADD CONSTRAINT "FK_access_scan_events_participant"
      FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_events"
      ADD CONSTRAINT "FK_access_scan_events_badge"
      FOREIGN KEY ("badge_id") REFERENCES "access_badges"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_events"
      ADD CONSTRAINT "FK_access_scan_events_point"
      FOREIGN KEY ("point_id") REFERENCES "access_scan_points"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scan_events"
      ADD CONSTRAINT "FK_access_scan_events_scan_type"
      FOREIGN KEY ("scan_type_id") REFERENCES "access_scan_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scanner_grants"
      ADD CONSTRAINT "FK_access_scanner_grants_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scanner_grants"
      ADD CONSTRAINT "FK_access_scanner_grants_zone"
      FOREIGN KEY ("zone_id") REFERENCES "access_zones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_scanner_grants"
      ADD CONSTRAINT "FK_access_scanner_grants_created_by"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "access_audit_logs"
      ADD CONSTRAINT "FK_access_audit_logs_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "access_audit_logs"`);
    await queryRunner.query(`DROP TABLE "access_scanner_grants"`);
    await queryRunner.query(`DROP TABLE "access_scan_events"`);
    await queryRunner.query(`DROP TABLE "access_scan_sessions"`);
    await queryRunner.query(`DROP TABLE "access_scan_points"`);
    await queryRunner.query(`DROP TABLE "access_zones"`);
    await queryRunner.query(`DROP TABLE "access_scan_types"`);
    await queryRunner.query(`DROP TABLE "access_badge_assignments"`);
    await queryRunner.query(`DROP TABLE "access_badges"`);
    await queryRunner.query(`DROP TABLE "access_control_meta"`);
    await queryRunner.query(`DROP TYPE "public"."access_audit_action_enum"`);
    await queryRunner.query(`DROP TYPE "public"."access_scan_verdict_enum"`);
    await queryRunner.query(`DROP TYPE "public"."access_scan_duplicate_rule_enum"`);
    await queryRunner.query(`DROP TYPE "public"."access_badge_status_enum"`);
  }
}
