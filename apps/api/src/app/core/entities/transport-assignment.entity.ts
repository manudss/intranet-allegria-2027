import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { DelegationTransport } from './delegation-transport.entity';
import { AssignmentPersonType } from './assignment-person-type.enum';
import { TransportDirection } from './transport-direction.enum';

/**
 * Affectation d'une personne (jeune ou bénévole, identifiée par personType +
 * personId car les fiches BENEVOLE sont des projections d'équipe) au trajet
 * d'une délégation pour un sens donné.
 *
 * Une seule affectation par personne et par sens : le transport est
 * directement sur l'affectation, et une valeur nulle signifie « à placer ».
 * Une affectation dont la délégation diffère de la délégation d'appartenance
 * de la personne matérialise une exception (comptée côté délégation
 * d'accueil, jamais côté origine).
 */
@Entity('transport_assignments')
@Unique('one_assignment_per_person_and_direction', ['personType', 'personId', 'direction'])
export class TransportAssignment {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'enum', enum: AssignmentPersonType, enumName: 'assignment_person_type_enum' })
  personType: AssignmentPersonType;
  @Column({ type: 'int' }) personId: number;
  @Column({ type: 'enum', enum: TransportDirection, enumName: 'transport_direction_enum' })
  direction: TransportDirection;
  /** Délégation responsable de ce trajet pour la personne (accueil si exception). */
  @ManyToOne(() => Group, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delegation_id' })
  delegation: Group;
  /** null = « à placer » sur ce sens. */
  @ManyToOne(() => DelegationTransport, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transport_id' })
  transport: DelegationTransport | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
