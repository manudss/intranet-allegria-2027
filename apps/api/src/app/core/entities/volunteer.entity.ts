import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Team } from './team.entity';
import { User } from './user.entity';
import { VolunteerSkill } from './volunteer-skill.entity';
import { VolunteerTag } from './volunteer-tag.entity';
import { VolunteerTeamMembership } from './volunteer-team-membership.entity';
import { VolunteerMission } from './volunteer-mission.entity';
import { VolunteerShiftAssignment } from './volunteer-shift-assignment.entity';

@Entity({ name: 'volunteers' })
export class Volunteer {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.volunteerProfiles, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ type: 'varchar', length: 120 })
  lastName!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  team!: string | null;

  @Column({ type: 'boolean', default: false })
  isGroupLeader!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => Team, (team) => team.primaryAnimator)
  primaryForTeams!: Team[];

  @OneToMany(() => Team, (team) => team.secondaryAnimator)
  secondaryForTeams!: Team[];

  @OneToMany(() => VolunteerTeamMembership, (membership) => membership.volunteer)
  teamMemberships!: VolunteerTeamMembership[];

  @OneToMany(() => VolunteerSkill, (skill) => skill.volunteer)
  skills!: VolunteerSkill[];

  @OneToMany(() => VolunteerTag, (tag) => tag.volunteer)
  tags!: VolunteerTag[];

  @OneToMany(() => VolunteerMission, (mission) => mission.responsibleVolunteer)
  responsibleMissions!: VolunteerMission[];

  @OneToMany(() => VolunteerShiftAssignment, (assignment) => assignment.volunteer)
  shiftAssignments!: VolunteerShiftAssignment[];
}
