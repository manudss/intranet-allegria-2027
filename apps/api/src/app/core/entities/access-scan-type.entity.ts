import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AccessScanDuplicateRule } from './access-scan-duplicate-rule.enum';

/**
 * Type de scan défini dans l'admin (entrée, sortie, repas, appel, bus...).
 * Le code ne fige aucun usage : les usages se règlent ici.
 */
@Entity({ name: 'access_scan_types' })
export class AccessScanType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  label!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description!: string | null;

  @Column({
    name: 'duplicate_rule',
    type: 'enum',
    enum: AccessScanDuplicateRule,
    enumName: 'access_scan_duplicate_rule_enum',
    default: AccessScanDuplicateRule.ALLOW,
  })
  duplicateRule!: AccessScanDuplicateRule;
}
