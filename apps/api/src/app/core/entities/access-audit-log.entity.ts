import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccessAuditAction } from './access-audit-action.enum';
import { User } from './user.entity';

/**
 * Journal d'audit du contrôle d'accès : qui, quand, action, ancien/nouveau
 * badge, personnes concernées, motif, résultat. Lecture réservée à l'admin
 * des badges ; durée de conservation à définir avec l'équipe (question ouverte).
 */
@Entity({ name: 'access_audit_logs' })
export class AccessAuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Acteur ; NULL pour une action système ou un scan sans compte identifié. */
  @Column({ name: 'user_id', type: 'int', nullable: true })
  @Index()
  userId!: number | null;

  @ManyToOne(() => User, { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({
    type: 'enum',
    enum: AccessAuditAction,
    enumName: 'access_audit_action_enum',
  })
  @Index()
  action!: AccessAuditAction;

  @Column({ type: 'varchar', length: 100 })
  entityType!: string;

  @Column({ type: 'int', nullable: true })
  entityId!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
