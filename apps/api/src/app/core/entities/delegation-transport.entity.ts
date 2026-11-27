import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { TransportAssignment } from './transport-assignment.entity';
import { TransportDirection } from './transport-direction.enum';
import { TransportMode } from './transport-mode.enum';

/**
 * Trajet de délégation sur un sens (aller ou retour) : moyen de transport,
 * horaires, lieu de rendez-vous, infos pratiques rédigées pour les parents et
 * jauge facultative (capacité maximale, null = pas de limite).
 */
@Entity('delegation_transports')
export class DelegationTransport {
  @PrimaryGeneratedColumn() id: number;
  @ManyToOne(() => Group, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delegation_id' })
  delegation: Group;
  @Column({ type: 'enum', enum: TransportDirection, enumName: 'transport_direction_enum' })
  direction: TransportDirection;
  @Column({ type: 'enum', enum: TransportMode, enumName: 'transport_mode_enum' })
  transportMode: TransportMode;
  /** Libellé libre (« Car 1 », « TGV 6610 »…). */
  @Column({ type: 'varchar' }) name: string;
  @Column({ type: 'timestamptz', nullable: true }) departureDatetime: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) arrivalDatetime: Date | null;
  /** Lieu et heure de rendez-vous communiqués aux familles. */
  @Column({ type: 'varchar', nullable: true }) meetingPoint: string | null;
  /** Infos pratiques rédigées pour les parents (horaires, RDV, consignes). */
  @Column({ type: 'text', nullable: true }) practicalInfo: string | null;
  /** Jauge facultative : nombre maximal de places, null = sans limite. */
  @Column({ type: 'int', nullable: true }) capacity: number | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @OneToMany(() => TransportAssignment, (assignment) => assignment.transport)
  assignments: TransportAssignment[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
