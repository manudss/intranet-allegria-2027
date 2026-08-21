import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { VolunteerTeamMembership } from './volunteer-team-membership.entity';

@Unique('uq_volunteer_teams_code', ['code'])
@Entity({ name: 'volunteer_teams' })
export class VolunteerTeam {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 80 })
  code!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => VolunteerTeamMembership, (membership) => membership.volunteerTeam)
  memberships!: VolunteerTeamMembership[];
}
