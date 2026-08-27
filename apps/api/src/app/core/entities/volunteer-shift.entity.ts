import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VolunteerMission } from './volunteer-mission.entity';
import { VolunteerShiftStatus } from './volunteer-shift-status.enum';

@Entity({ name: 'volunteer_shifts' })
export class VolunteerShift {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'mission_id', type: 'int' })
  missionId!: number;

  @ManyToOne(() => VolunteerMission, (mission) => mission.shifts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mission_id' })
  mission!: VolunteerMission;

  @Column({ type: 'timestamptz' })
  startAt!: Date;

  @Column({ type: 'timestamptz' })
  endAt!: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location!: string | null;

  @Column({ type: 'int', nullable: true })
  capacity!: number | null;

  @Column({
    type: 'enum',
    enum: VolunteerShiftStatus,
    enumName: 'volunteer_shift_status_enum',
    default: VolunteerShiftStatus.TODO,
  })
  status!: VolunteerShiftStatus;

  @Column({ type: 'boolean', default: false })
  isOptional!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}



