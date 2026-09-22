import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Volunteer } from './volunteer.entity';
import { VolunteerSkillType } from './volunteer-skill-type.enum';

@Unique('uq_volunteer_skills_volunteer_skill', ['volunteerId', 'skill'])
@Entity({ name: 'volunteer_skills' })
export class VolunteerSkill {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'volunteer_id', type: 'int' })
  volunteerId!: number;

  @ManyToOne(() => Volunteer, (volunteer) => volunteer.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer;

  @Column({ type: 'enum', enum: VolunteerSkillType })
  skill!: VolunteerSkillType;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
