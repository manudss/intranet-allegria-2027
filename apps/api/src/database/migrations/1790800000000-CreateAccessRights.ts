import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_ACCESS_RULES } from '../../app/core/access-rights/access-defaults';

/**
 * Matrice de droits configurable : une règle = (rôle OU type d'équipe) x module -> niveau + portée.
 * Les droits de départ viennent du dossier « Droits Alegria » (propositions, modifiables en admin).
 * Aucune équipe existante n'a de type : seuls les rôles actuels portent des droits au départ.
 */
export class CreateAccessRights1790800000000 implements MigrationInterface {
  name = 'CreateAccessRights1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "access_rules" (
      "id" SERIAL NOT NULL,
      "subject_kind" character varying(20) NOT NULL,
      "subject_key" character varying(80) NOT NULL,
      "module" character varying(60) NOT NULL,
      "level" character varying(10) NOT NULL,
      "scope" character varying(20) NOT NULL DEFAULT 'ALL',
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_access_rules_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_access_rules_subject_module" UNIQUE ("subject_kind", "subject_key", "module"),
      CONSTRAINT "CHK_access_rules_kind" CHECK ("subject_kind" IN ('ROLE', 'TEAM_TYPE')),
      CONSTRAINT "CHK_access_rules_level" CHECK ("level" IN ('VIEW', 'EDIT', 'MANAGE')),
      CONSTRAINT "CHK_access_rules_scope" CHECK ("scope" IN ('ALL', 'GROUPS', 'OWN_TEAM', 'SELF'))
    )`);
    await queryRunner.query(`CREATE TABLE "access_overrides" (
      "id" SERIAL NOT NULL,
      "user_id" integer NOT NULL,
      "module" character varying(60) NOT NULL,
      "level" character varying(10) NOT NULL,
      "scope" character varying(20) NOT NULL DEFAULT 'ALL',
      "reason" text NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE,
      "created_by" integer,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_access_overrides_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_access_overrides_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "CHK_access_overrides_level" CHECK ("level" IN ('VIEW', 'EDIT', 'MANAGE')),
      CONSTRAINT "CHK_access_overrides_scope" CHECK ("scope" IN ('ALL', 'GROUPS', 'OWN_TEAM', 'SELF'))
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_access_overrides_user" ON "access_overrides" ("user_id")`,
    );
    await queryRunner.query(`CREATE TABLE "user_group_scopes" (
      "user_id" integer NOT NULL,
      "group_id" integer NOT NULL,
      CONSTRAINT "PK_user_group_scopes" PRIMARY KEY ("user_id", "group_id"),
      CONSTRAINT "FK_user_group_scopes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_user_group_scopes_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE "access_rule_logs" (
      "id" SERIAL NOT NULL,
      "actor_user_id" integer,
      "actor_email" character varying(255),
      "action" character varying(60) NOT NULL,
      "detail" jsonb NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_access_rule_logs_id" PRIMARY KEY ("id")
    )`);

    for (const rule of DEFAULT_ACCESS_RULES) {
      await queryRunner.query(
        `INSERT INTO "access_rules" ("subject_kind", "subject_key", "module", "level", "scope") VALUES ($1, $2, $3, $4, $5)`,
        [rule.subjectKind, rule.subjectKey, rule.module, rule.level, rule.scope],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "access_rule_logs"`);
    await queryRunner.query(`DROP TABLE "user_group_scopes"`);
    await queryRunner.query(`DROP TABLE "access_overrides"`);
    await queryRunner.query(`DROP TABLE "access_rules"`);
  }
}
