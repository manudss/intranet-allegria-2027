import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1787818873445 implements MigrationInterface {
    name = 'InitSchema1787818873445'

    public async up(_queryRunner: QueryRunner): Promise<void> {
        // No-op: volunteer_missions, volunteer_shifts tables and their enum types
        // were already created by migration 1787500000000-CreateVolunteerMissions.
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // No-op: see up().
    }

}
