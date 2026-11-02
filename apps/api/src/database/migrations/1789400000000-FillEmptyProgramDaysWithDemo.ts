import { MigrationInterface, QueryRunner } from 'typeorm';
import { insertProgramDemoDay, PROGRAM_SEED_DAYS } from '../../app/core/program/program-demo-seed';

/**
 * Remplit avec le programme de démonstration (fictif) les jours du planning qui n'ont AUCUNE
 * séquence, pour que chaque base de démo / de preview affiche un planning vivant sans seed manuel.
 * Ne supprime ni ne modifie jamais une donnée existante : un jour déjà renseigné est ignoré.
 */
export class FillEmptyProgramDaysWithDemo1789400000000 implements MigrationInterface {
  name = 'FillEmptyProgramDaysWithDemo1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const teams: { id: number }[] = await queryRunner.query(
      `SELECT "id" FROM "volunteer_teams" WHERE "isActive" = true ORDER BY "id" ASC`,
    );
    const teamCursor = { value: 0 };
    for (const day of PROGRAM_SEED_DAYS) {
      const [{ count }] = await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM "program_sequences" WHERE "eventDate" = $1`,
        [day.eventDate],
      );
      if (count > 0) continue;
      await insertProgramDemoDay(queryRunner.manager, day, {
        teamIds: teams.map((team) => team.id),
        coordinatorId: null,
        teamCursor,
      });
    }
  }

  public async down(): Promise<void> {
    // Données de démonstration : pas de retour arrière (on ne supprime jamais de données saisies).
  }
}
