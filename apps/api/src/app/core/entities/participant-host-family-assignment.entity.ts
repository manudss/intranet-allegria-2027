import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AssignmentStatus } from './assignment-status.enum';
import { HostFamily } from './host-family.entity';
import { Participant } from './participant.entity';
import { PersonType } from './person-type.enum';

@Entity({ name: 'participant_host_family_assignments' })
export class ParticipantHostFamilyAssignment {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Participant, (participant) => participant.hostFamilyAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant!: Participant;

  @ManyToOne(() => HostFamily, (hostFamily) => hostFamily.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'host_family_id' })
  hostFamily!: HostFamily;

  @Column({ type: 'date' })
  arrivalDate!: string;

  @Column({ type: 'date' })
  departureDate!: string;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.PENDING })
  status!: AssignmentStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'enum', enum: PersonType, enumName: 'person_type_enum' })
  type!: PersonType;

  @Column({ type: 'int', nullable: true })
  groupId!: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  roomLabel!: string | null;
}

