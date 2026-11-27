import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { GatheringGroup } from './gathering-group.entity';
import { VolunteerTeam } from './volunteer-team.entity';

/**
 * Rattachement d'une équipe opérationnelle de bénévoles à un groupe de rassemblement.
 * Affichée et gérée distinctement des équipes de jeunes, et comptée à part (jamais dans
 * la jauge du groupe).
 */
@Entity({ name: 'gathering_group_volunteer_teams' })
export class GatheringGroupVolunteerTeam {
  @PrimaryColumn({ name: 'group_id', type: 'int' })
  groupId!: number;

  @ManyToOne(() => GatheringGroup, (group) => group.volunteerTeamLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GatheringGroup;

  @PrimaryColumn({ name: 'volunteer_team_id', type: 'int' })
  volunteerTeamId!: number;

  @ManyToOne(() => VolunteerTeam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_team_id' })
  volunteerTeam!: VolunteerTeam;
}
