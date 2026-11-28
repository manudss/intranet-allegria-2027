import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sépare le droit sur les notes de personnes du droit sur les inscriptions.
 *
 * Les notes (lire, écrire, répondre) passent du module PARTICIPANTS au module PERSON_NOTES.
 * Pour que les accès existants ne changent pas, chaque règle et chaque exception individuelle
 * PARTICIPANTS réellement présente en base est COPIÉE telle quelle (niveau, portée, motif, fin de
 * validité) vers PERSON_NOTES. Rien n'est calculé depuis les défauts et aucun accès n'est élargi :
 * seuls les droits qui existaient déjà sur PARTICIPANTS sont recopiés.
 *
 * Additive et idempotente : relancée, elle n'ajoute rien de plus. Aucune ligne existante n'est
 * modifiée ni supprimée. Retour arrière : supprime uniquement les lignes PERSON_NOTES.
 */
export class SplitPersonNotesAccess1791200000000 implements MigrationInterface {
  name = 'SplitPersonNotesAccess1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "access_rules" ("subject_kind", "subject_key", "module", "level", "scope")
       SELECT "subject_kind", "subject_key", 'PERSON_NOTES', "level", "scope"
       FROM "access_rules" WHERE "module" = 'PARTICIPANTS'
       ON CONFLICT ("subject_kind", "subject_key", "module") DO NOTHING`,
    );
    await queryRunner.query(
      `INSERT INTO "access_overrides" ("user_id", "module", "level", "scope", "reason", "expires_at", "created_by")
       SELECT o."user_id", 'PERSON_NOTES', o."level", o."scope", o."reason", o."expires_at", o."created_by"
       FROM "access_overrides" o
       WHERE o."module" = 'PARTICIPANTS'
         AND NOT EXISTS (
           SELECT 1 FROM "access_overrides" n
           WHERE n."user_id" = o."user_id" AND n."module" = 'PERSON_NOTES'
             AND n."level" = o."level" AND n."scope" = o."scope" AND n."reason" = o."reason"
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "access_overrides" WHERE "module" = 'PERSON_NOTES'`);
    await queryRunner.query(`DELETE FROM "access_rules" WHERE "module" = 'PERSON_NOTES'`);
  }
}
