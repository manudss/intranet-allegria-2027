import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { GatheringGroup } from './gathering-group.entity';
import { GatheringRepartition } from './gathering-repartition.entity';
import { Team } from './team.entity';

/**
 * Affectation d'une équipe (entière, jamais coupée) à un groupe de rassemblement.
 * `repartition_id` est dénormalisé depuis le groupe pour garantir en base qu'une équipe
 * n'apparaît que dans un seul groupe d'une même répartition.
 */
@Entity({ name: 'gathering_group_teams' })
export class GatheringGroupTeam {
  @PrimaryColumn({ name: 'group_id', type: 'int' })
  groupId!: number;

  @ManyToOne(() => GatheringGroup, (group) => group.teamLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GatheringGroup;

  @PrimaryColumn({ name: 'team_id', type: 'int' })
  teamId!: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team!: Team;

  @PrimaryColumn({ name: 'repartition_id', type: 'int' })
  repartitionId!: number;

  @ManyToOne(() => GatheringRepartition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repartition_id' })
  repartition!: GatheringRepartition;
}
