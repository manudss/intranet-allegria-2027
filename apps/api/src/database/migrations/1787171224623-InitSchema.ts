import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1787171224623 implements MigrationInterface {
  name = 'InitSchema1787171224623';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."participants_mejagegroup_enum" AS ENUM('TA', 'ES')`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" ADD "mejAgeGroup" "public"."participants_mejagegroup_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "participants" DROP COLUMN "mejAgeGroup"`);
    await queryRunner.query(`DROP TYPE "public"."participants_mejagegroup_enum"`);
  }
}
