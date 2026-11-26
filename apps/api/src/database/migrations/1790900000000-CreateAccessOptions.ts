import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Options d'administration des droits (interrupteurs oui/non, tous à « non » au départ).
 * Option actuelle : un compte limité à des groupes voit-il les noms et effectifs des équipes
 * des autres groupes dans le placement et la répartition des jeunes ?
 */
export class CreateAccessOptions1790900000000 implements MigrationInterface {
  name = 'CreateAccessOptions1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "access_options" (
      "key" character varying(80) NOT NULL,
      "enabled" boolean NOT NULL DEFAULT false,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_access_options_key" PRIMARY KEY ("key")
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "access_options"`);
  }
}
