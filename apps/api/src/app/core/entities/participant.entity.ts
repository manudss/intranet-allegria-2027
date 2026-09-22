import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { ParticipantHostFamilyAssignment } from './participant-host-family-assignment.entity';
import { ParticipantHealth } from './participant-health.entity';
import { ParticipantSex } from './participant-sex.enum';
import { MejAgeGroup } from './mej-age-group.enum';
import { TeamParticipant } from './team-participant.entity';
import { PersonType } from './person-type.enum';

@Entity({ name: 'participants' })
export class Participant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ type: 'varchar', length: 120 })
  lastName!: string;

  @Column({ type: 'date' })
  dateOfBirth!: string;

  @Column({ type: 'enum', enum: ParticipantSex })
  sex!: ParticipantSex;

  @Column({ type: 'enum', enum: MejAgeGroup, nullable: true })
  mejAgeGroup!: MejAgeGroup | null;

  @Column({
    type: 'enum',
    enum: PersonType,
    enumName: 'person_type_enum',
    default: PersonType.JEUNE,
  })
  type!: PersonType;

  @Column({ type: 'varchar', length: 180, nullable: true })
  emergencyContactName!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  emergencyContactPhone!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  diocese!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @ManyToOne(() => Group, (group) => group.participants, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group!: Group | null;

  @OneToMany(() => TeamParticipant, (teamParticipant) => teamParticipant.participant)
  teamMemberships!: TeamParticipant[];

  @OneToMany(() => ParticipantHostFamilyAssignment, (assignment) => assignment.participant)
  hostFamilyAssignments!: ParticipantHostFamilyAssignment[];

  @OneToOne(() => ParticipantHealth, (health) => health.participant)
  health!: ParticipantHealth | null;
}
