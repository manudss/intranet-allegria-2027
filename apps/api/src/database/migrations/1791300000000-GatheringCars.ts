import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Transports du rassemblement : cars (jauge facultative, jours de circulation),
 * arrêts ordonnés, affectations des cibles (groupes d'hébergement, hébergements
 * collectifs isolés) et exceptions individuelles. Distinct des trajets de
 * délégation (delegation_transports), qui ne sont pas touchés.
 * Convention colonnes camelCase (sans stratégie de nommage) et jointures snake_case.
 */
export class GatheringCars1791300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "gathering_car_target_enum" AS ENUM ('HOSTING_GROUP', 'HOST_FAMILY')`,
    );
    await queryRunner.query(
      `CREATE TYPE "gathering_car_person_kind_enum" AS ENUM ('ADDED', 'REMOVED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "gathering_cars" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar(180) NOT NULL,
        "capacity" integer,
        "serviceDates" text[],
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "gathering_car_stops" (
        "id" SERIAL PRIMARY KEY,
        "car_id" integer NOT NULL REFERENCES "gathering_cars"("id") ON DELETE CASCADE,
        "orderIndex" integer NOT NULL,
        "label" varchar(200) NOT NULL,
        "time" varchar(5)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "gathering_car_assignments" (
        "id" SERIAL PRIMARY KEY,
        "car_id" integer NOT NULL REFERENCES "gathering_cars"("id") ON DELETE CASCADE,
        "targetType" "gathering_car_target_enum" NOT NULL,
        "hosting_group_id" integer REFERENCES "hosting_groups"("id") ON DELETE CASCADE,
        "host_family_id" integer REFERENCES "host_families"("id") ON DELETE CASCADE,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Une cible n'est desservie que par un seul car à la fois (nul ≠ cible).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_gathering_assignment_group" ON "gathering_car_assignments" ("hosting_group_id") WHERE "hosting_group_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_gathering_assignment_family" ON "gathering_car_assignments" ("host_family_id") WHERE "host_family_id" IS NOT NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "gathering_car_persons" (
        "id" SERIAL PRIMARY KEY,
        "car_id" integer NOT NULL REFERENCES "gathering_cars"("id") ON DELETE CASCADE,
        "participant_id" integer NOT NULL REFERENCES "participants"("id") ON DELETE CASCADE,
        "kind" "gathering_car_person_kind_enum" NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_gathering_car_person" UNIQUE ("car_id", "participant_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "gathering_car_persons"`);
    await queryRunner.query(`DROP TABLE "gathering_car_assignments"`);
    await queryRunner.query(`DROP TABLE "gathering_car_stops"`);
    await queryRunner.query(`DROP TABLE "gathering_cars"`);
    await queryRunner.query(`DROP TYPE "gathering_car_person_kind_enum"`);
    await queryRunner.query(`DROP TYPE "gathering_car_target_enum"`);
  }
}
