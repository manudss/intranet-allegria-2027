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
import { GatheringRepartition } from './gathering-repartition.entity';
import { GatheringGroupCategory } from './gathering-group-category.enum';
import { GatheringGroupTeam } from './gathering-group-team.entity';
import { GatheringGroupVolunteerTeam } from './gathering-group-volunteer-team.entity';
import { GatheringGroupManager } from './gathering-group-manager.entity';
import { HostingGroup } from './hosting-group.entity';
import { DocumentLink } from './document-link.entity';

/**
 * Groupe de rassemblement : rassemble des équipes entières (6 à 8 jeunes + 1 ou 2 animateurs)
 * pour un temps ou de façon autonome, avec une capacité en personnes et une catégorie
 * TA / ES / mixte. Les équipes opérationnelles de bénévoles rattachées sont affichées et
 * gérées distinctement des équipes de jeunes.
 */
@Entity({ name: 'gathering_groups' })
export class GatheringGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('IDX_gathering_groups_repartition')
  @Column({ name: 'repartition_id', type: 'int' })
  repartitionId!: number;

  @ManyToOne(() => GatheringRepartition, (repartition) => repartition.groups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'repartition_id' })
  repartition!: GatheringRepartition;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({
    type: 'enum',
    enum: GatheringGroupCategory,
    enumName: 'gathering_group_category_enum',
    default: GatheringGroupCategory.MIXTE,
  })
  category!: GatheringGroupCategory;

  /** Capacité en personnes (vide = sans jauge). */
  @Column({ name: 'capacity_persons', type: 'int', nullable: true })
  capacityPersons!: number | null;

  /** Lieu en texte libre, comme sur le programme (pas de référentiel de lieux). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  location!: string | null;

  /** Lieu structuré (le texte « location » reste, repris du lieu et de la salle quand ils sont choisis). */
  @Column({ name: 'place_id', type: 'int', nullable: true })
  placeId!: number | null;

  @Column({ name: 'room_id', type: 'int', nullable: true })
  roomId!: number | null;

  /** Groupe d'hébergement lié, le cas échéant. */
  @Column({ name: 'hosting_group_id', type: 'int', nullable: true })
  hostingGroupId!: number | null;

  @ManyToOne(() => HostingGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hosting_group_id' })
  hostingGroup!: HostingGroup | null;

  /** Fiche de poste (document de la bibliothèque) liée, le cas échéant. */
  @Column({ name: 'document_link_id', type: 'int', nullable: true })
  documentLinkId!: number | null;

  @ManyToOne(() => DocumentLink, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'document_link_id' })
  documentLink!: DocumentLink | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => GatheringGroupTeam, (link) => link.group)
  teamLinks!: GatheringGroupTeam[];

  @OneToMany(() => GatheringGroupVolunteerTeam, (link) => link.group)
  volunteerTeamLinks!: GatheringGroupVolunteerTeam[];

  @OneToMany(() => GatheringGroupManager, (link) => link.group)
  managerLinks!: GatheringGroupManager[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
