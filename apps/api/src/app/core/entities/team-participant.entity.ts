import { Column, Entity, JoinColumn, ManyToOne, Unique, PrimaryGeneratedColumn } from 'typeorm';
import { Participant } from './participant.entity';
import { TeamParticipantRole } from './team-participant-role.enum';
import { Team } from './team.entity';

@Entity({ name: 'team_participants' })
@Unique('uq_team_participant', ['team', 'participant'])
export class TeamParticipant {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team!: Team;

  @ManyToOne(() => Participant, (participant) => participant.teamMemberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'participant_id' })
  participant!: Participant;

  @Column({ type: 'enum', enum: TeamParticipantRole, default: TeamParticipantRole.MEMBER })
  role!: TeamParticipantRole;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
