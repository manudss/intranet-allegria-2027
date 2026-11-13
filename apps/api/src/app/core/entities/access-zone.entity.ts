import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PersonType } from './person-type.enum';
import { AccessScanPoint } from './access-scan-point.entity';

/**
 * Zone à contrôler (nombre libre, créée dans l'admin) avec ses règles :
 * qui a le droit de passer, contrôle en ligne obligatoire ou non, délai
 * maximal hors ligne avant que la table locale soit considérée périmée.
 */
@Entity({ name: 'access_zones' })
export class AccessZone {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description!: string | null;

  /**
   * Types de personnes admises dans la zone (vide = tout le monde).
   * Proposition du plan : zones sensibles réservées aux bénévoles/adultes.
   */
  @Column({ name: 'allowed_person_types', type: 'simple-array', nullable: true })
  allowedPersonTypes!: PersonType[] | null;

  /**
   * Zone sensible : le scanner doit valider en ligne, ou refuser si sa
   * table n'est plus assez fraîche. Proposition à valider, défaut sûr off
   * pour les zones ordinaires, on pour les zones sensibles.
   */
  @Column({ name: 'requires_online_validation', type: 'boolean', default: false })
  requiresOnlineValidation!: boolean;

  /**
   * Délai d'effacement automatique des données locales, réglable par zone
   * (proposition du plan : quelques heures, 4 h par défaut).
   */
  @Column({ name: 'max_offline_minutes', type: 'int', default: 240 })
  maxOfflineMinutes!: number;

  @OneToMany(() => AccessScanPoint, (point) => point.zone)
  points!: AccessScanPoint[];
}
