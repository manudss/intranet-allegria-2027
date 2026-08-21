import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1787316722376 implements MigrationInterface {
    name = 'InitSchema1787316722376'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_volunteer_team_memberships_volunteer"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_volunteer_team_memberships_team"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_team_memberships_unique_scope"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_team_memberships_volunteer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_team_memberships_team"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "CHK_volunteer_team_memberships_period"`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" DROP COLUMN "is_active"`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP COLUMN "start_at"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP COLUMN "end_at"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" ADD "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD "startAt" date`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD "endAt" date`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_feff2926e8acffeb5757bd6050e" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_608363acfb36882502e0e282ee8" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_608363acfb36882502e0e282ee8"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP CONSTRAINT "FK_feff2926e8acffeb5757bd6050e"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP COLUMN "endAt"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" DROP COLUMN "startAt"`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD "end_at" date`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD "start_at" date`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "volunteer_teams" ADD "is_active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "CHK_volunteer_team_memberships_period" CHECK (((start_at IS NULL) OR (end_at IS NULL) OR (end_at > start_at)))`);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_team_memberships_team" ON "volunteer_team_memberships" USING btree ("volunteer_team_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_team_memberships_volunteer" ON "volunteer_team_memberships" USING btree ("volunteer_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_volunteer_team_memberships_unique_scope" ON "volunteer_team_memberships" USING btree ("volunteer_id", "volunteer_team_id") `);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_volunteer_team_memberships_team" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_team_memberships" ADD CONSTRAINT "FK_volunteer_team_memberships_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
