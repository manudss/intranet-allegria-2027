import { MigrationInterface, QueryRunner } from 'typeorm';

export class HostingGroupKindAndAccommodationType1789300000000 implements MigrationInterface {
  name = 'HostingGroupKindAndAccommodationType1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hosting_groups" ADD COLUMN "kind" character varying(20) NOT NULL DEFAULT 'OTHER'`);
    await queryRunner.query(`ALTER TABLE "hosting_groups" ADD COLUMN "color" character varying(7)`);
    await queryRunner.query(`ALTER TABLE "host_families" ADD COLUMN "accommodation_type" character varying(20) NOT NULL DEFAULT 'FAMILY'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "host_families" DROP COLUMN "accommodation_type"`);
    await queryRunner.query(`ALTER TABLE "hosting_groups" DROP COLUMN "color"`);
    await queryRunner.query(`ALTER TABLE "hosting_groups" DROP COLUMN "kind"`);
  }
}
