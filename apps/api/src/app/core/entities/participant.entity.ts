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
import { ParticipantRegistrationStatus } from './participant-registration-status.enum';
import { PersonSource } from './person-source.enum';
import { Volunteer } from './volunteer.entity';

@Entity({ name: 'participants' })
export class Participant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ type: 'varchar', length: 120 })
  lastName!: string;

  /**
   * Nullable : les fiches BENEVOLE (projection d'un bénévole) n'ont pas de date
   * de naissance — elles comptent toujours comme des adultes dans la répartition.
   */
  @Column({ type: 'date', nullable: true })
  dateOfBirth!: string | null;

  /** Nullable pour les fiches BENEVOLE : la mixité ne concerne que les jeunes. */
  @Column({ type: 'enum', enum: ParticipantSex, nullable: true })
  sex!: ParticipantSex | null;

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

  /**
   * Statut de la fiche : CONFIRMED = créée par le staff dans l'intranet (défaut,
   * ne change pas le comportement existant), PENDING = soumise via un formulaire
   * public et en attente de validation par un staff.
   */
  @Column({
    type: 'enum',
    enum: ParticipantRegistrationStatus,
    enumName: 'participant_registration_status_enum',
    default: ParticipantRegistrationStatus.CONFIRMED,
  })
  status!: ParticipantRegistrationStatus;

  /** Origine de la création de la fiche (staff intranet ou formulaire public). */
  @Column({
    type: 'enum',
    enum: PersonSource,
    enumName: 'person_source_enum',
    default: PersonSource.STAFF,
  })
  source!: PersonSource;

  @ManyToOne(() => Group, (group) => group.participants, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group!: Group | null;

  /**
   * Bénévole dont cette fiche est la projection (type BENEVOLE uniquement) :
   * le bénévole dort avec l'équipe et compte comme un adulte. Null pour les
   * jeunes et animateurs saisis comme fiches autonomes.
   */
  @ManyToOne(() => Volunteer, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer | null;

  @OneToMany(() => TeamParticipant, (teamParticipant) => teamParticipant.participant)
  teamMemberships!: TeamParticipant[];

  @OneToMany(() => ParticipantHostFamilyAssignment, (assignment) => assignment.participant)
  hostFamilyAssignments!: ParticipantHostFamilyAssignment[];

  @OneToOne(() => ParticipantHealth, (health) => health.participant)
  health!: ParticipantHealth | null;
}
