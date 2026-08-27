import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { VolunteerShiftAssignmentStatus } from './volunteer-shift-assignment-status.enum';
import { VolunteerShift } from './volunteer-shift.entity';
import { Volunteer } from './volunteer.entity';

@Entity({ name: 'volunteer_shift_assignments' })
export class VolunteerShiftAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'volunteer_id', type: 'int' })
  volunteerId!: number;

  @ManyToOne(() => Volunteer, (volunteer) => volunteer.shiftAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer;

  @Column({ name: 'shift_id', type: 'int' })
  shiftId!: number;

  @ManyToOne(() => VolunteerShift, (shift) => shift.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shift_id' })
  shift!: VolunteerShift;

  @Column({
    type: 'enum',
    enum: VolunteerShiftAssignmentStatus,
    enumName: 'volunteer_shift_assignment_status_enum',
    default: VolunteerShiftAssignmentStatus.PROVISIONAL,
  })
  status!: VolunteerShiftAssignmentStatus;

  @Column({ name: 'assigned_by_user_id', type: 'int' })
  assignedByUserId!: number;

  @ManyToOne(() => User, (user) => user.shiftAssignmentsCreated, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'assigned_by_user_id' })
  assignedByUser!: User;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

