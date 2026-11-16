import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProgramSequence } from './program-sequence.entity';

/**
 * Tâche de préparation rattachée à un créneau (fiche événement). L'échéance est
 * soit relative au début du créneau (« dueOffsetMinutes » minutes avant), soit une
 * date fixe (« dueDate ») ; exactement l'une des deux est renseignée (contrainte SQL).
 */
@Entity({ name: 'event_preparation_tasks' })
export class EventPreparationTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('IDX_event_preparation_tasks_sequence')
  @Column({ name: 'sequence_id', type: 'int' })
  sequenceId!: number;

  @ManyToOne(() => ProgramSequence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sequence_id' })
  sequence!: ProgramSequence;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** Minutes avant le début du créneau ; NULL si l'échéance est une date fixe */
  @Column({ type: 'int', nullable: true })
  dueOffsetMinutes!: number | null;

  /** Date fixe au format YYYY-MM-DD ; NULL si l'échéance est relative */
  @Column({ type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  responsible!: string | null;

  @Column({ type: 'boolean', default: false })
  isDone!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  doneAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
