import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rattrapage de la table de suivi de SplitPersonNotesAccess1791200000000.
 *
 * La première version de cette migration a été appliquée sur certaines bases (previews) sans la table
 * "person_notes_split_log", puis la migration a été modifiée pour la créer. TypeORM ne rejoue pas une
 * migration déjà enregistrée : ces bases n'ont donc jamais eu la table, et le seed (TRUNCATE) échoue.
 *
 * Additive et idempotente : crée la table seulement si elle manque. Ne lit, ne modifie et ne supprime
 * aucune ligne. Sur une base neuve (table déjà créée par 1791200000000) elle ne fait rien.
 * Retour arrière : volontairement sans effet, la table appartient à 1791200000000 (son retour la supprime).
 * Les lignes copiées par l'ancienne version ne sont pas tracées : le retour de 1791200000000 ne les supprime pas.
 */
export class EnsurePersonNotesSplitLog1791300000000 implements MigrationInterface {
  name = 'EnsurePersonNotesSplitLog1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "person_notes_split_log" (
         "kind" varchar(10) NOT NULL,
         "ref_id" integer NOT NULL,
         PRIMARY KEY ("kind", "ref_id")
       )`,
    );
  }

  public async down(): Promise<void> {
    // Sans effet : ne supprime rien.
  }
}
