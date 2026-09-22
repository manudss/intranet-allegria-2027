import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { VolunteerShift } from './volunteer-shift.entity';
import { VolunteerShiftStatus } from './volunteer-shift-status.enum';

@Entity({ name: 'shift_status_logs' })
export class ShiftStatusLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'shift_id', type: 'int' })
  shiftId!: number;

  @ManyToOne(() => VolunteerShift, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'shift_id' })
  shift!: VolunteerShift;

  @Column({ type: 'enum', enum: VolunteerShiftStatus })
  fromStatus!: VolunteerShiftStatus;

  @Column({ type: 'enum', enum: VolunteerShiftStatus })
  toStatus!: VolunteerShiftStatus;

  @Column({ name: 'changed_by_user_id', type: 'int', nullable: true })
  changedByUserId!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changed_by_user_id' })
  changedByUser!: User | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
