import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1787324256808 implements MigrationInterface {
    name = 'InitSchema1787324256808'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "volunteer_skills" DROP CONSTRAINT "FK_volunteer_skills_volunteer"`);
        await queryRunner.query(`ALTER TABLE "volunteer_tags" DROP CONSTRAINT "FK_volunteer_tags_volunteer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_skills_volunteer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_skills_skill"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_tags_volunteer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_tags_value"`);
        await queryRunner.query(`ALTER TABLE "volunteer_skills" ADD CONSTRAINT "FK_a63977b1b0e88daf0f5a26f4a3a" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_tags" ADD CONSTRAINT "FK_5c6f2fbd3d83933d5f7127d6d4a" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "volunteer_tags" DROP CONSTRAINT "FK_5c6f2fbd3d83933d5f7127d6d4a"`);
        await queryRunner.query(`ALTER TABLE "volunteer_skills" DROP CONSTRAINT "FK_a63977b1b0e88daf0f5a26f4a3a"`);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_tags_value" ON "volunteer_tags" USING btree ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_tags_volunteer" ON "volunteer_tags" USING btree ("volunteer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_skills_skill" ON "volunteer_skills" USING btree ("skill") `);
        await queryRunner.query(`CREATE INDEX "IDX_volunteer_skills_volunteer" ON "volunteer_skills" USING btree ("volunteer_id") `);
        await queryRunner.query(`ALTER TABLE "volunteer_tags" ADD CONSTRAINT "FK_volunteer_tags_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "volunteer_skills" ADD CONSTRAINT "FK_volunteer_skills_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
