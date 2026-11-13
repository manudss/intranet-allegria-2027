import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AccessBadgeAssignment } from './access-badge-assignment.entity';
import { AccessBadgeStatus } from './access-badge-status.enum';

/**
 * Un QR pré-imprimé du stock. Le code est opaque (aucune donnée personnelle)
 * et unique ; son lien avec une personne est une affectation modifiable.
 */
@Entity({ name: 'access_badges' })
export class AccessBadge {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  /** Lot d'impression (ex. "L2027-A") pour retrouver le stock physique. */
  @Column({ type: 'varchar', length: 80 })
  lot!: string;

  @Column({
    type: 'enum',
    enum: AccessBadgeStatus,
    enumName: 'access_badge_status_enum',
    default: AccessBadgeStatus.AVAILABLE,
  })
  status!: AccessBadgeStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => AccessBadgeAssignment, (assignment) => assignment.badge)
  assignments!: AccessBadgeAssignment[];
}
