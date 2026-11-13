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
import { AccessBadgeAssignment } from './access-badge-assignment.entity';
import { AccessScanPoint } from './access-scan-point.entity';
import { AccessScanSession } from './access-scan-session.entity';
import { AccessScanType } from './access-scan-type.entity';
import { AccessScanVerdict } from './access-scan-verdict.enum';
import { Participant } from './participant.entity';

/**
 * Un scan, tel qu'enregistré à la réception. Chaque scan conserve
 * l'affectation et la personne connues au moment du scan, le code, la
 * version de table, la session et le point : un scan tardif ou ambigu est
 * marqué à vérifier, jamais réattribué silencieusement au nouveau porteur.
 */
@Entity({ name: 'access_scan_events' })
export class AccessScanEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'session_id', type: 'int', nullable: true })
  @Index()
  sessionId!: number | null;

  @ManyToOne(() => AccessScanSession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'session_id' })
  session!: AccessScanSession | null;

  /** Affectation connue au moment du scan ; NULL pour un code inconnu. */
  @Column({ name: 'assignment_id', type: 'int', nullable: true })
  assignmentId!: number | null;

  @ManyToOne(() => AccessBadgeAssignment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignment_id' })
  assignment!: AccessBadgeAssignment | null;

  @Column({ name: 'participant_id', type: 'int', nullable: true })
  @Index()
  participantId!: number | null;

  @ManyToOne(() => Participant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'participant_id' })
  participant!: Participant | null;

  @Column({ name: 'badge_id', type: 'int', nullable: true })
  badgeId!: number | null;

  @ManyToOne(() => AccessBadge, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'badge_id' })
  badge!: AccessBadge | null;

  /** Code scanné, conservé tel quel même si le badge est ensuite réattribué. */
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  /** Version de la table locale du scanner au moment du scan, si connue. */
  @Column({ name: 'table_version', type: 'int', nullable: true })
  tableVersion!: number | null;

  @Column({ name: 'point_id', type: 'int' })
  pointId!: number;

  @ManyToOne(() => AccessScanPoint, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'point_id' })
  point!: AccessScanPoint;

  @Column({ name: 'scan_type_id', type: 'int' })
  scanTypeId!: number;

  @ManyToOne(() => AccessScanType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'scan_type_id' })
  scanType!: AccessScanType;

  /** Heure déclarée par le téléphone (peut être hors ligne au scan). */
  @Column({ name: 'occurred_at_local', type: 'timestamptz', nullable: true })
  occurredAtLocal!: Date | null;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date;

  @Column({
    type: 'enum',
    enum: AccessScanVerdict,
    enumName: 'access_scan_verdict_enum',
  })
  verdict!: AccessScanVerdict;

  /** Contexte de service pour la règle de doublon (recopié du point ou du scan). */
  @Column({ name: 'service_key', type: 'varchar', length: 120, nullable: true })
  serviceKey!: string | null;

  /** Idempotence de l'envoi par lots : un clientEventId = un seul événement. */
  @Index({ unique: true })
  @Column({ name: 'client_event_id', type: 'varchar', length: 80 })
  clientEventId!: string;

  /** Scan tardif ou ambigu à revoir par la logistique, jamais réattribué. */
  @Column({ name: 'needs_review', type: 'boolean', default: false })
  needsReview!: boolean;
}
