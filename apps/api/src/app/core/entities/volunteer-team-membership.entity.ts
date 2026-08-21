import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Volunteer } from './volunteer.entity';
import { VolunteerTeam } from './volunteer-team.entity';

@Entity({ name: 'volunteer_team_memberships' })
export class VolunteerTeamMembership {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'volunteer_id', type: 'int' })
  volunteerId!: number;

  @ManyToOne(() => Volunteer, (volunteer) => volunteer.teamMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer;

  @Column({ name: 'volunteer_team_id', type: 'int' })
  volunteerTeamId!: number;

  @ManyToOne(() => VolunteerTeam, (team) => team.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_team_id' })
  volunteerTeam!: VolunteerTeam;

  @Column({ type: 'date', nullable: true })
  startAt!: string | null;

  @Column({ type: 'date', nullable: true })
  endAt!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  role!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
