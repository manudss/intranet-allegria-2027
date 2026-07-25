import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ParticipantHostFamilyAssignment } from './participant-host-family-assignment.entity';

@Entity({ name: 'host_families' })
export class HostFamily {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 160 })
  familyName!: string;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ type: 'varchar', length: 20 })
  postalCode!: string;

  @Column({ type: 'varchar', length: 120 })
  city!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'int' })
  maxCapacity!: number;

  @Column({ type: 'int', default: 0 })
  maxUnder18!: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  parish!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => ParticipantHostFamilyAssignment, (assignment) => assignment.hostFamily)
  assignments!: ParticipantHostFamilyAssignment[];
}

