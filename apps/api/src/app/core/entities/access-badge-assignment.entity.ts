import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccessBadge } from './access-badge.entity';
import { Participant } from './participant.entity';
import { User } from './user.entity';

/**
 * Lien versionné entre un badge et une personne. Un scan conserve
 * l'affectation connue au moment du scan : réattribuer un code ne réécrit
 * jamais le passé. endsAt NULL = affectation active.
 * Contraintes serveur (propositions du plan, par défaut sûres) :
 * un seul porteur actif par badge, un seul badge actif par personne.
 */
@Entity({ name: 'access_badge_assignments' })
export class AccessBadgeAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'badge_id', type: 'int' })
  @Index()
  badgeId!: number;

  @ManyToOne(() => AccessBadge, (badge) => badge.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'badge_id' })
  badge!: AccessBadge;

  @Column({ name: 'participant_id', type: 'int' })
  @Index()
  participantId!: number;

  @ManyToOne(() => Participant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant!: Participant;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  startsAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  /** Version monotone par badge, transmise aux scanners dans les instantanés. */
  @Column({ type: 'int', default: 1 })
  version!: number;

  /** Version globale (access_control_meta) à la création de l'affectation. */
  @Column({ name: 'meta_created_version', type: 'int', default: 0 })
  metaCreatedVersion!: number;

  /** Version globale à la clôture ; sert aux deltas de révocation. */
  @Column({ name: 'meta_closed_version', type: 'int', nullable: true })
  metaClosedVersion!: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason!: string | null;

  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId!: number | null;

  @ManyToOne(() => User, { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy!: User | null;

  /**
   * Idempotence des opérations d'affectation/remplacement : une demande
   * répétée avec le même operationId ne crée pas de seconde affectation.
   */
  @Index({ unique: true })
  @Column({ name: 'operation_id', type: 'varchar', length: 80, nullable: true })
  operationId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
