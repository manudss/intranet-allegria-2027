import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { Volunteer } from './volunteer.entity';

/**
 * Logement d'un bénévole pendant l'événement : il dort avec les jeunes
 * d'une équipe existante, comme les animateurs. L'hébergement affiché
 * (familles d'accueil, lieu) se déduit de l'équipe rattachée.
 */
@Unique('uq_volunteer_team_lodging_volunteer', ['volunteerId'])
@Entity({ name: 'volunteer_team_lodgings' })
export class VolunteerTeamLodging {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'volunteer_id', type: 'int' })
  volunteerId!: number;

  @ManyToOne(() => Volunteer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer;

  @Column({ name: 'team_id', type: 'int' })
  teamId!: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team!: Team;

  /** Chambre ou emplacement précis dans le logement */
  @Column({ type: 'varchar', length: 120, nullable: true })
  room!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'start_at', type: 'date', nullable: true })
  startAt!: string | null;

  @Column({ name: 'end_at', type: 'date', nullable: true })
  endAt!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
