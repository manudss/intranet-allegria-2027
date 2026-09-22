import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1787316722376 implements MigrationInterface {
  name = 'InitSchema1787316722376';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // No-op: superseded by 1787310000000-CreateVolunteerTeams which now creates
    // volunteer_teams and volunteer_team_memberships with camelCase column names directly.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: see up().
  }
}
