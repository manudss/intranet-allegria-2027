import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rubrique « Consignes & documents » : catalogue de fiches pointant vers des
 * fichiers hébergés sur le SharePoint MEJ (la fiche ne modifie ni le fichier
 * ni son partage). Visibilité ALL (tous les utilisateurs connectés) ou TEAMS
 * (équipes opérationnelles ciblées, OU). Catégories extensibles avec
 * sous-catégories (parent_id auto-référencé).
 */
export class CreateDocumentLibrary1790500000000 implements MigrationInterface {
  name = 'CreateDocumentLibrary1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."document_links_filetype_enum" AS ENUM('PDF', 'DOCX', 'XLSX', 'PPTX', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_links_visibility_enum" AS ENUM('ALL', 'TEAMS')`,
    );

    await queryRunner.query(`CREATE TABLE "document_categories" (
      "id" SERIAL NOT NULL,
      "code" character varying(80) NOT NULL,
      "label" character varying(120) NOT NULL,
      "parent_id" integer,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_document_categories_id" PRIMARY KEY ("id"),
      CONSTRAINT "uq_document_categories_code" UNIQUE ("code"),
      CONSTRAINT "FK_document_categories_parent" FOREIGN KEY ("parent_id")
        REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    )`);

    await queryRunner.query(`CREATE TABLE "document_links" (
      "id" SERIAL NOT NULL,
      "title" character varying(200) NOT NULL,
      "description" text,
      "url" character varying(1024) NOT NULL,
      "fileType" "public"."document_links_filetype_enum" NOT NULL DEFAULT 'OTHER',
      "category_id" integer,
      "visibility" "public"."document_links_visibility_enum" NOT NULL DEFAULT 'ALL',
      "created_by_user_id" integer,
      "updated_by_user_id" integer,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_document_links_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_document_links_category" FOREIGN KEY ("category_id")
        REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
      CONSTRAINT "FK_document_links_created_by" FOREIGN KEY ("created_by_user_id")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
      CONSTRAINT "FK_document_links_updated_by" FOREIGN KEY ("updated_by_user_id")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    )`);

    await queryRunner.query(`CREATE TABLE "document_link_teams" (
      "id" SERIAL NOT NULL,
      "document_link_id" integer NOT NULL,
      "volunteer_team_id" integer NOT NULL,
      CONSTRAINT "PK_document_link_teams_id" PRIMARY KEY ("id"),
      CONSTRAINT "uq_document_link_team" UNIQUE ("document_link_id", "volunteer_team_id"),
      CONSTRAINT "FK_document_link_teams_link" FOREIGN KEY ("document_link_id")
        REFERENCES "document_links"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT "FK_document_link_teams_team" FOREIGN KEY ("volunteer_team_id")
        REFERENCES "volunteer_teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    )`);

    await queryRunner.query(
      `CREATE INDEX "IDX_document_link_teams_link" ON "document_link_teams" ("document_link_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_document_link_teams_team" ON "document_link_teams" ("volunteer_team_id")`,
    );

    await queryRunner.query(`INSERT INTO "document_categories" ("code", "label", "sortOrder")
      SELECT * FROM (VALUES
        ('MUSIQUE', 'Musique', 10),
        ('ANIMATION', 'Animation', 20),
        ('ANIMATION_SPIRITUELLE', 'Animation spirituelle', 30),
        ('LOGISTIQUE', 'Logistique', 40),
        ('LIEN_EXTERNE', 'Lien externe', 50),
        ('COMMUNICATION', 'Communication', 60),
        ('FINANCES', 'Finances', 70),
        ('TA', 'TA', 80),
        ('ES', 'ES', 90),
        ('ANIMATEURS', 'Animateurs', 100),
        ('BENEVOLES', 'Bénévoles', 110)
      ) AS seed("code", "label", "sortOrder")
      WHERE NOT EXISTS (SELECT 1 FROM "document_categories" WHERE "code" = seed."code")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_document_link_teams_team"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_document_link_teams_link"`);
    await queryRunner.query(`DROP TABLE "document_link_teams"`);
    await queryRunner.query(`DROP TABLE "document_links"`);
    await queryRunner.query(`DROP TABLE "document_categories"`);
    await queryRunner.query(`DROP TYPE "public"."document_links_visibility_enum"`);
    await queryRunner.query(`DROP TYPE "public"."document_links_filetype_enum"`);
  }
}
