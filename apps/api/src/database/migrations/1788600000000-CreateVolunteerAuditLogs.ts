import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVolunteerAuditLogs1788600000000 implements MigrationInterface {
  name = 'CreateVolunteerAuditLogs1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."volunteer_audit_action_enum" AS ENUM(
      'CREATE',
      'UPDATE',
      'DELETE',
      'STATUS_CHANGED',
      'ASSIGNMENT_CHANGED'
    )`);

    await queryRunner.query(`CREATE TABLE "volunteer_audit_logs" (
      "id" SERIAL NOT NULL,
      "user_id" integer NOT NULL,
      "action" "public"."volunteer_audit_action_enum" NOT NULL,
      "entityType" character varying(100) NOT NULL,
      "entityId" integer NOT NULL,
      "beforeData" jsonb,
      "afterData" jsonb,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_audit_logs_id" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_audit_logs_createdAt" ON "volunteer_audit_logs" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_audit_logs_user_id" ON "volunteer_audit_logs" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_audit_logs_action" ON "volunteer_audit_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_audit_logs_entityType" ON "volunteer_audit_logs" ("entityType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_audit_logs_entityId" ON "volunteer_audit_logs" ("entityId")`,
    );

    await queryRunner.query(`ALTER TABLE "volunteer_audit_logs"
      ADD CONSTRAINT "FK_volunteer_audit_logs_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteer_audit_logs" DROP CONSTRAINT "FK_volunteer_audit_logs_user"`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_audit_logs_entityId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_audit_logs_entityType"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_audit_logs_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_audit_logs_createdAt"`);

    await queryRunner.query(`DROP TABLE "volunteer_audit_logs"`);
    await queryRunner.query(`DROP TYPE "public"."volunteer_audit_action_enum"`);
  }
}
