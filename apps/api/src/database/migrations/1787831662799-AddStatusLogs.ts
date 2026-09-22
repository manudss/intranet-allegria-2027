import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusLogs1787831662799 implements MigrationInterface {
  name = 'AddStatusLogs1787831662799';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."mission_status_logs_fromstatus_enum" AS ENUM('DRAFT', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NOT_DONE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mission_status_logs_tostatus_enum" AS ENUM('DRAFT', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NOT_DONE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "mission_status_logs" ("id" SERIAL NOT NULL, "mission_id" integer NOT NULL, "fromStatus" "public"."mission_status_logs_fromstatus_enum" NOT NULL, "toStatus" "public"."mission_status_logs_tostatus_enum" NOT NULL, "changed_by_user_id" integer, "reason" text, "isForced" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6355b33af8590b91655bee5a6ff" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shift_status_logs_fromstatus_enum" AS ENUM('TODO', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NOT_DONE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."shift_status_logs_tostatus_enum" AS ENUM('TODO', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NOT_DONE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "shift_status_logs" ("id" SERIAL NOT NULL, "shift_id" integer NOT NULL, "fromStatus" "public"."shift_status_logs_fromstatus_enum" NOT NULL, "toStatus" "public"."shift_status_logs_tostatus_enum" NOT NULL, "changed_by_user_id" integer, "reason" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b401dab5a70376f8c8cc7528a3f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "mission_status_logs" ADD CONSTRAINT "FK_45ac58dbc379f6090a53a527c29" FOREIGN KEY ("mission_id") REFERENCES "volunteer_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mission_status_logs" ADD CONSTRAINT "FK_800a8340387e1723a0e216813f1" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shift_status_logs" ADD CONSTRAINT "FK_ece49303e519d26d01d08071791" FOREIGN KEY ("shift_id") REFERENCES "volunteer_shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "shift_status_logs" ADD CONSTRAINT "FK_880353624dfeaa66bb0e93a1a96" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "shift_status_logs" DROP CONSTRAINT "FK_880353624dfeaa66bb0e93a1a96"`,
    );
    await queryRunner.query(
      `ALTER TABLE "shift_status_logs" DROP CONSTRAINT "FK_ece49303e519d26d01d08071791"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mission_status_logs" DROP CONSTRAINT "FK_800a8340387e1723a0e216813f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mission_status_logs" DROP CONSTRAINT "FK_45ac58dbc379f6090a53a527c29"`,
    );
    await queryRunner.query(`DROP TABLE "shift_status_logs"`);
    await queryRunner.query(`DROP TYPE "public"."shift_status_logs_tostatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."shift_status_logs_fromstatus_enum"`);
    await queryRunner.query(`DROP TABLE "mission_status_logs"`);
    await queryRunner.query(`DROP TYPE "public"."mission_status_logs_tostatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."mission_status_logs_fromstatus_enum"`);
  }
}
