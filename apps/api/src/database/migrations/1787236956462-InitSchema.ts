import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1787236956462 implements MigrationInterface {
    name = 'InitSchema1787236956462'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" DROP CONSTRAINT "FK_assignments_participant"`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" DROP CONSTRAINT "FK_assignments_host_family"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_user"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_role"`);
        await queryRunner.query(`ALTER TABLE "team_participants" DROP CONSTRAINT "FK_team_participants_team"`);
        await queryRunner.query(`ALTER TABLE "team_participants" DROP CONSTRAINT "FK_team_participants_participant"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_group"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_primary_animator"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_secondary_animator"`);
        await queryRunner.query(`ALTER TABLE "volunteers" DROP CONSTRAINT "FK_volunteers_user"`);
        await queryRunner.query(`ALTER TABLE "participant_health" DROP CONSTRAINT "FK_participant_health_participant"`);
        await queryRunner.query(`ALTER TABLE "participant_health" DROP CONSTRAINT "FK_participant_health_last_updated_by"`);
        await queryRunner.query(`ALTER TABLE "participants" DROP CONSTRAINT "FK_participants_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_assignments_host_family"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_assignments_participant_status"`);
        await queryRunner.query(`ALTER TABLE "team_participants" DROP CONSTRAINT "UQ_team_participants_team_participant"`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ALTER COLUMN "participant_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ALTER COLUMN "host_family_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "team_participants" ALTER COLUMN "team_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "team_participants" ALTER COLUMN "participant_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "participant_health" ALTER COLUMN "participant_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "team_participants" ADD CONSTRAINT "uq_team_participant" UNIQUE ("team_id", "participant_id")`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ADD CONSTRAINT "FK_303c4de3917711abba6b6ff7d72" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ADD CONSTRAINT "FK_df4e4d5245e16f76280e646f73f" FOREIGN KEY ("host_family_id") REFERENCES "host_families"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_participants" ADD CONSTRAINT "FK_3104abd17877ba6cf1e9156ca3a" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_participants" ADD CONSTRAINT "FK_45a0b1789995b3c976864ef57b9" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_dac3c13839536151455938e66b7" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_21378a94ce92d3882e1794fe24e" FOREIGN KEY ("primary_animator_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_07e447d961e77a68ad79d04ec30" FOREIGN KEY ("secondary_animator_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteers" ADD CONSTRAINT "FK_b476166961c3d8f8f22198f88e6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant_health" ADD CONSTRAINT "FK_52d84838a21bea92b694bf678da" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant_health" ADD CONSTRAINT "FK_1bb66d52d6da52b6d8d9222477e" FOREIGN KEY ("last_updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participants" ADD CONSTRAINT "FK_d362e8c1c06f89fbbe0817f6b76" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "participants" DROP CONSTRAINT "FK_d362e8c1c06f89fbbe0817f6b76"`);
        await queryRunner.query(`ALTER TABLE "participant_health" DROP CONSTRAINT "FK_1bb66d52d6da52b6d8d9222477e"`);
        await queryRunner.query(`ALTER TABLE "participant_health" DROP CONSTRAINT "FK_52d84838a21bea92b694bf678da"`);
        await queryRunner.query(`ALTER TABLE "volunteers" DROP CONSTRAINT "FK_b476166961c3d8f8f22198f88e6"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_07e447d961e77a68ad79d04ec30"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_21378a94ce92d3882e1794fe24e"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_dac3c13839536151455938e66b7"`);
        await queryRunner.query(`ALTER TABLE "team_participants" DROP CONSTRAINT "FK_45a0b1789995b3c976864ef57b9"`);
        await queryRunner.query(`ALTER TABLE "team_participants" DROP CONSTRAINT "FK_3104abd17877ba6cf1e9156ca3a"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" DROP CONSTRAINT "FK_df4e4d5245e16f76280e646f73f"`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" DROP CONSTRAINT "FK_303c4de3917711abba6b6ff7d72"`);
        await queryRunner.query(`ALTER TABLE "team_participants" DROP CONSTRAINT "uq_team_participant"`);
        await queryRunner.query(`ALTER TABLE "participant_health" ALTER COLUMN "participant_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "team_participants" ALTER COLUMN "participant_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "team_participants" ALTER COLUMN "team_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ALTER COLUMN "host_family_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ALTER COLUMN "participant_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ALTER COLUMN "type" SET DEFAULT 'JEUNE'`);
        await queryRunner.query(`ALTER TABLE "team_participants" ADD CONSTRAINT "UQ_team_participants_team_participant" UNIQUE ("participant_id", "team_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_assignments_participant_status" ON "participant_host_family_assignments" USING btree ("participant_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_assignments_host_family" ON "participant_host_family_assignments" USING btree ("host_family_id") `);
        await queryRunner.query(`ALTER TABLE "participants" ADD CONSTRAINT "FK_participants_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant_health" ADD CONSTRAINT "FK_participant_health_last_updated_by" FOREIGN KEY ("last_updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant_health" ADD CONSTRAINT "FK_participant_health_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteers" ADD CONSTRAINT "FK_volunteers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_secondary_animator" FOREIGN KEY ("secondary_animator_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_primary_animator" FOREIGN KEY ("primary_animator_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_participants" ADD CONSTRAINT "FK_team_participants_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_participants" ADD CONSTRAINT "FK_team_participants_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ADD CONSTRAINT "FK_assignments_host_family" FOREIGN KEY ("host_family_id") REFERENCES "host_families"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "participant_host_family_assignments" ADD CONSTRAINT "FK_assignments_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
