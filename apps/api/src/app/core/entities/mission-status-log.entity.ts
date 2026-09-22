import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { VolunteerMission } from './volunteer-mission.entity';
import { VolunteerMissionStatus } from './volunteer-mission-status.enum';

@Entity({ name: 'mission_status_logs' })
export class MissionStatusLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'mission_id', type: 'int' })
  missionId!: number;

  @ManyToOne(() => VolunteerMission, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'mission_id' })
  mission!: VolunteerMission;

  @Column({ type: 'enum', enum: VolunteerMissionStatus })
  fromStatus!: VolunteerMissionStatus;

  @Column({ type: 'enum', enum: VolunteerMissionStatus })
  toStatus!: VolunteerMissionStatus;

  @Column({ name: 'changed_by_user_id', type: 'int', nullable: true })
  changedByUserId!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changed_by_user_id' })
  changedByUser!: User | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'boolean', default: false })
  isForced!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
