import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Délégations & trajets : transports de délégation (aller/retour, jauge
 * facultative), affectations des personnes (jeunes et bénévoles) et notes
 * logistiques signées/datées. Convention colonnes camelCase (sans stratégie
 * de nommage) et colonnes de jointure snake_case explicites.
 */
export class DelegationTransports1791100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "transport_direction_enum" AS ENUM ('ALLER', 'RETOUR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "transport_mode_enum" AS ENUM ('TRAIN', 'CAR', 'VOITURES', 'AUTRE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "assignment_person_type_enum" AS ENUM ('PARTICIPANT', 'VOLUNTEER')`,
    );
    await queryRunner.query(`
      CREATE TABLE "delegation_transports" (
        "id" SERIAL PRIMARY KEY,
        "delegation_id" integer NOT NULL,
        "direction" "transport_direction_enum" NOT NULL,
        "transportMode" "transport_mode_enum" NOT NULL,
        "name" varchar NOT NULL,
        "departureDatetime" timestamptz,
        "arrivalDatetime" timestamptz,
        "meetingPoint" varchar,
        "practicalInfo" text,
        "capacity" integer,
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_delegation_transports_delegation" FOREIGN KEY ("delegation_id")
          REFERENCES "groups"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "transport_assignments" (
        "id" SERIAL PRIMARY KEY,
        "personType" "assignment_person_type_enum" NOT NULL,
        "personId" integer NOT NULL,
        "direction" "transport_direction_enum" NOT NULL,
        "delegation_id" integer NOT NULL,
        "transport_id" integer,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "one_assignment_per_person_and_direction" UNIQUE ("personType", "personId", "direction"),
        CONSTRAINT "FK_transport_assignments_delegation" FOREIGN KEY ("delegation_id")
          REFERENCES "groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transport_assignments_transport" FOREIGN KEY ("transport_id")
          REFERENCES "delegation_transports"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "person_notes" (
        "id" SERIAL PRIMARY KEY,
        "personType" "assignment_person_type_enum" NOT NULL,
        "personId" integer NOT NULL,
        "delegation_id" integer NOT NULL,
        "author_user_id" integer,
        "authorName" varchar NOT NULL,
        "authorRole" varchar NOT NULL,
        "parent_id" integer,
        "body" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_person_notes_delegation" FOREIGN KEY ("delegation_id")
          REFERENCES "groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_person_notes_author" FOREIGN KEY ("author_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_person_notes_parent" FOREIGN KEY ("parent_id")
          REFERENCES "person_notes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "volunteers" ADD COLUMN "group_id" integer;
      ALTER TABLE "volunteers" ADD CONSTRAINT "FK_volunteers_group" FOREIGN KEY ("group_id")
        REFERENCES "groups"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteers" DROP CONSTRAINT "FK_volunteers_group"; ALTER TABLE "volunteers" DROP COLUMN "group_id"`,
    );
    await queryRunner.query(`DROP TABLE "person_notes"`);
    await queryRunner.query(`DROP TABLE "transport_assignments"`);
    await queryRunner.query(`DROP TABLE "delegation_transports"`);
    await queryRunner.query(`DROP TYPE "assignment_person_type_enum"`);
    await queryRunner.query(`DROP TYPE "transport_mode_enum"`);
    await queryRunner.query(`DROP TYPE "transport_direction_enum"`);
  }
}
