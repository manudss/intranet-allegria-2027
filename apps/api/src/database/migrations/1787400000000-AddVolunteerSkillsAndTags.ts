import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerSkillsAndTags1787400000000 implements MigrationInterface {
  name = 'AddVolunteerSkillsAndTags1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."volunteer_skills_skill_enum" AS ENUM(
      'SECURITY',
      'ANIMATION',
      'LITURGY',
      'LOGISTICS',
      'HEALTH',
      'RECEPTION',
      'TRANSPORT',
      'ACCOMMODATION',
      'COMMUNICATION',
      'CATERING',
      'CLEANING',
      'MISCELLANEOUS',
      'OTHER'
    )`);

    await queryRunner.query(`CREATE TABLE "volunteer_skills" (
      "id" SERIAL NOT NULL,
      "volunteer_id" integer NOT NULL,
      "skill" "public"."volunteer_skills_skill_enum" NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_skills_id" PRIMARY KEY ("id"),
      CONSTRAINT "uq_volunteer_skills_volunteer_skill" UNIQUE ("volunteer_id", "skill")
    )`);

    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_skills_volunteer" ON "volunteer_skills" ("volunteer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_skills_skill" ON "volunteer_skills" ("skill")`,
    );

    await queryRunner.query(`ALTER TABLE "volunteer_skills"
      ADD CONSTRAINT "FK_volunteer_skills_volunteer"
      FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`CREATE TABLE "volunteer_tags" (
      "id" SERIAL NOT NULL,
      "volunteer_id" integer NOT NULL,
      "value" text NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_tags_id" PRIMARY KEY ("id")
    )`);

    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_tags_volunteer" ON "volunteer_tags" ("volunteer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_tags_value" ON "volunteer_tags" ("value")`,
    );

    await queryRunner.query(`ALTER TABLE "volunteer_tags"
      ADD CONSTRAINT "FK_volunteer_tags_volunteer"
      FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteer_tags" DROP CONSTRAINT "FK_volunteer_tags_volunteer"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_tags_value"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_tags_volunteer"`);
    await queryRunner.query(`DROP TABLE "volunteer_tags"`);

    await queryRunner.query(
      `ALTER TABLE "volunteer_skills" DROP CONSTRAINT "FK_volunteer_skills_volunteer"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_skills_skill"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_skills_volunteer"`);
    await queryRunner.query(`DROP TABLE "volunteer_skills"`);

    await queryRunner.query(`DROP TYPE "public"."volunteer_skills_skill_enum"`);
  }
}
