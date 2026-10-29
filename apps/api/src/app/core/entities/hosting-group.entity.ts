import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { HostFamily } from './host-family.entity';
import { Team } from './team.entity';

/**
 * Groupe d'hébergement : ensemble de familles d'accueil (ex. un quartier ou une paroisse)
 * auquel on affecte des équipes de rassemblement. Les jeunes d'une équipe sont ensuite
 * répartis entre les familles de ce groupe.
 */
@Entity({ name: 'hosting_groups' })
export class HostingGroup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => Team, (team) => team.hostingGroup)
  teams!: Team[];

  @OneToMany(() => HostFamily, (family) => family.hostingGroup)
  hostFamilies!: HostFamily[];
}
