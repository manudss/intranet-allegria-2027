import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProgramSequence } from './program-sequence.entity';
import { GatheringGroup } from './gathering-group.entity';

/**
 * Répartition de rassemblement : un découpage des équipes en groupes pour un temps donné
 * (un jeu en 3 groupes, un repas en groupes de 200/400/600 par lieu...), ou autonome
 * (sans événement de l'agenda). Une équipe n'appartient qu'à un seul groupe d'une même
 * répartition et n'est jamais coupée.
 */
@Entity({ name: 'gathering_repartitions' })
export class GatheringRepartition {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  /** Événement de l'agenda rattaché ; vide = répartition autonome. */
  @Index('IDX_gathering_repartitions_sequence')
  @Column({ name: 'program_sequence_id', type: 'int', nullable: true })
  programSequenceId!: number | null;

  @ManyToOne(() => ProgramSequence, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'program_sequence_id' })
  programSequence!: ProgramSequence | null;

  /**
   * Dérogation au dépassement bloquant, réservée à un niveau Gérer : quand elle est active,
   * les affectations peuvent dépasser la capacité des groupes (affiché en rouge).
   */
  @Column({ name: 'allow_overflow', type: 'boolean', default: false })
  allowOverflow!: boolean;

  /** Comptage des jauges : animateurs compris (défaut, ils mangent et jouent) ou non. */
  @Column({ name: 'count_animators', type: 'boolean', default: true })
  countAnimators!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => GatheringGroup, (group) => group.repartition)
  groups!: GatheringGroup[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
