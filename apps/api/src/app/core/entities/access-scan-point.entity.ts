import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AccessScanType } from './access-scan-type.entity';
import { AccessZone } from './access-zone.entity';

/** Point de scan rattaché à une zone et à un type de scan. */
@Entity({ name: 'access_scan_points' })
export class AccessScanPoint {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'zone_id', type: 'int' })
  @Index()
  zoneId!: number;

  @ManyToOne(() => AccessZone, (zone) => zone.points, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'zone_id' })
  zone!: AccessZone;

  @Column({ name: 'scan_type_id', type: 'int' })
  scanTypeId!: number;

  @ManyToOne(() => AccessScanType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'scan_type_id' })
  scanType!: AccessScanType;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  /**
   * Identifiant de service pour la règle UNIQUE_PER_SERVICE
   * (ex. "repas-2027-07-31-midi", "bus-aller-1"). Nullable.
   */
  @Column({ name: 'service_key', type: 'varchar', length: 120, nullable: true })
  serviceKey!: string | null;

  @Column({ name: 'expected_online_required', type: 'boolean', default: false })
  expectedOnlineRequired!: boolean;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
