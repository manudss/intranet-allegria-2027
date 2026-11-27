import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { GatheringGroup } from './gathering-group.entity';
import { ProgramSequence } from './program-sequence.entity';

/**
 * Lien entre un groupe de rassemblement et un créneau de l'agenda (relation plusieurs-à-plusieurs) :
 * un groupe peut concerner plusieurs créneaux, un créneau plusieurs groupes, chaque lien se pose
 * et se retire indépendamment. Remplace le rattachement porté par la répartition entière
 * (`gathering_repartitions.program_sequence_id`, conservé pour les données existantes).
 */
@Entity({ name: 'gathering_group_sequences' })
export class GatheringGroupSequence {
  @PrimaryColumn({ name: 'group_id', type: 'int' })
  groupId!: number;

  @ManyToOne(() => GatheringGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GatheringGroup;

  @PrimaryColumn({ name: 'program_sequence_id', type: 'int' })
  programSequenceId!: number;

  @ManyToOne(() => ProgramSequence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_sequence_id' })
  programSequence!: ProgramSequence;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
