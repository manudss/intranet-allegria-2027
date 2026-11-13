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
 * Session de scan d'un bénévole : bornée dans le temps, liée à une zone
 * (ou toutes zones autorisées par ses grants), avec une clé de chiffrement
 * des données locales qui expire côté serveur. Limite assumée du plan :
 * l'expiration ne rend pas illisible une copie déjà déchiffrée hors ligne,
 * c'est un garde-fou, pas une garantie d'effacement à distance.
 */
@Entity({ name: 'access_scan_sessions' })
export class AccessScanSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'int' })
  @Index()
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  /** Zone couverte par la session ; NULL = toutes les zones du scanner. */
  @Column({ name: 'zone_id', type: 'int', nullable: true })
  zoneId!: number | null;

  @ManyToOne(() => AccessZone, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'zone_id' })
  zone!: AccessZone | null;

  @CreateDateColumn({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  /** Version de l'instantané remis à l'entrée en mode scan. */
  @Column({ name: 'snapshot_version', type: 'int' })
  snapshotVersion!: number;

  /**
   * Clé de chiffrement local, régénérable en ligne tant que la session est
   * ouverte et que le rôle scanner est actif. Stockée pour pouvoir être
   * redemandée ; à durcir (hash) si un jour elle sert à autre chose qu'au
   * chiffrement local du téléphone.
   */
  @Column({ name: 'session_key', type: 'varchar', length: 128 })
  sessionKey!: string;

  @Column({ name: 'key_expires_at', type: 'timestamptz' })
  keyExpiresAt!: Date;
}
