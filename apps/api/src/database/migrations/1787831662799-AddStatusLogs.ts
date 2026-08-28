import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusLogs1787831662799 implements MigrationInterface {
    name = 'AddStatusLogs1787831662799'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "volunteer_skills" DROP CONSTRAINT "FK_volunteer_skills_volunteer"`);
        await queryRunner.query(`ALTER TABLE "volunteer_tags" DROP CONSTRAINT "FK_volunteer_tags_volunteer"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "FK_volunteer_shift_assignments_assigned_by"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "FK_volunteer_shift_assignments_shift"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "FK_volunteer_shift_assignments_volunteer"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shifts" DROP CONSTRAINT "FK_volunteer_shifts_mission"`);
        await queryRunner.query(`ALTER TABLE "volunteer_missions" DROP CONSTRAINT "FK_volunteer_missions_responsible"`);
        await queryRunner.query(`ALTER TABLE "volunteer_missions" DROP CONSTRAINT "FK_volunteer_missions_team"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_volunteer_team_memberships_team"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_volunteer_team_memberships_volunteer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_skills_volunteer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_skills_skill"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_tags_volunteer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_tags_value"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shift_assignments_volunteer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shift_assignments_shift"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shift_assignments_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shift_assignments_assigned_by"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shifts_mission"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shifts_start_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shifts_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_missions_team"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_missions_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_missions_location"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_missions_responsible"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_team_memberships_unique_scope"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_team_memberships_volunteer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_team_memberships_team"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shifts" DROP CONSTRAINT "CHK_volunteer_shifts_period"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shifts" DROP CONSTRAINT "CHK_volunteer_shifts_capacity"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "CHK_volunteer_team_memberships_period"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "uq_volunteer_shift_assignments_volunteer_shift"`);
        await queryRunner.query(`CREATE TYPE "public"."mission_status_logs_fromstatus_enum" AS ENUM('DRAFT', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NOT_DONE')`);
        await queryRunner.query(`CREATE TYPE "public"."mission_status_logs_tostatus_enum" AS ENUM('DRAFT', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NOT_DONE')`);
        await queryRunner.query(`CREATE TABLE "mission_status_logs" ("id" SERIAL NOT NULL, "mission_id" integer NOT NULL, "fromStatus" "public"."mission_status_logs_fromstatus_enum" NOT NULL, "toStatus" "public"."mission_status_logs_tostatus_enum" NOT NULL, "changed_by_user_id" integer, "reason" text, "isForced" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6355b33af8590b91655bee5a6ff" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."shift_status_logs_fromstatus_enum" AS ENUM('TODO', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NOT_DONE')`);
        await queryRunner.query(`CREATE TYPE "public"."shift_status_logs_tostatus_enum" AS ENUM('TODO', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NOT_DONE')`);
        await queryRunner.query(`CREATE TABLE "shift_status_logs" ("id" SERIAL NOT NULL, "shift_id" integer NOT NULL, "fromStatus" "public"."shift_status_logs_fromstatus_enum" NOT NULL, "toStatus" "public"."shift_status_logs_tostatus_enum" NOT NULL, "changed_by_user_id" integer, "reason" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b401dab5a70376f8c8cc7528a3f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "volunteer_skills" ADD CONSTRAINT "FK_a63977b1b0e88daf0f5a26f4a3a" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_tags" ADD CONSTRAINT "FK_5c6f2fbd3d83933d5f7127d6d4a" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" ADD CONSTRAINT "FK_095d5e6a6c1aa5e4864b30f664f" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" ADD CONSTRAINT "FK_e6790f1f989eebdce539ebe4360" FOREIGN KEY ("shift_id") REFERENCES "volunteer_shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" ADD CONSTRAINT "FK_1fdd00c008db36341cbcb5fb345" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_shifts" ADD CONSTRAINT "FK_8dad95c3c642ecd0acf7b990d96" FOREIGN KEY ("mission_id") REFERENCES "volunteer_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_missions" ADD CONSTRAINT "FK_f6d0182518096ab9fdb473db080" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_missions" ADD CONSTRAINT "FK_0d050d1a175483b3ca36178bba3" FOREIGN KEY ("responsible_volunteer_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_feff2926e8acffeb5757bd6050e" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_608363acfb36882502e0e282ee8" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mission_status_logs" ADD CONSTRAINT "FK_45ac58dbc379f6090a53a527c29" FOREIGN KEY ("mission_id") REFERENCES "volunteer_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mission_status_logs" ADD CONSTRAINT "FK_800a8340387e1723a0e216813f1" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shift_status_logs" ADD CONSTRAINT "FK_ece49303e519d26d01d08071791" FOREIGN KEY ("shift_id") REFERENCES "volunteer_shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shift_status_logs" ADD CONSTRAINT "FK_880353624dfeaa66bb0e93a1a96" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shift_status_logs" DROP CONSTRAINT "FK_880353624dfeaa66bb0e93a1a96"`);
        await queryRunner.query(`ALTER TABLE "shift_status_logs" DROP CONSTRAINT "FK_ece49303e519d26d01d08071791"`);
        await queryRunner.query(`ALTER TABLE "mission_status_logs" DROP CONSTRAINT "FK_800a8340387e1723a0e216813f1"`);
        await queryRunner.query(`ALTER TABLE "mission_status_logs" DROP CONSTRAINT "FK_45ac58dbc379f6090a53a527c29"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_608363acfb36882502e0e282ee8"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_feff2926e8acffeb5757bd6050e"`);
        await queryRunner.query(`ALTER TABLE "volunteer_missions" DROP CONSTRAINT "FK_0d050d1a175483b3ca36178bba3"`);
        await queryRunner.query(`ALTER TABLE "volunteer_missions" DROP CONSTRAINT "FK_f6d0182518096ab9fdb473db080"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shifts" DROP CONSTRAINT "FK_8dad95c3c642ecd0acf7b990d96"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "FK_1fdd00c008db36341cbcb5fb345"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "FK_e6790f1f989eebdce539ebe4360"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "FK_095d5e6a6c1aa5e4864b30f664f"`);
        await queryRunner.query(`ALTER TABLE "volunteer_tags" DROP CONSTRAINT "FK_5c6f2fbd3d83933d5f7127d6d4a"`);
        await queryRunner.query(`ALTER TABLE "volunteer_skills" DROP CONSTRAINT "FK_a63977b1b0e88daf0f5a26f4a3a"`);
        await queryRunner.query(`DROP TABLE "shift_status_logs"`);
        await queryRunner.query(`DROP TYPE "public"."shift_status_logs_tostatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."shift_status_logs_fromstatus_enum"`);
        await queryRunner.query(`DROP TABLE "mission_status_logs"`);
        await queryRunner.query(`DROP TYPE "public"."mission_status_logs_tostatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."mission_status_logs_fromstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" ADD CONSTRAINT "uq_volunteer_shift_assignments_volunteer_shift" UNIQUE ("volunteer_id", "shift_id")`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "CHK_volunteer_team_memberships_period" CHECK ((("startAt" IS NULL) OR ("endAt" IS NULL) OR ("endAt" > "startAt")))`);
        await queryRunner.query(`ALTER TABLE "volunteer_shifts" ADD CONSTRAINT "CHK_volunteer_shifts_capacity" CHECK (((capacity IS NULL) OR (capacity > 0)))`);
        await queryRunner.query(`ALTER TABLE "volunteer_shifts" ADD CONSTRAINT "CHK_volunteer_shifts_period" CHECK (("endAt" > "startAt"))`);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_team_memberships_team" ON "volunteer_team_memberships" USING btree ("volunteer_team_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_team_memberships_volunteer" ON "volunteer_team_memberships" USING btree ("volunteer_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_volunteer_team_memberships_unique_scope" ON "volunteer_team_memberships" USING btree ("volunteer_id", "volunteer_team_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_missions_responsible" ON "volunteer_missions" USING btree ("responsible_volunteer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_missions_location" ON "volunteer_missions" USING btree ("location") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_missions_status" ON "volunteer_missions" USING btree ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_missions_team" ON "volunteer_missions" USING btree ("volunteer_team_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_shifts_status" ON "volunteer_shifts" USING btree ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_shifts_start_at" ON "volunteer_shifts" USING btree ("startAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_shifts_mission" ON "volunteer_shifts" USING btree ("mission_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_shift_assignments_assigned_by" ON "volunteer_shift_assignments" USING btree ("assigned_by_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_shift_assignments_status" ON "volunteer_shift_assignments" USING btree ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_shift_assignments_shift" ON "volunteer_shift_assignments" USING btree ("shift_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_shift_assignments_volunteer" ON "volunteer_shift_assignments" USING btree ("volunteer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_tags_value" ON "volunteer_tags" USING btree ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_tags_volunteer" ON "volunteer_tags" USING btree ("volunteer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_skills_skill" ON "volunteer_skills" USING btree ("skill") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_skills_volunteer" ON "volunteer_skills" USING btree ("volunteer_id") `);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_volunteer_team_memberships_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_volunteer_team_memberships_team" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_missions" ADD CONSTRAINT "FK_volunteer_missions_team" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_missions" ADD CONSTRAINT "FK_volunteer_missions_responsible" FOREIGN KEY ("responsible_volunteer_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_shifts" ADD CONSTRAINT "FK_volunteer_shifts_mission" FOREIGN KEY ("mission_id") REFERENCES "volunteer_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" ADD CONSTRAINT "FK_volunteer_shift_assignments_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" ADD CONSTRAINT "FK_volunteer_shift_assignments_shift" FOREIGN KEY ("shift_id") REFERENCES "volunteer_shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments" ADD CONSTRAINT "FK_volunteer_shift_assignments_assigned_by" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_tags" ADD CONSTRAINT "FK_volunteer_tags_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_skills" ADD CONSTRAINT "FK_volunteer_skills_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
