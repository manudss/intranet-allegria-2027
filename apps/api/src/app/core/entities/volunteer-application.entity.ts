import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { VolunteerApplicationStatus } from './volunteer-application-status.enum';

/**
 * Candidature bénévole soumise depuis le site public (`site`).
 *
 * Volontairement séparée de l'entité `Volunteer` (utilisée par l'intranet staff) :
 * une candidature publique n'est PAS un bénévole opérationnel tant qu'un staff ne
 * l'a pas validée et convertie manuellement en fiche `Volunteer`.
 */
@Entity({ name: 'volunteer_applications' })
export class VolunteerApplication {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ type: 'varchar', length: 120 })
  lastName!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 40 })
  phone!: string;

  @Column({ type: 'text', array: true, nullable: true })
  missionsOfInterest!: string[] | null;

  @Column({ type: 'text', nullable: true })
  availability!: string | null;

  @Column({ type: 'text', nullable: true })
  motivation!: string | null;

  @Column({
    type: 'enum',
    enum: VolunteerApplicationStatus,
    enumName: 'volunteer_application_status_enum',
    default: VolunteerApplicationStatus.PENDING,
  })
  status!: VolunteerApplicationStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
