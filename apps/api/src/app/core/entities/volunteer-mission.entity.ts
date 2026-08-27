import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VolunteerMissionStatus } from './volunteer-mission-status.enum';
import { VolunteerShift } from './volunteer-shift.entity';
import { Volunteer } from './volunteer.entity';
import { VolunteerTeam } from './volunteer-team.entity';

@Entity({ name: 'volunteer_missions' })
export class VolunteerMission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'volunteer_team_id', type: 'int', nullable: true })
  volunteerTeamId!: number | null;

  @ManyToOne(() => VolunteerTeam, (team) => team.missions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'volunteer_team_id' })
  volunteerTeam!: VolunteerTeam | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location!: string | null;

  @Column({ name: 'responsible_volunteer_id', type: 'int', nullable: true })
  responsibleVolunteerId!: number | null;

  @ManyToOne(() => Volunteer, (volunteer) => volunteer.responsibleMissions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'responsible_volunteer_id' })
  responsibleVolunteer!: Volunteer | null;

  @Column({
    type: 'enum',
    enum: VolunteerMissionStatus,
    enumName: 'volunteer_mission_status_enum',
    default: VolunteerMissionStatus.DRAFT,
  })
  status!: VolunteerMissionStatus;

  @Column({ type: 'boolean', default: false })
  isOptional!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => VolunteerShift, (shift) => shift.mission)
  shifts!: VolunteerShift[];
}



