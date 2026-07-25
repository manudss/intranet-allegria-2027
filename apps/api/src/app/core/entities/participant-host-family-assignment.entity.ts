import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AssignmentStatus } from './assignment-status.enum';
import { HostFamily } from './host-family.entity';
import { Participant } from './participant.entity';

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

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.PLANNED })
  status!: AssignmentStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

