import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlaceKind } from './place-kind.enum';
import { ProgramSequenceTrack } from './program-sequence-track.enum';
import { PlaceRoom } from './place-room.entity';
import { Volunteer } from './volunteer.entity';

/**
 * Lieu du rassemblement : seul porteur de l'adresse, du point GPS et des informations pratiques.
 * Les créneaux, missions, créneaux bénévoles et groupes s'y rattachent (facultativement à une
 * de ses salles). Les textes de lieu libres historiques restent en place tant qu'ils ne sont
 * pas rattachés.
 */
@Entity({ name: 'places' })
export class Place {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'enum', enum: PlaceKind, enumName: 'place_kind_enum', default: PlaceKind.OTHER })
  kind!: PlaceKind;

  /** TA, ES ou commun (réutilise l'énumération des pistes du programme). */
  @Column({
    type: 'enum',
    enum: ProgramSequenceTrack,
    enumName: 'program_sequence_track_enum',
    default: ProgramSequenceTrack.COMMON,
  })
  track!: ProgramSequenceTrack;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  country!: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'practical_info', type: 'text', nullable: true })
  practicalInfo!: string | null;

  @Column({ name: 'responsible_volunteer_id', type: 'int', nullable: true })
  responsibleVolunteerId!: number | null;

  @ManyToOne(() => Volunteer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responsible_volunteer_id' })
  responsibleVolunteer!: Volunteer | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => PlaceRoom, (room) => room.place)
  rooms!: PlaceRoom[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
