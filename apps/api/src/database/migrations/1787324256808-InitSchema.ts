import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1787324256808 implements MigrationInterface {
    name = 'InitSchema1787324256808'

    public async up(_queryRunner: QueryRunner): Promise<void> {
        // No-op: was renaming auto-generated FK constraint names; the base migrations
        // 1787400000000-AddVolunteerSkillsAndTags already use consistent named constraints.
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // No-op: see up().
    }

}
