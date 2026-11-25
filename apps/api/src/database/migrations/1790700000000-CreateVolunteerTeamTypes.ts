import { MigrationInterface, QueryRunner } from 'typeorm';
import { PROPOSED_VOLUNTEER_TEAM_TYPES } from '../volunteer-team-types.data';

/**
 * Types d'équipes opérationnelles (champ optionnel sur volunteer_teams).
 * Liste de départ = types PROPOSÉS dans la note « Droits Alegria » (25 nov. 2026),
 * non validés : l'admin peut les renommer, désactiver ou en ajouter.
 * Aucune équipe existante n'est rattachée automatiquement, aucun droit n'en découle.
 */
export class CreateVolunteerTeamTypes1790700000000 implements MigrationInterface {
  name = 'CreateVolunteerTeamTypes1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "volunteer_team_types" (
      "id" SERIAL NOT NULL,
      "code" character varying(80) NOT NULL,
      "label" character varying(120) NOT NULL,
      "description" text,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_team_types_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_volunteer_team_types_code" UNIQUE ("code")
    )`);
    await queryRunner.query(`ALTER TABLE "volunteer_teams" ADD "type_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "volunteer_teams" ADD CONSTRAINT "FK_volunteer_teams_type" FOREIGN KEY ("type_id") REFERENCES "volunteer_team_types"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_teams_type_id" ON "volunteer_teams" ("type_id")`,
    );

    const types = PROPOSED_VOLUNTEER_TEAM_TYPES;
    for (const [index, [code, label, description]] of types.entries()) {
      await queryRunner.query(
        `INSERT INTO "volunteer_team_types" ("code", "label", "description", "sortOrder") VALUES ($1, $2, $3, $4)`,
        [code, label, description, (index + 1) * 10],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_teams_type_id"`);
    await queryRunner.query(
      `ALTER TABLE "volunteer_teams" DROP CONSTRAINT "FK_volunteer_teams_type"`,
    );
    await queryRunner.query(`ALTER TABLE "volunteer_teams" DROP COLUMN "type_id"`);
    await queryRunner.query(`DROP TABLE "volunteer_team_types"`);
  }
}
