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
import { HostFamily } from './host-family.entity';
import { Volunteer } from './volunteer.entity';
import { VolunteerHostingType } from './volunteer-hosting-type.enum';

@Unique('uq_volunteer_hosting_volunteer', ['volunteerId'])
@Entity({ name: 'volunteer_hosting_assignments' })
export class VolunteerHostingAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'volunteer_id', type: 'int' })
  volunteerId!: number;

  @ManyToOne(() => Volunteer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer;

  @Column({
    type: 'enum',
    enum: VolunteerHostingType,
    enumName: 'volunteer_hosting_type_enum',
    default: VolunteerHostingType.OTHER,
  })
  type!: VolunteerHostingType;

  @Column({ name: 'host_family_id', type: 'int', nullable: true })
  hostFamilyId!: number | null;

  @ManyToOne(() => HostFamily, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'host_family_id' })
  hostFamily!: HostFamily | null;

  /** Nom du lieu pour un hébergement collectif ou autre (gymnase, internat...) */
  @Column({ name: 'location_name', type: 'varchar', length: 200, nullable: true })
  locationName!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  /** Chambre, dortoir ou emplacement précis */
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
