import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccessZone } from './access-zone.entity';
import { User } from './user.entity';

/**
 * Habilitation de scan : le rôle SCANNER est limité par zone et par période
 * (proposition du plan : pas de rôle permanent). zoneId NULL = toutes zones.
 */
@Entity({ name: 'access_scanner_grants' })
export class AccessScannerGrant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'int' })
  @Index()
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'zone_id', type: 'int', nullable: true })
  zoneId!: number | null;

  @ManyToOne(() => AccessZone, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'zone_id' })
  zone!: AccessZone | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  startsAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId!: number | null;

  @ManyToOne(() => User, { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy!: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
