import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fiche événement : table dédiée pour le lien créneau ↔ groupes de rassemblement,
 * et tâches de préparation rattachées à un créneau. Convention du projet : colonnes
 * de données en camelCase (« dueOffsetMinutes »), snake_case réservé aux clés
 * étrangères (sequence_id, group_id, comme frozen_by_user_id).
 */
export class CreateSequenceGroupsAndTasks1790400000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE program_sequence_groups (
        sequence_id integer NOT NULL REFERENCES program_sequences(id) ON DELETE CASCADE,
        group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        CONSTRAINT "PK_program_sequence_groups" PRIMARY KEY (sequence_id, group_id)
      )
    `);
    await q.query(
      `CREATE INDEX "IDX_program_sequence_groups_group" ON program_sequence_groups (group_id)`,
    );
    await q.query(`
      CREATE TABLE event_preparation_tasks (
        id SERIAL PRIMARY KEY,
        sequence_id integer NOT NULL REFERENCES program_sequences(id) ON DELETE CASCADE,
        title varchar(200) NOT NULL,
        "dueOffsetMinutes" integer NULL,
        "dueDate" date NULL,
        responsible varchar(150) NULL,
        "isDone" boolean NOT NULL DEFAULT false,
        "doneAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_event_preparation_tasks_due" CHECK (
          (("dueOffsetMinutes" IS NOT NULL)::int + ("dueDate" IS NOT NULL)::int) = 1
        )
      )
    `);
    await q.query(
      `CREATE INDEX "IDX_event_preparation_tasks_sequence" ON event_preparation_tasks (sequence_id)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE event_preparation_tasks`);
    await q.query(`DROP TABLE program_sequence_groups`);
  }
}
