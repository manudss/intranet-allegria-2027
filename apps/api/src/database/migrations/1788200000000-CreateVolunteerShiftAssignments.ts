import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVolunteerShiftAssignments1788200000000 implements MigrationInterface {
  name = 'CreateVolunteerShiftAssignments1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."volunteer_shift_assignment_status_enum" AS ENUM(
      'PROVISIONAL',
      'CONFIRMED',
      'CANCELLED'
    )`);

    await queryRunner.query(`CREATE TABLE "volunteer_shift_assignments" (
      "id" SERIAL NOT NULL,
      "volunteer_id" integer NOT NULL,
      "shift_id" integer NOT NULL,
      "status" "public"."volunteer_shift_assignment_status_enum" NOT NULL DEFAULT 'PROVISIONAL',
      "assigned_by_user_id" integer NOT NULL,
      "notes" text,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_volunteer_shift_assignments_id" PRIMARY KEY ("id"),
      CONSTRAINT "uq_volunteer_shift_assignments_volunteer_shift" UNIQUE ("volunteer_id", "shift_id")
    )`);

    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_shift_assignments_volunteer" ON "volunteer_shift_assignments" ("volunteer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_shift_assignments_shift" ON "volunteer_shift_assignments" ("shift_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_shift_assignments_status" ON "volunteer_shift_assignments" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_volunteer_shift_assignments_assigned_by" ON "volunteer_shift_assignments" ("assigned_by_user_id")`,
    );

    await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments"
      ADD CONSTRAINT "FK_volunteer_shift_assignments_volunteer"
      FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments"
      ADD CONSTRAINT "FK_volunteer_shift_assignments_shift"
      FOREIGN KEY ("shift_id") REFERENCES "volunteer_shifts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    await queryRunner.query(`ALTER TABLE "volunteer_shift_assignments"
      ADD CONSTRAINT "FK_volunteer_shift_assignments_assigned_by"
      FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "FK_volunteer_shift_assignments_assigned_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "FK_volunteer_shift_assignments_shift"`,
    );
    await queryRunner.query(
      `ALTER TABLE "volunteer_shift_assignments" DROP CONSTRAINT "FK_volunteer_shift_assignments_volunteer"`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shift_assignments_assigned_by"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shift_assignments_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shift_assignments_shift"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_volunteer_shift_assignments_volunteer"`);

    await queryRunner.query(`DROP TABLE "volunteer_shift_assignments"`);
    await queryRunner.query(`DROP TYPE "public"."volunteer_shift_assignment_status_enum"`);
  }
}

