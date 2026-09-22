import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAllegriaIntranet1785060000000 implements MigrationInterface {
  name = 'InitAllegriaIntranet1785060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."participants_sex_enum" AS ENUM('FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."team_participants_role_enum" AS ENUM('MEMBER', 'ASSISTANT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."participant_host_family_assignments_status_enum" AS ENUM('PLANNED', 'CONFIRMED', 'CANCELLED', 'COMPLETED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "email" character varying(255) NOT NULL,
        "passwordHash" character varying(255) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" SERIAL NOT NULL,
        "code" character varying(80) NOT NULL,
        "label" character varying(120) NOT NULL,
        CONSTRAINT "UQ_roles_code" UNIQUE ("code"),
        CONSTRAINT "PK_roles_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id" SERIAL NOT NULL,
        "name" character varying(150) NOT NULL,
        "diocese" character varying(120),
        "arrivalDatetime" TIMESTAMP WITH TIME ZONE,
        "departureDatetime" TIMESTAMP WITH TIME ZONE,
        "notes" text,
        CONSTRAINT "PK_groups_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "participants" (
        "id" SERIAL NOT NULL,
        "firstName" character varying(120) NOT NULL,
        "lastName" character varying(120) NOT NULL,
        "dateOfBirth" date NOT NULL,
        "sex" "public"."participants_sex_enum" NOT NULL,
        "emergencyContactName" character varying(180),
        "emergencyContactPhone" character varying(40),
        "diocese" character varying(120),
        "city" character varying(120),
        "group_id" integer,
        CONSTRAINT "PK_participants_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "volunteers" (
        "id" SERIAL NOT NULL,
        "user_id" integer,
        "firstName" character varying(120) NOT NULL,
        "lastName" character varying(120) NOT NULL,
        "phone" character varying(40),
        "email" character varying(255),
        "team" character varying(120),
        "isGroupLeader" boolean NOT NULL DEFAULT false,
        "notes" text,
        CONSTRAINT "PK_volunteers_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" SERIAL NOT NULL,
        "name" character varying(150) NOT NULL,
        "group_id" integer,
        "primary_animator_id" integer,
        "secondary_animator_id" integer,
        "maxSize" integer NOT NULL DEFAULT 10,
        "notes" text,
        CONSTRAINT "PK_teams_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "team_participants" (
        "id" SERIAL NOT NULL,
        "team_id" integer NOT NULL,
        "participant_id" integer NOT NULL,
        "role" "public"."team_participants_role_enum" NOT NULL DEFAULT 'MEMBER',
        "notes" text,
        CONSTRAINT "UQ_team_participants_team_participant" UNIQUE ("team_id", "participant_id"),
        CONSTRAINT "PK_team_participants_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "host_families" (
        "id" SERIAL NOT NULL,
        "familyName" character varying(160) NOT NULL,
        "address" character varying(255) NOT NULL,
        "postalCode" character varying(20) NOT NULL,
        "city" character varying(120) NOT NULL,
        "phone" character varying(40),
        "email" character varying(255),
        "maxCapacity" integer NOT NULL,
        "maxUnder18" integer NOT NULL DEFAULT 0,
        "parish" character varying(120),
        "notes" text,
        CONSTRAINT "PK_host_families_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "participant_host_family_assignments" (
        "id" SERIAL NOT NULL,
        "participant_id" integer NOT NULL,
        "host_family_id" integer NOT NULL,
        "arrivalDate" date NOT NULL,
        "departureDate" date NOT NULL,
        "status" "public"."participant_host_family_assignments_status_enum" NOT NULL DEFAULT 'PLANNED',
        "notes" text,
        CONSTRAINT "PK_participant_host_family_assignments_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "participant_health" (
        "id" SERIAL NOT NULL,
        "participant_id" integer NOT NULL,
        "medicalConditions" text,
        "allergies" text,
        "medications" text,
        "specialNeeds" text,
        "dietaryNotes" text,
        "emergencyInstructions" text,
        "lastUpdatedAt" TIMESTAMP WITH TIME ZONE,
        "last_updated_by_user_id" integer,
        CONSTRAINT "UQ_participant_health_participant_id" UNIQUE ("participant_id"),
        CONSTRAINT "PK_participant_health_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "user_id" integer NOT NULL,
        "role_id" integer NOT NULL,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("user_id", "role_id")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "participants" ADD CONSTRAINT "FK_participants_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "volunteers" ADD CONSTRAINT "FK_volunteers_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_primary_animator" FOREIGN KEY ("primary_animator_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_secondary_animator" FOREIGN KEY ("secondary_animator_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_participants" ADD CONSTRAINT "FK_team_participants_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_participants" ADD CONSTRAINT "FK_team_participants_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" ADD CONSTRAINT "FK_assignments_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" ADD CONSTRAINT "FK_assignments_host_family" FOREIGN KEY ("host_family_id") REFERENCES "host_families"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_health" ADD CONSTRAINT "FK_participant_health_participant" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_health" ADD CONSTRAINT "FK_participant_health_last_updated_by" FOREIGN KEY ("last_updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_role"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_user"`);
    await queryRunner.query(
      `ALTER TABLE "participant_health" DROP CONSTRAINT "FK_participant_health_last_updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_health" DROP CONSTRAINT "FK_participant_health_participant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" DROP CONSTRAINT "FK_assignments_host_family"`,
    );
    await queryRunner.query(
      `ALTER TABLE "participant_host_family_assignments" DROP CONSTRAINT "FK_assignments_participant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_participants" DROP CONSTRAINT "FK_team_participants_participant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_participants" DROP CONSTRAINT "FK_team_participants_team"`,
    );
    await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_secondary_animator"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_primary_animator"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_group"`);
    await queryRunner.query(`ALTER TABLE "volunteers" DROP CONSTRAINT "FK_volunteers_user"`);
    await queryRunner.query(`ALTER TABLE "participants" DROP CONSTRAINT "FK_participants_group"`);

    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TABLE "participant_health"`);
    await queryRunner.query(`DROP TABLE "participant_host_family_assignments"`);
    await queryRunner.query(`DROP TABLE "host_families"`);
    await queryRunner.query(`DROP TABLE "team_participants"`);
    await queryRunner.query(`DROP TABLE "teams"`);
    await queryRunner.query(`DROP TABLE "volunteers"`);
    await queryRunner.query(`DROP TABLE "participants"`);
    await queryRunner.query(`DROP TABLE "groups"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(`DROP TYPE "public"."participant_host_family_assignments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."team_participants_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."participants_sex_enum"`);
  }
}
