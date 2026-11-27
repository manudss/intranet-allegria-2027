import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Liens groupe de rassemblement <-> créneau (plusieurs-à-plusieurs). Les rattachements
 * existants (répartition liée à un créneau) sont recopiés groupe par groupe ; la colonne
 * `gathering_repartitions.program_sequence_id` est conservée telle quelle.
 */
export class CreateGatheringGroupSequences1791100000000 implements MigrationInterface {
  name = 'CreateGatheringGroupSequences1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "gathering_group_sequences" (
      "group_id" integer NOT NULL,
      "program_sequence_id" integer NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_gathering_group_sequences" PRIMARY KEY ("group_id", "program_sequence_id"),
      CONSTRAINT "FK_gathering_group_sequences_group" FOREIGN KEY ("group_id") REFERENCES "gathering_groups"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_gathering_group_sequences_sequence" FOREIGN KEY ("program_sequence_id") REFERENCES "program_sequences"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_gathering_group_sequences_sequence" ON "gathering_group_sequences" ("program_sequence_id")`,
    );
    await queryRunner.query(`INSERT INTO "gathering_group_sequences" ("group_id", "program_sequence_id")
      SELECT g."id", r."program_sequence_id"
        FROM "gathering_groups" g
        JOIN "gathering_repartitions" r ON r."id" = g."repartition_id"
       WHERE r."program_sequence_id" IS NOT NULL
      ON CONFLICT DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "gathering_group_sequences"`);
  }
}
