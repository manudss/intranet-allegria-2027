import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Group } from './group.entity';
import { TeamParticipant } from './team-participant.entity';
import { Volunteer } from './volunteer.entity';

@Entity({ name: 'teams' })
export class Team {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @ManyToOne(() => Group, (group) => group.teams, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group!: Group | null;

  @ManyToOne(() => Volunteer, (volunteer) => volunteer.primaryForTeams, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'primary_animator_id' })
  primaryAnimator!: Volunteer | null;

  @ManyToOne(() => Volunteer, (volunteer) => volunteer.secondaryForTeams, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'secondary_animator_id' })
  secondaryAnimator!: Volunteer | null;

  @Column({ type: 'int', default: 10 })
  maxSize!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => TeamParticipant, (teamParticipant) => teamParticipant.team)
  members!: TeamParticipant[];
}
