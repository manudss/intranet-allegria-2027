import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Group } from './group.entity';
import { ProgramSequence } from './program-sequence.entity';

/**
 * Lien entre un créneau du programme et les groupes de rassemblement concernés
 * (délégations par diocèse). Table dédiée, contrairement aux missions qui restent
 * une liste d'identifiants jsonb sur la séquence.
 */
@Entity({ name: 'program_sequence_groups' })
export class ProgramSequenceGroup {
  @PrimaryColumn({ name: 'sequence_id', type: 'int' })
  sequenceId!: number;

  @ManyToOne(() => ProgramSequence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sequence_id' })
  sequence!: ProgramSequence;

  @PrimaryColumn({ name: 'group_id', type: 'int' })
  groupId!: number;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: Group;
}
