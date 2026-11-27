import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Groupes de rassemblement : répartitions (par temps ou autonomes), groupes catégorisés
 * TA / ES / mixte avec capacité en personnes, affectations d'équipes entières (une seule
 * par répartition), rattachement d'équipes opérationnelles de bénévoles, responsables de
 * groupes (périmètre de la portée « ses groupes ») et piste TA / ES sur les équipes.
 */
export class CreateGatheringGroups1791000000000 implements MigrationInterface {
  name = 'CreateGatheringGroups1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams" ADD "track" "public"."program_sequence_track_enum" NOT NULL DEFAULT 'COMMON'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."gathering_group_category_enum" AS ENUM('TA', 'ES', 'MIXTE')`,
    );
    await queryRunner.query(`CREATE TABLE "gathering_repartitions" (
      "id" SERIAL NOT NULL,
      "name" character varying(150) NOT NULL,
      "program_sequence_id" integer,
      "allow_overflow" boolean NOT NULL DEFAULT false,
      "count_animators" boolean NOT NULL DEFAULT true,
      "notes" text,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_gathering_repartitions" PRIMARY KEY ("id"),
      CONSTRAINT "FK_gathering_repartitions_sequence" FOREIGN KEY ("program_sequence_id") REFERENCES "program_sequences"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_gathering_repartitions_sequence" ON "gathering_repartitions" ("program_sequence_id")`,
    );
    await queryRunner.query(`CREATE TABLE "gathering_groups" (
      "id" SERIAL NOT NULL,
      "repartition_id" integer NOT NULL,
      "name" character varying(150) NOT NULL,
      "category" "public"."gathering_group_category_enum" NOT NULL DEFAULT 'MIXTE',
      "capacity_persons" integer,
      "location" character varying(200),
      "hosting_group_id" integer,
      "document_link_id" integer,
      "notes" text,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_gathering_groups" PRIMARY KEY ("id"),
      CONSTRAINT "FK_gathering_groups_repartition" FOREIGN KEY ("repartition_id") REFERENCES "gathering_repartitions"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_gathering_groups_hosting_group" FOREIGN KEY ("hosting_group_id") REFERENCES "hosting_groups"("id") ON DELETE SET NULL,
      CONSTRAINT "FK_gathering_groups_document_link" FOREIGN KEY ("document_link_id") REFERENCES "document_links"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_gathering_groups_repartition" ON "gathering_groups" ("repartition_id")`,
    );
    await queryRunner.query(`CREATE TABLE "gathering_group_teams" (
      "group_id" integer NOT NULL,
      "team_id" integer NOT NULL,
      "repartition_id" integer NOT NULL,
      CONSTRAINT "PK_gathering_group_teams" PRIMARY KEY ("group_id", "team_id", "repartition_id"),
      CONSTRAINT "UQ_gathering_group_teams_team_repartition" UNIQUE ("team_id", "repartition_id"),
      CONSTRAINT "FK_gathering_group_teams_group" FOREIGN KEY ("group_id") REFERENCES "gathering_groups"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_gathering_group_teams_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_gathering_group_teams_repartition" FOREIGN KEY ("repartition_id") REFERENCES "gathering_repartitions"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE "gathering_group_volunteer_teams" (
      "group_id" integer NOT NULL,
      "volunteer_team_id" integer NOT NULL,
      CONSTRAINT "PK_gathering_group_volunteer_teams" PRIMARY KEY ("group_id", "volunteer_team_id"),
      CONSTRAINT "FK_gathering_group_volunteer_teams_group" FOREIGN KEY ("group_id") REFERENCES "gathering_groups"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_gathering_group_volunteer_teams_team" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE "gathering_group_managers" (
      "group_id" integer NOT NULL,
      "user_id" integer NOT NULL,
      CONSTRAINT "PK_gathering_group_managers" PRIMARY KEY ("group_id", "user_id"),
      CONSTRAINT "FK_gathering_group_managers_group" FOREIGN KEY ("group_id") REFERENCES "gathering_groups"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_gathering_group_managers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    )`);

    // Droits de départ du nouveau module (fermé par défaut pour tous les autres rôles et types) :
    // admin et coordinateurs Gérer, comme sur les autres modules. Idempotent.
    await queryRunner.query(
      `INSERT INTO "access_rules" ("subject_kind", "subject_key", "module", "level", "scope")
       VALUES ('ROLE', 'ADMIN', 'GATHERING_GROUPS', 'MANAGE', 'ALL'),
              ('ROLE', 'COORDINATOR', 'GATHERING_GROUPS', 'MANAGE', 'ALL')
       ON CONFLICT ("subject_kind", "subject_key", "module") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "access_rules" WHERE "module" = 'GATHERING_GROUPS'`,
    );
    await queryRunner.query(`DROP TABLE "gathering_group_managers"`);
    await queryRunner.query(`DROP TABLE "gathering_group_volunteer_teams"`);
    await queryRunner.query(`DROP TABLE "gathering_group_teams"`);
    await queryRunner.query(`DROP TABLE "gathering_groups"`);
    await queryRunner.query(`DROP TABLE "gathering_repartitions"`);
    await queryRunner.query(`DROP TYPE "public"."gathering_group_category_enum"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "track"`);
  }
}
