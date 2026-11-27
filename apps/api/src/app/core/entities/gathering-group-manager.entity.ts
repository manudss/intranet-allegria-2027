import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { GatheringGroup } from './gathering-group.entity';
import { User } from './user.entity';

/**
 * Responsable d'un groupe de rassemblement : la nomination définit le PÉRIMÈTRE du compte
 * (ses groupes, portée « ses groupes » de la matrice) ; la matrice des droits décide le
 * NIVEAU (Voir, Modifier, Gérer). Sans règle de matrice, un responsable n'a aucun accès.
 */
@Entity({ name: 'gathering_group_managers' })
export class GatheringGroupManager {
  @PrimaryColumn({ name: 'group_id', type: 'int' })
  groupId!: number;

  @ManyToOne(() => GatheringGroup, (group) => group.managerLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GatheringGroup;

  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
