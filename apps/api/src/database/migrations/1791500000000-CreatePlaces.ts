import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Référentiel des lieux : lieux (adresse, GPS, type, piste, responsable), salles (nom seul),
 * équipes de bénévoles rattachées au lieu, et liens facultatifs place_id / room_id sur les
 * créneaux du programme, missions, créneaux bénévoles et groupes de rassemblement.
 *
 * Additive : aucune colonne existante n'est modifiée ni supprimée, et les textes de lieu libres
 * ne sont ni lus ni réécrits (aucun rapprochement automatique). Les nouvelles colonnes sont
 * nulles pour toutes les lignes existantes. Les droits du module PLACES sont recopiés tels
 * quels (niveau, portée) depuis les règles AGENDA réellement présentes : rien n'est élargi ;
 * idempotent.
 */
export class CreatePlaces1791500000000 implements MigrationInterface {
  name = 'CreatePlaces1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."place_kind_enum" AS ENUM('GATHERING','SCHOOL','RESTAURATION','PARK','MUSEUM','PARISH','LODGING','OTHER')`,
    );
    await queryRunner.query(`CREATE TABLE "places" (
      "id" SERIAL NOT NULL,
      "name" character varying(150) NOT NULL,
      "kind" "public"."place_kind_enum" NOT NULL DEFAULT 'OTHER',
      "track" "public"."program_sequence_track_enum" NOT NULL DEFAULT 'COMMON',
      "address" character varying(255),
      "postal_code" character varying(20),
      "city" character varying(120),
      "country" character varying(80),
      "latitude" double precision,
      "longitude" double precision,
      "description" text,
      "practical_info" text,
      "responsible_volunteer_id" integer,
      "is_active" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_places" PRIMARY KEY ("id"),
      CONSTRAINT "FK_places_responsible_volunteer" FOREIGN KEY ("responsible_volunteer_id") REFERENCES "volunteers"("id") ON DELETE SET NULL,
      CONSTRAINT "CHK_places_latitude" CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90)),
      CONSTRAINT "CHK_places_longitude" CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180))
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_places_name_lower" ON "places" (lower("name"))`);
    await queryRunner.query(`CREATE TABLE "place_rooms" (
      "id" SERIAL NOT NULL,
      "place_id" integer NOT NULL,
      "name" character varying(120) NOT NULL,
      CONSTRAINT "PK_place_rooms" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_place_rooms_place_id" UNIQUE ("id", "place_id"),
      CONSTRAINT "FK_place_rooms_place" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_place_rooms_place_name" ON "place_rooms" ("place_id", lower("name"))`,
    );
    await queryRunner.query(`CREATE TABLE "place_volunteer_teams" (
      "place_id" integer NOT NULL,
      "volunteer_team_id" integer NOT NULL,
      CONSTRAINT "PK_place_volunteer_teams" PRIMARY KEY ("place_id", "volunteer_team_id"),
      CONSTRAINT "FK_place_volunteer_teams_place" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_place_volunteer_teams_team" FOREIGN KEY ("volunteer_team_id") REFERENCES "volunteer_teams"("id") ON DELETE CASCADE
    )`);

    // Liens facultatifs. La salle doit appartenir au lieu : clé composée (room_id, place_id).
    for (const table of ['program_sequences', 'volunteer_missions', 'volunteer_shifts', 'gathering_groups']) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "place_id" integer`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD "room_id" integer`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_place" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_room_in_place" FOREIGN KEY ("room_id", "place_id") REFERENCES "place_rooms"("id", "place_id") MATCH SIMPLE`,
      );
      await queryRunner.query(`CREATE INDEX "IDX_${table}_place" ON "${table}" ("place_id")`);
    }

    // Droits PLACES : copie exacte (niveau et portée) des règles AGENDA réellement en base, jamais
    // élargie. La table de suivi garde les lignes créées pour que le retour n'en supprime pas d'autres.
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "places_access_log" ("ref_id" integer PRIMARY KEY)`,
    );
    await queryRunner.query(
      `WITH ins AS (
         INSERT INTO "access_rules" ("subject_kind", "subject_key", "module", "level", "scope")
         SELECT "subject_kind", "subject_key", 'PLACES', "level", "scope"
         FROM "access_rules" WHERE "module" = 'AGENDA'
         ON CONFLICT ("subject_kind", "subject_key", "module") DO NOTHING
         RETURNING "id"
       )
       INSERT INTO "places_access_log" ("ref_id") SELECT "id" FROM ins ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "access_rules" WHERE "module" = 'PLACES' AND "id" IN (SELECT "ref_id" FROM "places_access_log")`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "places_access_log"`);
    for (const table of ['gathering_groups', 'volunteer_shifts', 'volunteer_missions', 'program_sequences']) {
      await queryRunner.query(`DROP INDEX "IDX_${table}_place"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_room_in_place"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_place"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "room_id"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "place_id"`);
    }
    await queryRunner.query(`DROP TABLE "place_volunteer_teams"`);
    await queryRunner.query(`DROP TABLE "place_rooms"`);
    await queryRunner.query(`DROP TABLE "places"`);
    await queryRunner.query(`DROP TYPE "public"."place_kind_enum"`);
  }
}
