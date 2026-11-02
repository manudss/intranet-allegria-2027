import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProgramChangeLogAction } from './program-change-log-action.enum';
import { User } from './user.entity';

@Entity({ name: 'program_change_logs' })
export class ProgramChangeLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: ProgramChangeLogAction,
    enumName: 'program_change_log_action_enum',
  })
  action!: ProgramChangeLogAction;

  @Column({ name: 'author_user_id', type: 'int' })
  authorUserId!: number;

  @ManyToOne(() => User, { onDelete: 'NO ACTION', nullable: false })
  @JoinColumn({ name: 'author_user_id' })
  authorUser!: User;

  /** Jour concerné (YYYY-MM-DD), pour filtrer le journal par date */
  @Index('IDX_program_change_logs_event_date')
  @Column({ type: 'date' })
  eventDate!: string;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  affectedSequenceIds!: number[];

  @Column({ type: 'jsonb', nullable: true })
  beforeSnapshot!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  afterSnapshot!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
