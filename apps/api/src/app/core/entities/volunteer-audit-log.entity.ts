import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { VolunteerAuditAction } from './volunteer-audit-action.enum';

@Entity({ name: 'volunteer_audit_logs' })
export class VolunteerAuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'NO ACTION', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'enum',
    enum: VolunteerAuditAction,
    enumName: 'volunteer_audit_action_enum',
  })
  action!: VolunteerAuditAction;

  @Column({ type: 'varchar', length: 100 })
  entityType!: string;

  @Column({ type: 'int' })
  entityId!: number;

  @Column({ type: 'jsonb', nullable: true })
  beforeData!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  afterData!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
