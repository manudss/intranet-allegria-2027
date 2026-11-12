import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bénévoles adultes rattachés à une équipe de rassemblement : une fiche
 * participant de type BENEVOLE est créée comme projection du bénévole
 * (lien volunteer_id). Ces fiches n'ont ni date de naissance ni sexe :
 * un bénévole est toujours compté comme un adulte dans la répartition.
 */
export class BenevoleParticipants1789500000000 implements MigrationInterface {
  name = 'BenevoleParticipants1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "participants" ALTER COLUMN "dateOfBirth" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "participants" ALTER COLUMN "sex" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "participants" ADD COLUMN "volunteer_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "participants" ADD CONSTRAINT "FK_participants_volunteer" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE`,
    );
    // Un bénévole n'a qu'une seule fiche BENEVOLE (les autres fiches n'ont pas de volunteer_id).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_participants_volunteer" ON "participants" ("volunteer_id") WHERE "volunteer_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_participants_volunteer"`);
    await queryRunner.query(
      `ALTER TABLE "participants" DROP CONSTRAINT "FK_participants_volunteer"`,
    );
    await queryRunner.query(`ALTER TABLE "participants" DROP COLUMN "volunteer_id"`);
    // Les fiches BENEVOLE sans naissance/sexe doivent disparaître avant de rétablir NOT NULL.
    await queryRunner.query(`DELETE FROM "participants" WHERE "volunteer_id" IS NOT NULL`);
    await queryRunner.query(
      `DELETE FROM "participants" WHERE "dateOfBirth" IS NULL OR "sex" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" ALTER COLUMN "sex" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "participants" ALTER COLUMN "dateOfBirth" SET NOT NULL`,
    );
  }
}
