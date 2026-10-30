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
import { ProgramSequenceStatus } from './program-sequence-status.enum';
import { User } from './user.entity';
import { VolunteerTeam } from './volunteer-team.entity';

export interface ProgramDocumentLink {
  label: string;
  url: string;
}

@Index('IDX_program_sequences_day_location', ['eventDate', 'location'])
@Entity({ name: 'program_sequences' })
export class ProgramSequence {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Jour de l'événement au format YYYY-MM-DD */
  @Column({ type: 'date' })
  eventDate!: string;

  @Column({ type: 'varchar', length: 150 })
  location!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  /** Heure de début au format HH:mm */
  @Column({ type: 'varchar', length: 5 })
  startTime!: string;

  @Column({ type: 'int' })
  durationMinutes!: number;

  /** Heure de fin HH:mm, dérivée de startTime + durationMinutes, persistée pour les requêtes simples */
  @Column({ type: 'varchar', length: 5 })
  endTime!: string;

  @Column({
    type: 'enum',
    enum: ProgramSequenceStatus,
    enumName: 'program_sequence_status_enum',
    default: ProgramSequenceStatus.MOBILE,
  })
  status!: ProgramSequenceStatus;

  @Column({ type: 'int', nullable: true })
  minDurationMinutes!: number | null;

  @Column({ type: 'int', nullable: true })
  minMarginMinutes!: number | null;

  /** Prédécesseur dans la chaîne principale ; null = tête de chaîne du jour/lieu */
  @Column({ name: 'previous_sequence_id', type: 'int', nullable: true })
  previousSequenceId!: number | null;

  @ManyToOne(() => ProgramSequence, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'previous_sequence_id' })
  previousSequence!: ProgramSequence | null;

  /** Repère commun auquel se rattachent les branches parallèles */
  @Column({ name: 'anchor_sequence_id', type: 'int', nullable: true })
  anchorSequenceId!: number | null;

  @ManyToOne(() => ProgramSequence, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'anchor_sequence_id' })
  anchorSequence!: ProgramSequence | null;

  @Column({ name: 'volunteer_team_id', type: 'int', nullable: true })
  volunteerTeamId!: number | null;

  @ManyToOne(() => VolunteerTeam, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'volunteer_team_id' })
  volunteerTeam!: VolunteerTeam | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  missionIds!: number[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  documentLinks!: ProgramDocumentLink[];

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'frozen_by_user_id', type: 'int', nullable: true })
  frozenByUserId!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'frozen_by_user_id' })
  frozenByUser!: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  frozenAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
