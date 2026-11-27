import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Group } from './group.entity';
import { ProgramSequenceTrack } from './program-sequence-track.enum';
import { HostingGroup } from './hosting-group.entity';
import { TeamParticipant } from './team-participant.entity';
import { Volunteer } from './volunteer.entity';

@Entity({ name: 'teams' })
export class Team {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @ManyToOne(() => Group, (group) => group.teams, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group!: Group | null;

  @ManyToOne(() => Volunteer, (volunteer) => volunteer.primaryForTeams, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'primary_animator_id' })
  primaryAnimator!: Volunteer | null;

  @ManyToOne(() => Volunteer, (volunteer) => volunteer.secondaryForTeams, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'secondary_animator_id' })
  secondaryAnimator!: Volunteer | null;

  @ManyToOne(() => HostingGroup, (hostingGroup) => hostingGroup.teams, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'hosting_group_id' })
  hostingGroup!: HostingGroup | null;

  @Column({ type: 'int', default: 10 })
  maxSize!: number;

  /**
   * Piste de l'équipe : branche TA ou ES. COMMON = piste pas encore renseignée
   * (valeur de repli à la création) : une telle équipe n'entre que dans un groupe
   * de rassemblement mixte, avec une alerte, jusqu'à ce que sa piste soit choisie.
   */
  @Column({
    type: 'enum',
    enum: ProgramSequenceTrack,
    enumName: 'program_sequence_track_enum',
    default: ProgramSequenceTrack.COMMON,
  })
  track!: ProgramSequenceTrack;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => TeamParticipant, (teamParticipant) => teamParticipant.team)
  members!: TeamParticipant[];
}
