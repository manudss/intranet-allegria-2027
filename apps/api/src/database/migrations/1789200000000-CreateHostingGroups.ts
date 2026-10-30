import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHostingGroups1789200000000 implements MigrationInterface {
  name = 'CreateHostingGroups1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "hosting_groups" (
      "id" SERIAL NOT NULL,
      "name" character varying(150) NOT NULL,
      "notes" text,
      CONSTRAINT "PK_hosting_groups" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN "hosting_group_id" integer`);
    await queryRunner.query(`ALTER TABLE "host_families" ADD COLUMN "hosting_group_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_hosting_group" FOREIGN KEY ("hosting_group_id") REFERENCES "hosting_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "host_families" ADD CONSTRAINT "FK_host_families_hosting_group" FOREIGN KEY ("hosting_group_id") REFERENCES "hosting_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_teams_hosting_group" ON "teams" ("hosting_group_id")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_host_families_hosting_group" ON "host_families" ("hosting_group_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_host_families_hosting_group"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_teams_hosting_group"`);
    await queryRunner.query(`ALTER TABLE "host_families" DROP CONSTRAINT "FK_host_families_hosting_group"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_hosting_group"`);
    await queryRunner.query(`ALTER TABLE "host_families" DROP COLUMN "hosting_group_id"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "hosting_group_id"`);
    await queryRunner.query(`DROP TABLE "hosting_groups"`);
  }
}
