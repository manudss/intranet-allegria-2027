import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Participant } from './participant.entity';
import { User } from './user.entity';

@Entity({ name: 'participant_health' })
export class ParticipantHealth {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => Participant, (participant) => participant.health, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant!: Participant;

  @Column({ type: 'text', nullable: true })
  medicalConditions!: string | null;

  @Column({ type: 'text', nullable: true })
  allergies!: string | null;

  @Column({ type: 'text', nullable: true })
  medications!: string | null;

  @Column({ type: 'text', nullable: true })
  specialNeeds!: string | null;

  @Column({ type: 'text', nullable: true })
  dietaryNotes!: string | null;

  @Column({ type: 'text', nullable: true })
  emergencyInstructions!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastUpdatedAt!: Date | null;

  @ManyToOne(() => User, (user) => user.healthUpdates, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_updated_by_user_id' })
  lastUpdatedBy!: User | null;
}
